"""情緒指數修訂的前後比較：用已發布的網站資料離線重算，不必連網、不必載入模型。

用法（backend/ 目錄執行）:
    python tools/index_report.py --site <site-data 目錄> [--out ../docs/sentiment_index_revision.md]

<site-data> 是靜態站匯出的資料夾（stocks/<代號>/news.json 與 sentiment.json）。每一則新聞的判讀與類別機率
都已經在 news.json 裡，所以新舊兩種算法可以用同一批判讀比較，差別只來自「哪些新聞計入」與「怎麼加權」：
- 舊：全部收錄的新聞，以類別機率加權（score＝Σ(sign × 類別機率) ÷ n，|score| > 0.15 判方向）
- 新：只計入標題直接提到公司的新聞（inference/relevance.py），每則同權重（(正面 − 負面) ÷ 計入則數）；
  計入少於 3 則、或判為某個方向的那一方不到 2 則時，不給方向判斷
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from newssent.config import SENTIMENT_LABEL_THRESHOLD  # noqa: E402
from newssent.inference.aggregate import sentiment_index  # noqa: E402
from newssent.inference.relevance import relevance  # noqa: E402

LABEL_TEXT = {"positive": "正面", "neutral": "中性", "negative": "負面"}


def compare(site: Path) -> list[dict]:
    rows = []
    for news_path in sorted((site / "stocks").glob("*/news.json")):
        ticker = news_path.parent.name
        news = json.loads(news_path.read_text(encoding="utf-8"))["articles"]
        labeled = [(a["sentiment"], a["confidence"]) for a in news]
        old = sentiment_index(labeled, weighting="confidence", min_articles=1, min_polar=1)
        kept = [(a["sentiment"], a["confidence"]) for a in news if relevance(ticker, a["title"]).direct]
        new = sentiment_index(kept)
        rows.append({"ticker": ticker, "total": len(news), "direct": len(kept), "old": old, "new": new})
    return rows


def _verdict(index) -> str:
    return "資料不足" if index.insufficient else LABEL_TEXT[index.label]


def render(rows: list[dict], site_label: str) -> str:
    total = sum(r["total"] for r in rows)
    direct = sum(r["direct"] for r in rows)
    changed = [r for r in rows if _verdict(r["old"]) != _verdict(r["new"])]
    moves = Counter(f"{_verdict(r['old'])} → {_verdict(r['new'])}" for r in changed)
    lines = [
        "# 美股情緒指數的修訂（2026-10）",
        "",
        "> 由 `backend/tools/index_report.py` 產生；用已發布的網站資料離線重算，每一則的判讀都沿用發布時的結果，",
        "> 新舊差別只來自「哪些新聞計入」與「怎麼加權」。",
        "",
        "## 改了什麼",
        "",
        "| | 修訂前 | 修訂後 |",
        "|---|---|---|",
        "| 計入哪些新聞 | 新聞源收錄的全部新聞 | 只計入標題直接提到公司（名稱、別名或代號）的新聞；ETF 全部計入 |",
        "| 怎麼加權 | 以模型的類別機率加權：Σ(方向 × 類別機率) ÷ n | 每則同權重：(正面則數 − 負面則數) ÷ 計入則數 |",
        f"| 什麼時候判方向 | \\|score\\| > {SENTIMENT_LABEL_THRESHOLD} | 同左，另外計入至少 3 則、判為某個方向的那一方至少 2 則，不到就標「資料不足」 |",
        "",
        "原因：",
        "",
        "- 新聞源（Yahoo 財經）會把大盤綜述、同業的報導關聯到一檔股票；標題沒提到公司，模型仍會依標題給方向，",
        "  這些判讀就混進了這家公司的指數。標題沒提到公司的新聞改列「關聯待確認」，附上新聞源的關聯代號，不計入指數。",
        "- 類別機率是 softmax 的最大值，沒有校準過，不適合當權重。",
        "- 直接提到公司的新聞常常只有兩三則；一則就能決定方向時，判讀太容易翻來覆去。",
        "",
        f"## 前後比較（{site_label}）",
        "",
        f"{len(rows)} 檔共收錄 {total} 則新聞，其中 {direct} 則標題直接提到公司（{direct / total:.0%}）。"
        f"整體判讀有變的 {len(changed)} 檔：" + "、".join(f"{k} {v} 檔" for k, v in sorted(moves.items())) + "。",
        "",
        "| 代號 | 收錄 | 直接提到 | 修訂前 | 修訂後（正／中／負） |",
        "|---|---|---|---|---|",
    ]
    for r in rows:
        old, new = r["old"], r["new"]
        c = new.counts
        mark = " ←" if _verdict(old) != _verdict(new) else ""
        lines.append(
            f"| {r['ticker']} | {r['total']} | {r['direct']} | {old.score:+.2f} {_verdict(old)} | "
            f"{new.score:+.2f} {_verdict(new)}（{c['positive']}／{c['neutral']}／{c['negative']}）{mark} |"
        )
    lines += [
        "",
        "## 修訂改的是「量什麼」，不是準確度",
        "",
        "這次修訂改的是指數量的對象：從「新聞源關聯到這檔的新聞」改成「標題在講這家公司的新聞」；",
        "逐則判讀的模型沒有改變，所以不能說修訂後的判讀更準。",
    ]
    lines += ["", "設定在 `backend/newssent/config.py`（`SENTIMENT_SCOPE`、`SENTIMENT_WEIGHTING`、`SENTIMENT_MIN_ARTICLES`、`SENTIMENT_MIN_POLAR`），兩項改動可以分開回退。", ""]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="情緒指數修訂的前後比較（離線）")
    parser.add_argument("--site", type=Path, required=True, help="靜態站匯出的資料夾（含 stocks/<代號>/news.json）")
    parser.add_argument("--label", default="已發布的網站資料", help="報告裡對這份資料的描述，例如匯出日期")
    parser.add_argument("--out", type=Path, help="寫出 Markdown；省略時印在終端機")
    args = parser.parse_args(argv)
    rows = compare(args.site)
    if not rows:
        print(f"{args.site} 裡沒有 stocks/*/news.json", file=sys.stderr)
        return 1
    text = render(rows, args.label)
    if args.out:
        args.out.write_bytes(text.encode("utf-8"))
        print(f"已寫入 {args.out}")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
