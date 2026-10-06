"""蒸餾初步實驗的守門測試：切分不能洩漏、標籤不能轉錯、學生的輸入要與教師一致、判定方向不能寫反。

不連網、不需 GPU、不載入 torch（學生模型只在 tools/distill_pilot.py 的 run() 裡訓練）。
"""

from __future__ import annotations

import math
import tempfile
from datetime import date, timedelta, timezone
from pathlib import Path

import numpy as np
import pytest

from newssent.config import ALERT_SCORER, LABEL_NAMES
from newssent.data.provider import Article
from newssent.data.score_store import ScoreStore
from newssent.inference.alert_recorder import scoring_target
from newssent.inference.alerts import session_open
from newssent.text.preprocess import build_target_text
from tests.alert_helpers import CALM_DAYS, weekdays
from tools import distill_pilot as dp


def _row(title: str, published_at: str, label: int = 1, ticker: str = "2330.TW") -> dp.Row:
    return dp.Row(ticker, title, published_at, label)


def _dev_rows(n_groups: int = 60) -> list[dp.Row]:
    """切點之前的合成標題：每則都在另一檔個股底下出現一個只差標點與空白的版本，三類輪流。"""
    rows = []
    for g in range(n_groups):
        rows.append(_row(f"標題{g}號，營收創新高", "2026-09-01T01:00:00+00:00", g % 3, "2330.TW"))
        rows.append(_row(f"標題{g}號 營收創新高！", "2026-09-02T01:00:00+00:00", g % 3, "2317.TW"))
    return rows


# --- 標籤與輸入 ---


def test_teacher_label_follows_label_order():
    assert [dp.teacher_label(*p) for p in [(1, 0, 0), (0, 1, 0), (0, 0, 1)]] == [0, 1, 2]
    assert LABEL_NAMES[dp.teacher_label(1.0, 0.0, 0.0)] == "negative"


@pytest.mark.parametrize("probs", [(0.0, 0.0, 0.0), (0.5, 0.5, 0.0)])
def test_teacher_label_refuses_to_guess_ties(probs):
    with pytest.raises(ValueError):
        dp.teacher_label(*probs)


def test_model_input_uses_the_same_target_as_the_teacher():
    # 教師評分時收到的目標字串由 test_alert_pipeline 把關；這裡確認學生用的是同一個函式的輸出
    assert scoring_target("2330.TW", "台積電") == "台積電（2330）"
    row = _row("台積電法說會釋利多", "2026-09-01T01:00:00+00:00")
    assert dp.model_input(row) == build_target_text("台積電（2330）", "台積電法說會釋利多")


def test_load_rows_reads_only_the_teacher_and_skips_price_reports(tmp_path):
    db = tmp_path / "alerts.db"
    store = ScoreStore(db)
    store.upsert_headlines(
        "2330.TW",
        [
            Article("台積電8月營收創新高", "", "2026-09-01T09:00:00+08:00", "測試社"),
            Article("台積電跌40元", "", "2026-09-01T10:00:00+08:00", "測試社"),
            Article("台積電擴產", "", "2026-09-01T11:00:00+08:00", "測試社"),
        ],
        origin="backfill",
    )
    store.save_scores("2330.TW", ALERT_SCORER, [("台積電8月營收創新高", 0, 0, 1), ("台積電跌40元", 1, 0, 0)])
    store.save_scores("2330.TW", "llm-other", [("台積電擴產", 0, 1, 0)])
    store.close()

    rows, n_price = dp.load_rows(db)
    assert [(r.title, r.label, r.published_at) for r in rows] == [
        ("台積電8月營收創新高", 2, "2026-09-01T01:00:00+00:00")
    ]
    assert n_price == 1


# --- 切分（洩漏防治，進推送前閘門） ---


def test_title_group_ignores_punctuation_spacing_width_and_case():
    assert dp.title_group("台積電 法說會，營收創新高！") == dp.title_group("台積電法說會營收創新高")
    assert dp.title_group("ＡＩ伺服器") == dp.title_group("ai 伺服器")
    assert dp.title_group("台積電") != dp.title_group("聯電")


@pytest.mark.leakage
def test_only_rows_after_the_cut_are_test():
    rows = _dev_rows() + [_row(f"新標題{i}", "2026-09-23T01:00:00+00:00", i % 3) for i in range(9)]
    s = dp.split_rows(rows)
    assert s.test == [i for i, r in enumerate(rows) if r.published_at >= dp.TEST_START]
    assert all(rows[i].published_at < dp.TEST_START for i in s.train + s.val)


@pytest.mark.leakage
def test_title_straddling_the_cut_goes_entirely_to_test():
    rows = _dev_rows() + [
        _row("鴻海AI伺服器出貨", "2026-09-21T23:59:59+00:00", 2, "2317.TW"),  # 切點前一秒
        _row("鴻海 AI 伺服器出貨！", dp.TEST_START, 2, "2382.TW"),  # 切點當下算測試
    ]
    s = dp.split_rows(rows)
    assert {len(rows) - 2, len(rows) - 1} <= set(s.test)
    assert dp.split_summary(rows, s)["test_rows_before_cut"] == 1


@pytest.mark.leakage
def test_same_title_never_spans_train_and_val():
    rows = _dev_rows()
    s = dp.split_rows(rows)
    train_groups = {dp.title_group(rows[i].title) for i in s.train}
    val_groups = {dp.title_group(rows[i].title) for i in s.val}
    assert s.val and not train_groups & val_groups


@pytest.mark.leakage
def test_every_row_lands_in_exactly_one_set_and_split_is_reproducible():
    rows = _dev_rows(61) + [_row("新標題", "2026-10-01T01:00:00+00:00")]
    a, b = dp.split_rows(rows), dp.split_rows(rows)
    assert sorted(a.train + a.val + a.test) == list(range(len(rows)))
    assert (a.train, a.val, a.test) == (b.train, b.val, b.test)


# --- 基準、判定與每日分數 ---


def test_char_tfidf_keeps_label_columns_when_a_class_is_missing():
    texts = ["台積電營收創新高", "台積電獲利成長", "聯電營收衰退", "聯電獲利衰退"] * 3
    labels = [2, 2, 0, 0] * 3  # 訓練資料沒有 neutral
    proba = dp.CharTfidfModel().fit(texts, labels).predict_proba(["台積電營收創新高"])
    assert proba.shape == (1, 3)
    assert proba[0, 1] == 0.0 and proba[0].argmax() == 2


@pytest.mark.parametrize(
    ("kappa", "neg_recall", "expected"),
    [
        (0.60, 0.80, "初步可行"),  # 恰好等於門檻算通過
        (0.72, 0.95, "初步可行"),
        (0.72, 0.79, "部分可行"),
        (0.59, 0.99, "不可行"),
        (math.nan, 0.99, "不可行"),
    ],
)
def test_verdict_follows_preregistered_thresholds(kappa, neg_recall, expected):
    assert dp.verdict(kappa, neg_recall).startswith(expected)


def _daily_rows(sessions: list[date], last_day_labels: list[str]) -> list[dp.Row]:
    """與 alert_helpers.fill 同樣的節奏：平靜日交錯，最後一個交易日換成 last_day_labels。"""
    rows = []
    for i, session in enumerate(sessions[1:], start=1):
        labels = last_day_labels if i == len(sessions) - 1 else CALM_DAYS[i % 2]
        base = session_open(session) - timedelta(hours=2)
        for k, label in enumerate(labels):
            published = (base + timedelta(minutes=k)).astimezone(timezone.utc).isoformat(timespec="seconds")
            rows.append(dp.Row("2330.TW", f"{session} #{k}", published, LABEL_NAMES.index(label)))
    return rows


def test_daily_comparison_counts_an_alert_the_student_misses():
    sessions = weekdays(date(2026, 8, 3), 45)  # 至 2026-10-02；切點後完整的交易日為 9/23 起 8 天
    rows = _daily_rows(sessions, ["negative", "negative", "negative"])
    teacher = np.eye(3)[[r.label for r in rows]]
    student = teacher.copy()
    student[-3:] = np.eye(3)[[1, 1, 1]]  # 學生把最後一天的三則負面都判成中性

    res = dp.daily_comparison(rows, teacher, student, sessions, dp.TEST_START)
    assert res["test_sessions"][0] == "2026-09-23" and len(res["test_sessions"]) == 8
    assert (res["teacher_alerts"], res["student_alerts"], res["both_alerts"]) == (1, 0, 0)
    assert res["levels"] == {"high→normal": 1, "normal→normal": 7}


# --- 輸出位置與資料快照 ---


def test_out_dir_inside_the_repo_is_refused(tmp_path):
    db = tmp_path / "alerts.db"
    ScoreStore(db).close()
    with pytest.raises(SystemExit):
        dp.main(["--db", str(db), "--out", str(dp.REPO_ROOT / "distill_out"), "--split-only"])


def test_snapshot_hash_mismatch_stops_the_run(tmp_path):
    db = tmp_path / "alerts.db"
    ScoreStore(db).close()
    outside = Path(tempfile.gettempdir()) / "distill-pilot-test-never-written"
    assert dp.main(["--db", str(db), "--out", str(outside), "--expect-sha256", "0" * 64]) == 1
    assert not outside.exists()
