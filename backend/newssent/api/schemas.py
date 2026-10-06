"""Pydantic 回應模型 — Phase 0 凍結的 API 契約。

前端從第一週就對這份契約開發（先吃 mock 回應），後續 Phase 不應隨意變更
欄位名稱或型別；若需變更，視為破壞性變更並同步通知前端。
"""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

SentimentLabel = Literal["negative", "neutral", "positive"]
AlertLevelName = Literal["high", "watch", "normal", "insufficient"]


class KeywordScore(BaseModel):
    word: str
    score: float


class SentimentResponse(BaseModel):
    ticker: str
    score: float = Field(ge=-1, le=1, description="情緒指數，[−1, +1]")
    label: SentimentLabel
    article_count: int
    keywords: list[KeywordScore]
    model_version: str
    as_of: str = Field(description="資料時間戳（ISO8601）")
    stale: bool = Field(default=False, description="外部新聞源失敗、回傳舊快取時為 True")
    is_mock: bool = Field(default=False, description="Phase 5 模型整合前為 True")


class NewsItem(BaseModel):
    title: str
    url: str
    source: str = Field(default="", description="媒體名稱（資料源提供；沒有時為空字串，前端改顯示網域）")
    published_at: str
    sentiment: SentimentLabel
    confidence: float = Field(ge=0, le=1)


class NewsResponse(BaseModel):
    ticker: str
    articles: list[NewsItem]
    stale: bool = False
    is_mock: bool = False


class ModelInfoResponse(BaseModel):
    model_version: str
    trained_at: str | None = None
    test_macro_f1: float | None = None
    is_mock: bool = Field(default=False, description="Phase 4 前尚未整合真實模型時為 True")


class HealthResponse(BaseModel):
    status: Literal["ok"]
    model_loaded: bool


# --- 情緒異常預警（GET /api/alerts）---


class DailySentimentPoint(BaseModel):
    session: date
    score: float | None = Field(description="該交易日標題平均分數 P(正)−P(負)；null＝當日無標題")
    article_count: int


class AlertEvidence(BaseModel):
    title: str
    source: str
    url: str = Field(default="", description="原文連結：標題的著作權屬原媒體，網站只顯示標題並連回原文")
    published_at: str = Field(description="發布時間（ISO8601，UTC）")
    score: float


class Announcement(BaseModel):
    day: date = Field(description="發言日期")
    time: str = Field(description="發言時間 HH:MM:SS（台北）")
    subject: str = Field(description="主旨（全文請至公開資訊觀測站；說明欄可能含個人資料，本站不收）")
    clause: str = Field(description="符合條款，例如「第51款」")
    clarification: bool = Field(description="主旨含「澄清」：公司澄清媒體報導")


class AnnouncementCheck(BaseModel):
    """新聞與公告對照：預警當日往前 3 個交易日（含當日），公司有沒有發布重大訊息。"""

    window_start: date
    window_end: date
    data_since: date = Field(description="已累積的公告最早發言日：早於此日的區間沒有對照資料")
    data_through: date = Field(description="已累積的公告最新發言日：當天的公告要隔天清晨才出")
    count: int
    items: list[Announcement]


class StockAlert(BaseModel):
    ticker: str
    name: str
    level: AlertLevelName
    reason: str | None = Field(default=None, description="insufficient 時說明缺什麼")
    z_score: float | None
    score_today: float | None = Field(description="當日情緒分數，[−1, +1]")
    baseline_mean: float | None = Field(description="前 20 個交易日分數平均（不含當日）")
    baseline_std: float | None
    score_change: float | None = Field(description="當日分數 − 基準平均")
    article_count: int
    baseline_days: int = Field(description="基準期中有標題的交易日數")
    recent_score: float | None = Field(description="近 5 個交易日依則數加權的分數")
    recent: list[DailySentimentPoint]
    evidence: list[AlertEvidence] = Field(description="當日最負面的標題（最多 3 則），供人工覆核")
    announcements: AnnouncementCheck | None = Field(
        default=None, description="公司重大訊息對照；還沒有累積任何公告資料時為 null"
    )


class AlertSummary(BaseModel):
    high: int
    watch: int
    normal: int
    insufficient: int = Field(description="資料不足、無法判斷的股票數（不等於正常）")


class AlertSessionsResponse(BaseModel):
    sessions: list[date] = Field(description="可查詢的交易日（遞增）；末端可能含推估的未來交易日")
    latest: date = Field(description="GET /api/alerts 省略 as_of 時採用的交易日")


class AlertsResponse(BaseModel):
    as_of: date
    window_closed: bool = Field(description="false＝該交易日尚未開盤，標題仍在累積、結果可能再變")
    scorer: str
    params: dict[str, float]
    universe_size: int
    summary: AlertSummary
    alerts: list[StockAlert]
