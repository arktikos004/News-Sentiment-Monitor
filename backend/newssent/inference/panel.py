"""全池逐日面板：每檔每個交易日的分數、則數與預警判斷——產業情緒儀表板與警示門檻 what-if 共用。

與 alert_board.assess_ticker 同一條計算路徑（排除盤勢報導 → daily_scores → assess；
新聞沒抓齊的日子判為資料不足），差別只在每檔一次讀完整段標題、再對每個交易日切片：
逐日呼叫 assess_ticker 要查上千次資料庫。tests/test_panel.py 把兩者逐日比對，
並確認 what-if 在預設參數下重現看板每天的示警檔數。

what-if 只回答「門檻這樣調，每天會有幾檔示警」（工作量），不重算事件命中率：
換參數後的命中率是新的成效數字，依專案慣例要先寫預先聲明。
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import date, timedelta

from newssent.data.finmind_news import FINMIND_PROVIDER
from newssent.data.score_store import ScoreStore, utc_days
from newssent.inference.alerts import (
    AlertLevel,
    AlertParams,
    Assessment,
    DailyScore,
    assess,
    daily_scores,
    headline_score,
    is_price_report,
    session_open,
)

# what-if 的參數格點（z 由寬到嚴）；線上預設值（基準 20 日、最少 2 則、z < −1.5 示警）必須在格點上
WHATIF_Z = (-1.0, -1.25, -1.5, -1.75, -2.0, -2.25, -2.5, -3.0)
WHATIF_MIN_ARTICLES = (1, 2, 3, 5)
WHATIF_BASELINE = (10, 20, 40)


@dataclass(frozen=True)
class TickerPanel:
    ticker: str
    series: list[DailyScore]  # series[k] 對應 sessions[k + 1]（第一個交易日只當左邊界）
    done: frozenset[date]  # 已抓齊新聞的 UTC 日


def load_panel(store: ScoreStore, universe: dict[str, str], scorer: str, sessions: Sequence[date]) -> dict[str, TickerPanel]:
    """每檔一次讀出 sessions 範圍內的已評分標題，聚合成逐日分數。"""
    start, end = session_open(sessions[0]), session_open(sessions[-1])
    panel = {}
    for ticker in universe:
        rows = [r for r in store.scored_headlines(ticker, scorer, start, end) if not is_price_report(r.title)]
        series = daily_scores(((r.published_at, headline_score(r.p_negative, r.p_positive)) for r in rows), sessions)
        panel[ticker] = TickerPanel(ticker, series, frozenset(store.fetched_days(ticker, FINMIND_PROVIDER)))
    return panel


def assess_at(
    p: TickerPanel, sessions: Sequence[date], idx: int, params: AlertParams, today_utc: date
) -> Assessment:
    """等同 assess_ticker(..., sessions, sessions[idx], params, today_utc).assessment（不含證據標題）。"""
    as_of = sessions[idx]
    lo = max(0, idx - params.baseline_sessions - 1)
    assessment = assess(p.series[lo:idx] or [DailyScore(as_of, None, 0)], params)
    # 沒抓過的日子讀起來和「當天沒新聞」一模一樣，不先排除就會把缺資料誤判成情緒平穩
    missing = [d for d in utc_days(sessions[lo], min(as_of, today_utc - timedelta(days=1))) if d not in p.done]
    if missing:
        assessment = replace(
            assessment,
            level=AlertLevel.INSUFFICIENT,
            z=None,
            reason=f"新聞尚未抓齊：缺 {len(missing)} 個 UTC 日（請先執行 alert_recorder）",
        )
    return assessment


def whatif(
    panel: dict[str, TickerPanel], sessions: Sequence[date], eval_idx: range, today_utc: date
) -> dict:
    """每組（基準天數, 最少則數）× 每個 z 門檻，逐日的示警檔數；另附逐日可判斷（非資料不足）的檔數。

    counts[b][m][z][k]＝第 k 個評估日、z 低於門檻的檔數；judged[b][m][k]＝可判斷的檔數。
    基準期至少要有一半的交易日有新聞（線上預設 20 日中 10 日）。
    """
    counts: list[list[list[list[int]]]] = []
    judged: list[list[list[int]]] = []
    for b in WHATIF_BASELINE:
        counts_b, judged_b = [], []
        for m in WHATIF_MIN_ARTICLES:
            params = AlertParams(baseline_sessions=b, min_articles=m, min_baseline_days=b // 2)
            zs_by_day = [
                [z for p in panel.values() if (z := assess_at(p, sessions, idx, params, today_utc).z) is not None]
                for idx in eval_idx
            ]
            judged_b.append([len(zs) for zs in zs_by_day])
            counts_b.append([[sum(1 for v in zs if v < threshold) for zs in zs_by_day] for threshold in WHATIF_Z])
        counts.append(counts_b)
        judged.append(judged_b)
    default = AlertParams()
    return {
        "sessions": [sessions[idx].isoformat() for idx in eval_idx],
        "grid": {"baseline": list(WHATIF_BASELINE), "min_articles": list(WHATIF_MIN_ARTICLES), "z": list(WHATIF_Z)},
        "default": {"baseline": default.baseline_sessions, "min_articles": default.min_articles, "z": default.watch_z},
        "universe_size": len(panel),
        "counts": counts,
        "judged": judged,
    }
