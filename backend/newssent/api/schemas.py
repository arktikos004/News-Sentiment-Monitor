"""Pydantic 回應模型 — Phase 0 凍結的 API 契約。

前端（含讀靜態 JSON 的公開站，以及 stock-trend-assistant 的情緒卡）依這份契約讀資料：欄位名稱與型別不要改；
真的要改就是破壞性變更，frontend/lib/api.ts 與 export_static.py 要一起改。

2026-10 起只新增欄位（direct、in_index、mentioned_tickers、related_tickers、target_name、target_aliases、
index_count、index_counts、insufficient、index_method、KeywordScore.count），舊欄位的型別不變。
article_count、sentiment、confidence 的意思不變；score、label、keywords 改成只用計入指數的新聞
（config.SENTIMENT_SCOPE、SENTIMENT_WEIGHTING，見 inference/aggregate.py）。
"""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

SentimentLabel = Literal["negative", "neutral", "positive"]
AlertLevelName = Literal["high", "watch", "normal", "insufficient"]


class KeywordScore(BaseModel):
    word: str
    score: float
    count: int = Field(default=0, description="含這個字的計入標題數")


class IndexMethod(BaseModel):
    scope: Literal["direct", "all"] = Field(description="direct＝只計入標題直接提到公司的新聞；all＝全部收錄的新聞")
    weighting: Literal["equal", "confidence"] = Field(description="equal＝每則同權重；confidence＝以類別機率加權")
    min_articles: int = Field(description="計入少於這個則數時不給整體判斷")
    min_polar: int = Field(description="判為正面或負面至少要有幾則同向")
    threshold: float = Field(description="|score| 超過才判為正面或負面")


class SentimentResponse(BaseModel):
    ticker: str
    score: float = Field(ge=-1, le=1, description="情緒指數，[−1, +1]：只用計入指數的新聞（見 index_method）")
    label: SentimentLabel = Field(description="整體判讀；insufficient 時一律為 neutral")
    article_count: int = Field(description="收錄的新聞則數（含沒有計入指數的）")
    keywords: list[KeywordScore] = Field(description="計入指數的標題的關鍵字，不含公司本身的名稱")
    model_version: str
    as_of: str = Field(description="資料時間戳（ISO8601）")
    stale: bool = Field(default=False, description="外部新聞源失敗、回傳舊快取時為 True")
    is_mock: bool = Field(default=False, description="模型未載入、回應是 mock 時為 True")
    index_count: int | None = Field(default=None, description="計入指數的則數")
    index_counts: dict[str, int] | None = Field(default=None, description="計入的新聞裡 positive／neutral／negative 各幾則")
    insufficient: bool = Field(default=False, description="計入的則數太少，或同向的則數不夠：不給方向判斷")
    index_method: IndexMethod | None = None


class NewsItem(BaseModel):
    title: str
    url: str
    source: str = Field(default="", description="媒體名稱（資料源提供；沒有時為空字串，前端改顯示網域）")
    published_at: str
    sentiment: SentimentLabel
    confidence: float = Field(ge=0, le=1, description="模型輸出的類別機率，沒有校準：不是分類準確率，也不是股價上漲的機率")
    direct: bool = Field(default=True, description="標題提到這家公司（名稱、別名或代號）；ETF 一律為 true")
    in_index: bool = Field(default=True, description="是否計入情緒指數")
    mentioned_tickers: list[str] = Field(default_factory=list, description="標題提到的其他追蹤標的")
    related_tickers: list[str] = Field(default_factory=list, description="資料源（Yahoo 財經）把這則新聞關聯到的代號；舊快取為空")


class NewsResponse(BaseModel):
    ticker: str
    articles: list[NewsItem]
    stale: bool = False
    is_mock: bool = False
    target_name: str = Field(default="", description="模型輸入用的公司名稱")
    target_aliases: list[str] = Field(default_factory=list, description="判斷「標題有沒有提到這家公司」用的字詞")


class ModelInfoResponse(BaseModel):
    model_version: str
    trained_at: str | None = None
    test_macro_f1: float | None = None
    is_mock: bool = Field(default=False, description="模型未載入時為 True")


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
    missing_days: list[date] = Field(
        default_factory=list,
        description="區間內的交易日中整天沒有任何公告資料的日子（那一期漏收）：不能當成公司沒有公告",
    )
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


# --- 產業情緒儀表板（GET /api/alerts/panel）與警示門檻 what-if（GET /api/alerts/whatif）---


class PanelTicker(BaseModel):
    ticker: str
    name: str
    industry: str
    score: list[float | None] = Field(description="逐日情緒分數 [−1, +1]；null＝當日無標題")
    n: list[int] = Field(description="逐日標題則數")
    z: list[float | None] = Field(description="逐日 z 值；null＝資料不足")
    level: list[AlertLevelName]


class PanelIndustry(BaseModel):
    name: str = Field(description="證交所產業別")
    tickers: list[str]


class AlertPanelResponse(BaseModel):
    """全池逐日面板（線上預設參數）：與預警看板同一條計算路徑，只有衍生數值、沒有標題。"""

    sessions: list[date]
    scorer: str
    params: dict[str, float]
    industries: list[PanelIndustry]
    tickers: list[PanelTicker]


class AlertWhatIfResponse(BaseModel):
    """門檻 what-if：每組參數逐日的示警檔數（只算工作量，不重算事件命中率）。"""

    sessions: list[date]
    scorer: str
    grid: dict[str, list[float]] = Field(description="baseline（基準天數）、min_articles（最少則數）、z（門檻，由寬到嚴）")
    default: dict[str, float] = Field(description="線上預設值")
    universe_size: int
    counts: list[list[list[list[int]]]] = Field(description="counts[基準][則數][z][日]＝z 低於門檻的檔數")
    judged: list[list[list[int]]] = Field(description="judged[基準][則數][日]＝可判斷（非資料不足）的檔數")
