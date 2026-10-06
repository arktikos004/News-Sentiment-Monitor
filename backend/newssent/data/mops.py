"""證交所「上市公司每日重大訊息」開放資料：收集與讀取（新聞與公告對照）。

**為什麼要自己累積**：這份開放資料（政府資料開放平臺 18415，`t187ap04_L`）沒有查詢參數，
每天清晨約 05:00 換成前一個發言日的全部重大訊息（2026-10-06 實測：出表日期 10/06 的檔案是
10/05 發言的 66 則）。錯過的那一期補不回來，所以排程每天抓幾次，以出表日期為單位存進
`mops-data` 分支：一般 commit、不覆寫歷史；同一期稍後再抓到新的公告只補上，不刪改已收的列。

**只存哪些欄位**：見 KEPT_FIELDS。「說明」全文可能含個人資料（例如人事異動的姓名與經歷），
不收；網站只顯示主旨，全文請至公開資訊觀測站查閱。

**為什麼可以公開**：證交所授權政府資料開放平臺釋出，依政府資料開放授權條款第 1 版可再散布，
但必須顯名（每個檔案的 meta.attribution）。

收集只用標準函式庫（不 import newssent.config）：排程不必安裝整套後端，也不會因為別的相依壞掉而漏收。
"""

from __future__ import annotations

import argparse
import csv
import functools
import io
import json
import os
import re
import sys
import time
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

DATASET = "t187ap04_L"
TITLE = "上市公司每日重大訊息"
GOV_ID = 18415
PROVIDER = "臺灣證券交易所"
# 平臺登錄的 CSV 與證交所 OpenAPI（JSON）；兩邊內容相同、都在清晨換期，都抓以防一邊失敗
OUTLETS = (
    "https://mopsfin.twse.com.tw/opendata/t187ap04_L.csv",
    "https://openapi.twse.com.tw/v1/opendata/t187ap04_L",
)
KEPT_FIELDS = ("出表日期", "發言日期", "發言時間", "公司代號", "公司名稱", "主旨", "符合條款", "事實發生日")
OMITTED_FIELDS = ["說明"]
LICENSE_NAME = "政府資料開放授權條款第1版"
LICENSE_URL = "https://data.gov.tw/license"
ATTRIBUTION = (
    f"資料來源：{PROVIDER}（政府資料開放平臺「{TITLE}」資料集）。"
    "此開放資料依政府資料開放授權條款（Open Government Data License）進行公眾釋出，"
    f"使用者於遵守本條款各項規定之前提下，得利用之。政府資料開放授權條款：{LICENSE_URL}"
)

_USER_AGENT = "Mozilla/5.0 (compatible; news-sentiment-monitor/1.0; +https://news.sekinv.com)"
_TIMEOUT_SECONDS = 30
_RETRIES = 3
_TAIPEI = timezone(timedelta(hours=8))  # 台灣沒有日光節約時間；不用 zoneinfo，Windows 免裝 tzdata
_DIR = DATASET.lower()


class MopsError(RuntimeError):
    """重大訊息資料取得失敗或內容不合理。"""


def roc_to_date(roc: str) -> date:
    """民國日期字串 → 西元日期：'1151005' → 2026-10-05。"""
    roc = roc.strip()
    if not roc.isdigit() or len(roc) < 6:
        raise MopsError(f"無法解析的民國日期：{roc!r}")
    return date(int(roc[:-4]) + 1911, int(roc[-4:-2]), int(roc[-2:]))


def format_time(hhmmss: str) -> str:
    """發言時間 → 'HH:MM:SS'：'70003' → '07:00:03'（來源省略小時的前導零）。"""
    digits = hhmmss.strip()
    if not digits.isdigit() or not 5 <= len(digits) <= 6:
        raise MopsError(f"無法解析的發言時間：{hhmmss!r}")
    digits = digits.zfill(6)
    return f"{digits[:2]}:{digits[2:4]}:{digits[4:]}"


def _get(url: str) -> bytes:
    last_error: Exception | None = None
    for attempt in range(1, _RETRIES + 1):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
            with urllib.request.urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
                return response.read()
        except Exception as exc:  # 連線重設、逾時、HTTP 錯誤都重試
            last_error = exc
            if attempt < _RETRIES:
                time.sleep(5 * attempt)
    raise MopsError(f"下載失敗：{url}（{last_error}）")


def parse(body: bytes, url: str) -> list[dict[str, str]]:
    """出口的原始內容 → 只留 KEPT_FIELDS 的列（欄名與值去掉前後空白；OpenAPI 的欄名是「主旨 」）。"""
    if url.endswith(".csv"):
        raw: object = list(csv.DictReader(io.StringIO(body.decode("utf-8-sig"))))
    else:
        raw = json.loads(body.decode("utf-8"))
    if not isinstance(raw, list) or not all(isinstance(r, dict) for r in raw):
        raise MopsError(f"{DATASET} 的內容不是資料列（可能是錯誤頁）")
    rows = []
    for r in raw:
        # DictReader 會把多出來的值放在 None 鍵底下——略過
        clean = {str(k).strip(): ("" if v is None else str(v)).strip() for k, v in r.items() if k is not None}
        missing = [f for f in KEPT_FIELDS if f not in clean]
        if missing:
            raise MopsError(f"{DATASET} 缺少欄位：{missing}")
        rows.append({f: clean[f] for f in KEPT_FIELDS})
    return rows


def issue_date(rows: list[dict[str, str]], today: date | None = None) -> date | None:
    """這一期的出表日期；空的一期（當天沒有任何公告）回傳 None。日期必須一致且不在未來。"""
    if not rows:
        return None
    dates = {r["出表日期"] for r in rows}
    if len(dates) != 1:
        raise MopsError(f"{DATASET} 混有多個出表日期：{sorted(dates)[:5]}")
    day = roc_to_date(dates.pop())
    for r in rows:  # 讀取端靠發言日期與時間查詢，存檔前就要能解析
        roc_to_date(r["發言日期"])
        format_time(r["發言時間"])
    if day > (today or datetime.now(_TAIPEI).date()):
        raise MopsError(f"{DATASET} 的出表日期 {day} 在未來，內容可疑")
    return day


def fetch_available(*, outlet_errors: list[str] | None = None) -> list[tuple[date, list[dict[str, str]], str]]:
    """每個出口各抓一次：[(出表日期, 列, 來源網址), ...]。空的一期不回；全部出口都失敗才丟 MopsError。"""
    found: list[tuple[date, list[dict[str, str]], str]] = []
    errors: list[str] = outlet_errors if outlet_errors is not None else []
    succeeded = False
    for url in OUTLETS:
        try:
            rows = parse(_get(url), url)
            day = issue_date(rows)
        except (MopsError, ValueError) as exc:
            errors.append(str(exc) if url in str(exc) else f"{url}: {exc}")
            continue
        succeeded = True
        if day is not None:
            found.append((day, rows, url))
    if not succeeded:
        raise MopsError("；".join(errors))
    return found


def _key(row: dict[str, str]) -> tuple[str, str, str, str]:
    return (row["發言日期"], row["發言時間"], row["公司代號"], row["主旨"])


def file_for(data_dir: Path, day: date) -> Path:
    return Path(data_dir) / _DIR / f"{day.year}" / f"{day.isoformat()}.json"


def store(data_dir: Path, day: date, rows: list[dict[str, str]], source_url: str) -> tuple[Path, int]:
    """寫入一期；檔案已存在就只補上沒收過的公告。回傳 (路徑, 新增列數)，已收的列不刪不改。"""
    path = file_for(data_dir, day)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    if path.exists():
        payload = json.loads(path.read_text(encoding="utf-8"))
        seen = {_key(r) for r in payload["rows"]}
    else:
        payload = {
            "meta": {
                "dataset": DATASET,
                "date": day.isoformat(),
                "source_url": source_url,
                "dataset_url": f"https://data.gov.tw/dataset/{GOV_ID}",
                "fetched_at": now,
                "license": LICENSE_NAME,
                "license_url": LICENSE_URL,
                "attribution": ATTRIBUTION,
                "omitted_fields": OMITTED_FIELDS,
            },
            "rows": [],
        }
        seen = set()
    new = []
    for r in rows:
        if _key(r) not in seen:
            seen.add(_key(r))
            new.append(r)
    if not new:
        return path, 0
    if payload["rows"]:
        payload["meta"]["updated_at"] = now
        payload["meta"]["update_source_url"] = source_url
    payload["rows"].extend(new)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    return path, len(new)


@dataclass(frozen=True)
class Announcement:
    day: date  # 發言日期
    time: str  # 發言時間 HH:MM:SS
    code: str
    company: str
    subject: str
    clause: str  # 符合條款，例如「第51款」

    @property
    def clarification(self) -> bool:
        """公司澄清媒體報導：新聞查證最直接的對照。"""
        return "澄清" in self.subject


@functools.lru_cache(maxsize=4)
def _load(signature: tuple[tuple[str, int], ...]) -> tuple[Announcement, ...]:
    """以檔案清單＋大小當快取鍵：每天新增或補上一期就自動重讀。同一則公告出現在多期只算一次。"""
    items: dict[tuple, Announcement] = {}
    for name, _size in signature:
        for r in json.loads(Path(name).read_text(encoding="utf-8"))["rows"]:
            try:
                a = Announcement(
                    day=roc_to_date(r["發言日期"]),
                    time=format_time(r["發言時間"]),
                    code=r["公司代號"],
                    company=r["公司名稱"],
                    subject=re.sub(r"\s*\n\s*", "", r["主旨"]),  # 來源的主旨在句中換行
                    clause=r["符合條款"],
                )
            except (KeyError, MopsError, ValueError):
                continue
            items[(a.day, a.time, a.code, a.subject)] = a
    return tuple(sorted(items.values(), key=lambda a: (a.day, a.time, a.code)))


def load_announcements(data_dir: Path) -> tuple[Announcement, ...]:
    """已累積的全部公告，依發言日期與時間排序；資料目錄不存在時回傳空 tuple。"""
    files = sorted(Path(data_dir).glob(f"{_DIR}/*/*.json"))
    return _load(tuple((str(p), p.stat().st_size) for p in files))


def between(items: tuple[Announcement, ...], code: str, start: date, end: date) -> list[Announcement]:
    """某公司發言日期落在 [start, end] 的公告（含兩端），依時間排序。"""
    return [a for a in items if a.code == code and start <= a.day <= end]


def _cmd_fetch(args: argparse.Namespace) -> int:
    outlet_errors: list[str] = []
    try:
        available = fetch_available(outlet_errors=outlet_errors)
    except MopsError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 1
    days = []
    for day, rows, url in available:
        path, added = store(Path(args.out), day, rows, url)
        days.append({"date": day.isoformat(), "rows": len(rows), "source_url": url, "added": added})
    print(json.dumps({"days": days, "outlet_errors": outlet_errors}, ensure_ascii=False))
    prefix = "::warning title=重大訊息::" if os.environ.get("GITHUB_ACTIONS") == "true" else "警告："
    for problem in outlet_errors:  # 只剩一個出口不算失敗，但要看得到
        print(f"{prefix}有一個出口抓不到——{' '.join(problem.split())}", file=sys.stderr)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m newssent.data.mops", description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    fetch_parser = sub.add_parser("fetch", help="抓兩個出口目前這一期並存檔（同一期只補上新公告）")
    fetch_parser.add_argument("--out", required=True, help="資料目錄（mops-data 分支的工作目錄）")
    args = parser.parse_args(argv)
    if args.command == "fetch":
        return _cmd_fetch(args)
    return 2


if __name__ == "__main__":
    sys.exit(main())
