"""情緒指數：把計入的新聞的逐則判讀，聚合成單一 [−1, +1] 指標。

純函式、參數讀 config，可獨立測試邊界值（全正/全負/空清單/全中性）。
- 每則同權重（config.SENTIMENT_WEIGHTING＝"equal"）：score＝(正面則數 − 負面則數) ÷ 計入則數。
  模型的類別機率沒有校準，不拿來當權重；"confidence" 是 2026-10 之前的算法 Σ(sign × 類別機率) ÷ n，留著可以回退。
- 計入的標題少於 SENTIMENT_MIN_ARTICLES 則，或判為正面／負面的那一方不到 SENTIMENT_MIN_POLAR 則：
  insufficient＝True，判讀維持中性（label 只能是 negative／neutral／positive 三種，別的網站會依它查表）。
- 哪些新聞計入由呼叫端決定（config.SENTIMENT_SCOPE，見 inference/analyzer.py）。
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

from newssent.config import (
    SENTIMENT_LABEL_THRESHOLD,
    SENTIMENT_MIN_ARTICLES,
    SENTIMENT_MIN_POLAR,
    SENTIMENT_SIGN,
    SENTIMENT_WEIGHTING,
)


@dataclass
class SentimentIndex:
    score: float  # [−1, +1]
    label: str  # negative / neutral / positive
    article_count: int  # 計入指數的則數
    insufficient: bool = False  # 則數太少或同向的則數不夠，不給方向判斷
    counts: dict[str, int] = field(default_factory=dict)  # 計入的新聞裡正面、中性、負面各幾則


def sentiment_index(
    labeled: list[tuple[str, float]],
    threshold: float = SENTIMENT_LABEL_THRESHOLD,
    weighting: str = SENTIMENT_WEIGHTING,
    min_articles: int = SENTIMENT_MIN_ARTICLES,
    min_polar: int = SENTIMENT_MIN_POLAR,
) -> SentimentIndex:
    """labeled: [(label, confidence), ...]，只放計入指數的新聞。

    空清單回傳中性、score 0、insufficient。score 超過門檻判正、低於負門檻判負，區間內為中性。
    """
    n = len(labeled)
    counts = Counter(label for label, _ in labeled)
    tally = {k: counts.get(k, 0) for k in ("positive", "neutral", "negative")}
    if n == 0:
        return SentimentIndex(score=0.0, label="neutral", article_count=0, insufficient=True, counts=tally)

    if weighting == "confidence":
        score = sum(SENTIMENT_SIGN.get(label, 0) * confidence for label, confidence in labeled) / n
    else:
        score = (tally["positive"] - tally["negative"]) / n

    label = "positive" if score > threshold else "negative" if score < -threshold else "neutral"
    insufficient = n < min_articles or (label != "neutral" and tally[label] < min_polar)
    if insufficient:
        label = "neutral"
    return SentimentIndex(score=round(score, 4), label=label, article_count=n, insufficient=insufficient, counts=tally)
