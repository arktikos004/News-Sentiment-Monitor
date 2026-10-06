from datetime import date, timedelta
from pathlib import Path

import pytest

from newssent.config import ALERT_SCORER, ALERT_UNIVERSE
from newssent.data import mops
from newssent.data.score_store import ScoreStore
from tests.alert_helpers import CALM_DAYS, fill, weekdays

SESSIONS = weekdays(date(2025, 3, 3), 24)
AS_OF = SESSIONS[-1].isoformat()


def _client_with_store(store: ScoreStore, mops_dir: Path):
    from fastapi.testclient import TestClient

    from newssent.api.main import app

    with TestClient(app) as client:
        app.state.limiter.enabled = False
        app.state.analyzer = None
        # 覆蓋 lifespan 開的真實分數庫，改用測試專用的暫存庫
        app.state.score_store = store
        # 重大訊息也改用暫存目錄（不受本機是否取出 mops-data 影響）
        app.state.mops_dir = mops_dir
        yield client


def _roc(day: date) -> str:
    return f"{day.year - 1911}{day:%m%d}"


def _announce(mops_dir: Path, issued: date, rows: list[tuple[str, date, str]]) -> None:
    """寫一期重大訊息：rows 為 (公司代號, 發言日期, 主旨)。"""
    raw = [
        {
            "出表日期": _roc(issued),
            "發言日期": _roc(said),
            "發言時間": "173000",
            "公司代號": code,
            "公司名稱": code,
            "主旨": subject,
            "符合條款": "第51款",
            "事實發生日": _roc(said),
        }
        for code, said, subject in rows
    ]
    mops.store(mops_dir, issued, raw, "https://example.invalid/t187ap04_L")


@pytest.fixture
def announced_client(tmp_path):
    """2330 在對照區間（當日往前 3 個交易日）內外各一則；2317 只有當日一則。"""
    store = ScoreStore(tmp_path / "alerts.db")
    fill(store, "2330.TW", SESSIONS, ["negative"] * 3, ALERT_SCORER)
    fill(store, "2317.TW", SESSIONS, CALM_DAYS[0], ALERT_SCORER)
    mops_dir = tmp_path / "mops"
    _announce(mops_dir, SESSIONS[-3], [("2330", SESSIONS[-4], "公告本公司董事會決議")])
    _announce(mops_dir, SESSIONS[-1], [("2330", SESSIONS[-2], "澄清工商時報報導"), ("2317", SESSIONS[-1], "公告取得設備")])
    yield from _client_with_store(store, mops_dir)
    store.close()


@pytest.fixture
def alert_client(tmp_path):
    store = ScoreStore(tmp_path / "alerts.db")
    fill(store, "2330.TW", SESSIONS, ["negative"] * 3, ALERT_SCORER)
    fill(store, "2317.TW", SESSIONS, CALM_DAYS[0], ALERT_SCORER)
    yield from _client_with_store(store, tmp_path / "no-mops")
    store.close()


@pytest.fixture
def empty_alert_client(tmp_path):
    store = ScoreStore(tmp_path / "empty.db")
    yield from _client_with_store(store, tmp_path / "no-mops")
    store.close()


def test_alerts_lists_only_triggered_stocks_by_default(alert_client):
    r = alert_client.get(f"/api/alerts?as_of={AS_OF}")
    assert r.status_code == 200
    body = r.json()
    assert [a["ticker"] for a in body["alerts"]] == ["2330.TW"]
    top = body["alerts"][0]
    assert top["level"] == "high"
    assert top["score_today"] == -1.0
    assert top["z_score"] < -2
    assert top["score_change"] < 0
    assert len(top["recent"]) == 5
    assert len(top["evidence"]) == 3
    # 佐證標題要能標示來源並連回原文（標題的著作權屬原媒體；網站不轉載內文）
    assert all(e["source"] == "測試社" for e in top["evidence"])
    assert all(e["url"].startswith(f"https://example.invalid/2330.TW/{AS_OF}/") for e in top["evidence"])
    assert body["summary"] == {"high": 1, "watch": 0, "normal": 1, "insufficient": len(ALERT_UNIVERSE) - 2}
    assert body["universe_size"] == len(ALERT_UNIVERSE)
    assert body["window_closed"] is True
    assert body["scorer"] == ALERT_SCORER


def test_alerts_attach_company_announcements(announced_client):
    """新聞與公告對照：只算當日往前 3 個交易日（含當日）的重大訊息，並標出澄清媒體報導。"""
    body = announced_client.get(f"/api/alerts?as_of={AS_OF}&include_all=true").json()
    by_ticker = {a["ticker"]: a["announcements"] for a in body["alerts"]}
    tsmc = by_ticker["2330.TW"]
    assert (tsmc["window_start"], tsmc["window_end"]) == (SESSIONS[-3].isoformat(), AS_OF)
    assert (tsmc["data_since"], tsmc["data_through"]) == (SESSIONS[-4].isoformat(), SESSIONS[-1].isoformat())
    assert tsmc["count"] == 1
    [item] = tsmc["items"]
    assert item == {
        "day": SESSIONS[-2].isoformat(),
        "time": "17:30:00",
        "subject": "澄清工商時報報導",
        "clause": "第51款",
        "clarification": True,
    }
    assert by_ticker["2317.TW"]["count"] == 1
    assert by_ticker["2412.TW"]["count"] == 0 and by_ticker["2412.TW"]["items"] == []


def test_announcements_are_null_without_any_announcement_data(alert_client):
    """還沒有累積公告資料時不能說成「近 3 日沒有公告」：整個欄位是 null。"""
    body = alert_client.get(f"/api/alerts?as_of={AS_OF}").json()
    assert body["alerts"][0]["announcements"] is None


def test_include_all_lists_insufficient_with_reason(alert_client):
    body = alert_client.get(f"/api/alerts?as_of={AS_OF}&include_all=true").json()
    assert len(body["alerts"]) == len(ALERT_UNIVERSE)
    assert body["alerts"][0]["ticker"] == "2330.TW"
    insufficient = [a for a in body["alerts"] if a["level"] == "insufficient"]
    assert insufficient
    assert all(a["reason"] for a in insufficient)


def test_non_trading_day_returns_422(alert_client):
    saturday = SESSIONS[0] - timedelta(days=2)
    r = alert_client.get(f"/api/alerts?as_of={saturday.isoformat()}")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INVALID_SESSION"


def test_empty_store_returns_503(empty_alert_client):
    r = empty_alert_client.get("/api/alerts")
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "ALERT_DATA_UNAVAILABLE"


def test_sessions_cover_confirmed_days_and_default_as_of(alert_client):
    r = alert_client.get("/api/alerts/sessions")
    assert r.status_code == 200
    body = r.json()
    sessions = [date.fromisoformat(s) for s in body["sessions"]]
    assert sessions == sorted(set(sessions))
    assert set(SESSIONS) <= set(sessions)
    assert all(s.weekday() < 5 for s in sessions)
    # 前端拿 latest 當預設日，必須和 /api/alerts 省略 as_of 時是同一天
    assert body["latest"] == body["sessions"][-1]
    assert alert_client.get("/api/alerts").json()["as_of"] == body["latest"]


def test_sessions_empty_store_returns_503(empty_alert_client):
    r = empty_alert_client.get("/api/alerts/sessions")
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "ALERT_DATA_UNAVAILABLE"
