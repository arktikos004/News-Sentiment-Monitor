"""全池逐日面板與門檻 what-if：必須和看板（assess_ticker／build_board）逐日一致。

面板為了效率改成每檔一次讀完整段標題、再逐日切片；這裡把它和原本逐日查資料庫的路徑逐值比對，
並確認 what-if 在預設參數（基準 20 日、最少 2 則、z < −1.5）重現看板每天的示警檔數。
"""

import random
from datetime import date, timedelta

import pytest

from newssent.config import ALERT_INDUSTRY, ALERT_SCORER, ALERT_UNIVERSE
from newssent.data.finmind_news import FINMIND_PROVIDER
from newssent.data.provider import Article
from newssent.data.score_store import ScoreStore, utc_days
from newssent.inference.alert_board import assess_ticker, build_board
from newssent.inference.alerts import AlertLevel, AlertParams, session_open
from newssent.inference.panel import (
    WHATIF_BASELINE,
    WHATIF_MIN_ARTICLES,
    WHATIF_Z,
    assess_at,
    load_panel,
    whatif,
)
from tests.alert_helpers import ONE_HOT, weekdays

SESSIONS = weekdays(date(2025, 3, 3), 60)
TODAY = SESSIONS[-1] + timedelta(days=3)
UNIVERSE = {"2330.TW": "台積電", "2317.TW": "鴻海", "2454.TW": "聯發科"}


def _write(store: ScoreStore, ticker: str, seed: int, unfetched: set[date] = frozenset(), extra: int = 0) -> None:
    """每個交易日開盤前隨機 0–4 則標題、隨機標籤；extra＞0 時在最後一個交易日開盤之後再加幾則（不該被算進去）。"""
    rng = random.Random(seed)
    for session in SESSIONS[1:]:
        base = session_open(session) - timedelta(hours=3)
        labels = [rng.choice(["negative", "neutral", "positive", "positive"]) for _ in range(rng.randint(0, 4))]
        articles = [
            Article(title=f"{ticker} {session} #{k}", url=f"https://example.invalid/{ticker}/{session}/{k}",
                    published_at=(base + timedelta(minutes=k)).isoformat(), source="測試社")
            for k in range(len(labels))
        ]
        store.upsert_headlines(ticker, articles, origin="backfill")
        store.save_scores(ticker, ALERT_SCORER, [(a.title, *ONE_HOT[lb]) for a, lb in zip(articles, labels)])
    if extra:
        late = [
            Article(title=f"{ticker} late #{k}", url=f"https://example.invalid/{ticker}/late/{k}",
                    published_at=(session_open(SESSIONS[-1]) + timedelta(hours=1, minutes=k)).isoformat(), source="測試社")
            for k in range(extra)
        ]
        store.upsert_headlines(ticker, late, origin="live")
        store.save_scores(ticker, ALERT_SCORER, [(a.title, *ONE_HOT["negative"]) for a in late])
    for day in utc_days(SESSIONS[0], SESSIONS[-1]):
        if day not in unfetched:
            store.mark_fetched(ticker, day, FINMIND_PROVIDER, 3)
    store.save_sessions(SESSIONS)


@pytest.fixture
def store(tmp_path):
    s = ScoreStore(tmp_path / "alerts.db")
    _write(s, "2330.TW", seed=1)
    _write(s, "2317.TW", seed=2, unfetched={SESSIONS[30], SESSIONS[31] + timedelta(days=1)})
    _write(s, "2454.TW", seed=3)
    yield s
    s.close()


def test_industry_mapping_covers_the_universe():
    assert set(ALERT_INDUSTRY) == set(ALERT_UNIVERSE)


@pytest.mark.parametrize("params", [AlertParams(), AlertParams(baseline_sessions=10, min_articles=1, min_baseline_days=5)])
def test_panel_matches_assess_ticker_on_every_session(store, params):
    panel = load_panel(store, UNIVERSE, ALERT_SCORER, SESSIONS)
    for ticker, name in UNIVERSE.items():
        for idx in range(1, len(SESSIONS)):
            expected = assess_ticker(store, ticker, name, ALERT_SCORER, SESSIONS, SESSIONS[idx], params, TODAY).assessment
            got = assess_at(panel[ticker], SESSIONS, idx, params, TODAY)
            assert (got.level, got.z, got.n, got.score, got.baseline_days) == (
                expected.level, expected.z, expected.n, expected.score, expected.baseline_days
            ), (ticker, SESSIONS[idx])
    # 沒抓齊新聞的日子：兩條路徑都判為資料不足
    assert assess_at(panel["2317.TW"], SESSIONS, 31, params, TODAY).level == AlertLevel.INSUFFICIENT


def test_whatif_default_point_reproduces_the_board(store):
    out = whatif(load_panel(store, UNIVERSE, ALERT_SCORER, SESSIONS), SESSIONS, range(25, len(SESSIONS)), TODAY)
    b, m, z = (out["grid"]["baseline"].index(20), out["grid"]["min_articles"].index(2), out["grid"]["z"].index(-1.5))
    for k, idx in enumerate(range(25, len(SESSIONS))):
        board = build_board(store, UNIVERSE, ALERT_SCORER, SESSIONS, SESSIONS[idx], AlertParams(), TODAY)
        triggered = sum(a.assessment.level in (AlertLevel.HIGH, AlertLevel.WATCH) for a in board)
        judged = sum(a.assessment.level != AlertLevel.INSUFFICIENT for a in board)
        assert out["counts"][b][m][z][k] == triggered, SESSIONS[idx]
        assert out["judged"][b][m][k] == judged
    assert out["sessions"] == [s.isoformat() for s in SESSIONS[25:]]
    assert out["default"] == {"baseline": 20, "min_articles": 2, "z": -1.5}


def test_whatif_counts_move_the_right_way(store):
    out = whatif(load_panel(store, UNIVERSE, ALERT_SCORER, SESSIONS), SESSIONS, range(45, len(SESSIONS)), TODAY)
    for bi in range(len(WHATIF_BASELINE)):
        for mi in range(len(WHATIF_MIN_ARTICLES)):
            per_z = out["counts"][bi][mi]
            for loose, strict in zip(per_z, per_z[1:]):  # z 越負越嚴：示警檔數只會變少或不變
                assert all(a >= b for a, b in zip(loose, strict))
            assert all(c <= j for c, j in zip(per_z[0], out["judged"][bi][mi]))
    assert list(WHATIF_Z) == sorted(WHATIF_Z, reverse=True)


@pytest.mark.leakage
def test_headlines_after_the_open_do_not_change_that_session(tmp_path):
    """交易日 s 只用 s 開盤前的標題：開盤之後才發布的負面標題不影響 s 的判斷。"""
    plain, late = ScoreStore(tmp_path / "a.db"), ScoreStore(tmp_path / "b.db")
    _write(plain, "2330.TW", seed=9)
    _write(late, "2330.TW", seed=9, extra=6)
    a = load_panel(plain, {"2330.TW": "台積電"}, ALERT_SCORER, SESSIONS)["2330.TW"]
    b = load_panel(late, {"2330.TW": "台積電"}, ALERT_SCORER, SESSIONS)["2330.TW"]
    for idx in range(1, len(SESSIONS)):
        assert assess_at(a, SESSIONS, idx, AlertParams(), TODAY) == assess_at(b, SESSIONS, idx, AlertParams(), TODAY)
    plain.close()
    late.close()
