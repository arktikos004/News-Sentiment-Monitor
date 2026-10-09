"""GET /api/alerts：某交易日全池的情緒異常預警（預設只列 high / watch）；
GET /api/alerts/sessions：可查詢的交易日清單（前端切換日期用，避免猜到非交易日而收到 422）。"""

from collections import Counter
from dataclasses import asdict
from datetime import date, datetime, timezone

from fastapi import APIRouter, Query, Request

from newssent.api.errors import AlertDataUnavailableError, InvalidSessionError
from newssent.api.schemas import (
    AlertEvidence,
    AlertPanelResponse,
    AlertSessionsResponse,
    AlertsResponse,
    AlertSummary,
    AlertWhatIfResponse,
    Announcement,
    AnnouncementCheck,
    DailySentimentPoint,
    PanelIndustry,
    PanelTicker,
    StockAlert,
)
from newssent.config import (
    ALERT_ANNOUNCEMENT_SESSIONS,
    ALERT_INDUSTRY,
    ALERT_SCORER,
    ALERT_UNIVERSE,
    MOPS_DATA_DIR,
)
from newssent.data import mops
from newssent.data.score_store import ScoreStore
from newssent.inference.alert_board import TickerAlert, build_board
from newssent.inference.alerts import AlertLevel, AlertParams, extend_sessions, session_open
from newssent.inference.panel import WHATIF_BASELINE, assess_at, load_panel, whatif

PANEL_SESSIONS = 60  # 產業儀表板與 what-if 涵蓋的交易日數

router = APIRouter(prefix="/api", tags=["alerts"])

TRIGGERED = (AlertLevel.HIGH, AlertLevel.WATCH)


def _round(value: float | None) -> float | None:
    return None if value is None else round(value, 4)


def _announcements(
    items: tuple[mops.Announcement, ...], ticker: str, window: list[date], missing: list[date]
) -> AnnouncementCheck | None:
    """新聞與公告對照：區間（window 的交易日）內該公司的重大訊息。
    還沒有任何公告資料時回 None；區間內有漏收的日子時一併列出——兩者都不能說成「沒有公告」。"""
    if not items:
        return None
    start, end = window[0], window[-1]
    found = mops.between(items, ticker.removesuffix(".TW"), start, end)
    return AnnouncementCheck(
        window_start=start,
        window_end=end,
        data_since=items[0].day,
        data_through=items[-1].day,
        missing_days=missing,
        count=len(found),
        items=[
            Announcement(day=a.day, time=a.time, subject=a.subject, clause=a.clause, clarification=a.clarification)
            for a in found
        ],
    )


def _to_item(alert: TickerAlert, announcements: AnnouncementCheck | None = None) -> StockAlert:
    a = alert.assessment
    return StockAlert(
        ticker=alert.ticker,
        name=alert.name,
        level=a.level.value,
        reason=a.reason,
        z_score=_round(a.z),
        score_today=_round(a.score),
        baseline_mean=_round(a.baseline_mean),
        baseline_std=_round(a.baseline_std),
        score_change=_round(a.change),
        article_count=a.n,
        baseline_days=a.baseline_days,
        recent_score=_round(a.recent_score),
        recent=[
            DailySentimentPoint(session=d.session, score=_round(d.score), article_count=d.n)
            for d in a.recent
        ],
        evidence=[
            AlertEvidence(
                title=e.title,
                source=e.source,
                url=e.url,
                published_at=e.published_at.isoformat(),
                score=_round(e.score),
            )
            for e in alert.evidence
        ],
        announcements=announcements,
    )


def _calendar(store: ScoreStore, now: datetime) -> list[date]:
    """已確認交易日＋推估到下一個尚未開盤的交易日；分數庫沒有交易日就無從判斷（503）。"""
    confirmed = store.sessions()
    if not confirmed:
        raise AlertDataUnavailableError()
    return extend_sessions(confirmed, now)


@router.get("/alerts/sessions", response_model=AlertSessionsResponse)
def get_alert_sessions(request: Request) -> AlertSessionsResponse:
    sessions = _calendar(request.app.state.score_store, datetime.now(timezone.utc))
    return AlertSessionsResponse(sessions=sessions, latest=sessions[-1])


_PANEL_AS_OF = Query(None, description="面板的最後一個交易日 YYYY-MM-DD；省略＝最近一個交易日（同 /api/alerts）")


def _panel_window(store: ScoreStore, now: datetime, as_of: date | None) -> tuple[list[date], range]:
    """截至 as_of 的最近 PANEL_SESSIONS 個交易日，再往前多讀最長基準期所需的交易日。
    回傳（讀取範圍, 評估日的索引）。"""
    calendar = _calendar(store, now)
    if as_of is None:
        as_of = calendar[-1]
    elif as_of not in calendar:
        raise InvalidSessionError(as_of.isoformat())
    calendar = calendar[: calendar.index(as_of) + 1]
    start = max(1, len(calendar) - PANEL_SESSIONS)
    lo = max(0, start - max(WHATIF_BASELINE) - 1)
    sessions = calendar[lo:]
    return sessions, range(start - lo, len(sessions))


@router.get("/alerts/panel", response_model=AlertPanelResponse)
def get_alert_panel(request: Request, as_of: date | None = _PANEL_AS_OF) -> AlertPanelResponse:
    """全池逐日面板（產業情緒儀表板用）：每檔每天的分數、則數、z 值與等級，線上預設參數。"""
    store: ScoreStore = request.app.state.score_store
    now = datetime.now(timezone.utc)
    sessions, eval_idx = _panel_window(store, now, as_of)
    panel = load_panel(store, ALERT_UNIVERSE, ALERT_SCORER, sessions)
    params = AlertParams()
    tickers = []
    for ticker, name in ALERT_UNIVERSE.items():
        days = [assess_at(panel[ticker], sessions, i, params, now.date()) for i in eval_idx]
        tickers.append(
            PanelTicker(
                ticker=ticker,
                name=name,
                industry=ALERT_INDUSTRY[ticker],
                score=[_round(d.score) for d in days],
                n=[d.n for d in days],
                z=[_round(d.z) for d in days],
                level=[d.level.value for d in days],
            )
        )
    groups: dict[str, list[str]] = {}
    for ticker in ALERT_UNIVERSE:
        groups.setdefault(ALERT_INDUSTRY[ticker], []).append(ticker)
    industries = [
        PanelIndustry(name=name, tickers=members)
        for name, members in sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0]))
    ]
    return AlertPanelResponse(
        sessions=[sessions[i] for i in eval_idx],
        scorer=ALERT_SCORER,
        params=asdict(params),
        industries=industries,
        tickers=tickers,
    )


@router.get("/alerts/whatif", response_model=AlertWhatIfResponse)
def get_alert_whatif(request: Request, as_of: date | None = _PANEL_AS_OF) -> AlertWhatIfResponse:
    """警示門檻 what-if：基準天數 × 最少則數 × z 門檻的格點上，逐日會有幾檔示警。"""
    store: ScoreStore = request.app.state.score_store
    now = datetime.now(timezone.utc)
    sessions, eval_idx = _panel_window(store, now, as_of)
    panel = load_panel(store, ALERT_UNIVERSE, ALERT_SCORER, sessions)
    return AlertWhatIfResponse(scorer=ALERT_SCORER, **whatif(panel, sessions, eval_idx, now.date()))


@router.get("/alerts", response_model=AlertsResponse)
def get_alerts(
    request: Request,
    as_of: date | None = Query(
        None, description="交易日 YYYY-MM-DD；省略＝最近一個交易日（可能尚未開盤、標題仍在累積）"
    ),
    include_all: bool = Query(False, description="true 時連 normal / insufficient 也列出"),
) -> AlertsResponse:
    store: ScoreStore = request.app.state.score_store
    now = datetime.now(timezone.utc)
    sessions = _calendar(store, now)
    if as_of is None:
        as_of = sessions[-1]
    elif as_of not in sessions:
        raise InvalidSessionError(as_of.isoformat())

    params = AlertParams()
    board = build_board(store, ALERT_UNIVERSE, ALERT_SCORER, sessions, as_of, params, today_utc=now.date())
    counts = Counter(alert.assessment.level for alert in board)
    shown = board if include_all else [a for a in board if a.assessment.level in TRIGGERED]
    announced = mops.load_announcements(getattr(request.app.state, "mops_dir", MOPS_DATA_DIR))
    idx = sessions.index(as_of)
    window = sessions[max(0, idx - ALERT_ANNOUNCEMENT_SESSIONS + 1) : idx + 1]
    missing = mops.missing_days(announced, window)
    return AlertsResponse(
        as_of=as_of,
        window_closed=now >= session_open(as_of),
        scorer=ALERT_SCORER,
        params=asdict(params),
        universe_size=len(board),
        summary=AlertSummary(**{level.value: counts.get(level, 0) for level in AlertLevel}),
        alerts=[_to_item(a, _announcements(announced, a.ticker, window, missing)) for a in shown],
    )
