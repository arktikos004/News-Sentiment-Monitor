"""證交所每日重大訊息：解析、只留不含個資的欄位、以出表日期存檔、同一期只補不改、讀回與區間查詢。

這份資料錯過一期就補不回來，存檔邏輯若默默覆寫、刪列或寫錯日期，損失無法回復——
所以把「欄位只留八個（不收說明全文）」「同一期再抓到新公告只補上」「日期不在未來」釘死。全部不連網。
"""

import json
from datetime import date

import pytest

from newssent.data import mops
from newssent.data.mops import (
    KEPT_FIELDS,
    MopsError,
    between,
    fetch_available,
    format_time,
    issue_date,
    load_announcements,
    parse,
    roc_to_date,
    store,
)

_CSV_URL, _API_URL = mops.OUTLETS


def _row(code: str = "2330", said: str = "1151005", at: str = "150501", subject: str = "公告本公司受邀參加法人說明會") -> dict:
    return {
        "出表日期": "1151006",
        "發言日期": said,
        "發言時間": at,
        "公司代號": code,
        "公司名稱": f"公司{code}",
        "主旨": subject,
        "符合條款": "第12款",
        "事實發生日": "1151104",
        "說明": "1.召開法人說明會之日期：115/11/04\n2.新任者姓名：王小明",
    }


def _csv_body(rows: list[dict]) -> bytes:
    header = list(rows[0].keys())
    lines = [",".join(header)] + [",".join(f'"{r[k]}"' for k in header) for r in rows]
    return ("﻿" + "\n".join(lines) + "\n").encode("utf-8")


def _api_body(rows: list[dict]) -> bytes:
    # OpenAPI 的欄名是「主旨 」（多一個空白）
    return json.dumps([{("主旨 " if k == "主旨" else k): v for k, v in r.items()} for r in rows], ensure_ascii=False).encode("utf-8")


def _serve(monkeypatch, *, csv: bytes | None, api: bytes | None) -> None:
    def fake_get(url: str) -> bytes:
        body = csv if url == _CSV_URL else api
        if body is None:
            raise MopsError(f"下載失敗：{url}")
        return body

    monkeypatch.setattr(mops, "_get", fake_get)


def test_dates_and_times():
    assert roc_to_date("1151005") == date(2026, 10, 5)
    assert format_time("70003") == "07:00:03"
    assert format_time("181254") == "18:12:54"
    with pytest.raises(MopsError):
        format_time("7:00")


def test_parse_keeps_only_the_listed_fields_from_both_outlets():
    """「說明」可能含個人資料（人事異動的姓名與經歷），兩個出口都不收；OpenAPI 的「主旨 」要正規化。"""
    rows = [_row(), _row("2317", at="70003")]
    from_csv = parse(_csv_body(rows), _CSV_URL)
    from_api = parse(_api_body(rows), _API_URL)
    assert from_csv == from_api
    assert all(tuple(r) == KEPT_FIELDS for r in from_csv)
    assert "說明" not in KEPT_FIELDS
    assert not any("王小明" in v for r in from_csv for v in r.values())


def test_parse_rejects_error_pages_and_missing_fields():
    with pytest.raises(MopsError, match="不是資料列"):
        parse(b'{"stat": "error"}', _API_URL)
    broken = [{k: v for k, v in _row().items() if k != "符合條款"}]
    with pytest.raises(MopsError, match="符合條款"):
        parse(_api_body(broken), _API_URL)


def test_issue_date_checks_consistency_and_future():
    rows = parse(_api_body([_row()]), _API_URL)
    assert issue_date(rows, today=date(2026, 10, 6)) == date(2026, 10, 6)
    assert issue_date([], today=date(2026, 10, 6)) is None  # 當天沒有任何公告：沒有東西可存，不是錯誤
    with pytest.raises(MopsError, match="未來"):
        issue_date(rows, today=date(2026, 10, 5))
    mixed = rows + [dict(rows[0], 出表日期="1151007")]
    with pytest.raises(MopsError, match="多個出表日期"):
        issue_date(mixed, today=date(2026, 10, 7))


def test_store_merges_new_rows_and_never_rewrites_old_ones(tmp_path):
    """同一期稍後抓到更多公告只補上；已收的列不刪不改，重抓同樣內容不改檔。"""
    day = date(2026, 10, 6)
    first = parse(_api_body([_row()]), _API_URL)
    path, added = store(tmp_path, day, first, _API_URL)
    assert added == 1 and path.relative_to(tmp_path).as_posix() == "t187ap04_l/2026/2026-10-06.json"
    original = path.read_bytes()

    assert store(tmp_path, day, first, _CSV_URL) == (path, 0)
    assert path.read_bytes() == original

    more = parse(_api_body([_row(), _row("2317", at="70003")]), _API_URL)
    assert store(tmp_path, day, more, _CSV_URL)[1] == 1
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert [r["公司代號"] for r in payload["rows"]] == ["2330", "2317"]
    meta = payload["meta"]
    assert meta["source_url"] == _API_URL and meta["update_source_url"] == _CSV_URL
    assert meta["dataset_url"] == "https://data.gov.tw/dataset/18415"
    assert "臺灣證券交易所" in meta["attribution"] and "上市公司每日重大訊息" in meta["attribution"]
    assert meta["omitted_fields"] == ["說明"]


def test_cli_stores_each_outlet_and_fails_only_when_all_fail(monkeypatch, tmp_path, capsys):
    argv = ["fetch", "--out", str(tmp_path)]
    _serve(monkeypatch, csv=_csv_body([_row()]), api=_api_body([_row(), _row("2317", at="70003")]))
    assert mops.main(argv) == 0
    summary = json.loads(capsys.readouterr().out)
    assert [(d["date"], d["added"]) for d in summary["days"]] == [("2026-10-06", 1), ("2026-10-06", 1)]

    _serve(monkeypatch, csv=None, api=_api_body([_row()]))
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    assert mops.main(argv) == 0
    captured = capsys.readouterr()
    assert captured.err.startswith("::warning title=重大訊息::")

    _serve(monkeypatch, csv=None, api=b"<html>busy</html>")
    assert mops.main(argv) == 1


def test_fetch_available_skips_an_empty_issue(monkeypatch):
    """只有表頭的 CSV、空陣列的 OpenAPI：這一期沒有公告，不存檔也不算失敗。"""
    _serve(monkeypatch, csv="出表日期,發言日期\n".encode("utf-8"), api=b"[]")
    assert fetch_available() == []


def test_load_and_query_announcements(tmp_path):
    """跨期去重、主旨換行接起來、依公司與發言日期區間查詢；澄清媒體報導要標得出來。"""
    rows = [
        _row("2330", "1151002", "173000", "澄清媒體報導"),
        _row("2330", "1151005", "150501", "公告本公司取得\n機器設備"),
        _row("2317", "1151005", "70003"),
    ]
    store(tmp_path, date(2026, 10, 5), parse(_api_body(rows[:1]), _API_URL), _API_URL)
    store(tmp_path, date(2026, 10, 6), parse(_api_body(rows), _API_URL), _API_URL)  # 同一則出現在兩期

    items = load_announcements(tmp_path)
    assert len(items) == 3
    assert [a.day for a in items] == sorted(a.day for a in items)
    tsmc = between(items, "2330", date(2026, 10, 1), date(2026, 10, 5))
    assert [a.subject for a in tsmc] == ["澄清媒體報導", "公告本公司取得機器設備"]
    assert [a.clarification for a in tsmc] == [True, False]
    assert tsmc[1].time == "15:05:01"
    assert between(items, "2330", date(2026, 10, 3), date(2026, 10, 4)) == []
    assert load_announcements(tmp_path / "missing") == ()
