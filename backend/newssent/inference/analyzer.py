"""線上情緒分析：新聞標題 → clean_text → 模型逐則情緒 → 聚合指數 + 關鍵字。

Analyzer 不碰網路——新聞由呼叫端經 NewsProvider 取得後傳入；
文字一律走 clean_text() 同一入口，與訓練路徑一致（架構原則 4）。
每一則都判讀；指數與關鍵字只用計入的新聞（config.SENTIMENT_SCOPE：預設只算標題直接提到公司的，見 relevance.py）。
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from newssent.config import ARTIFACTS_DIR, LABEL_NAMES, SENTIMENT_SCOPE, company_name
from newssent.data.provider import Article
from newssent.inference.aggregate import SentimentIndex, sentiment_index
from newssent.inference.keywords import extract_keywords
from newssent.inference.relevance import Relevance, aliases, relevance
from newssent.ml import registry


@dataclass
class ArticleSentiment:
    article: Article
    label: str
    confidence: float  # 模型輸出的類別機率（沒有校準）


@dataclass
class AnalysisResult:
    index: SentimentIndex
    articles: list[ArticleSentiment]
    keywords: list[tuple[str, float, int]]  # (字詞, TF-IDF 分數, 含這個字的計入標題數)
    relevance: list[Relevance]
    in_index: list[bool]


def counted(ticker: str, articles: list[Article], scope: str = SENTIMENT_SCOPE) -> tuple[list[Relevance], list[bool]]:
    """每則新聞與這一檔的相關性，以及是否計入指數（scope＝"all" 時全部計入，舊算法）。"""
    rel = [relevance(ticker, a.title) for a in articles]
    return rel, [scope == "all" or r.direct for r in rel]


class Analyzer:
    def __init__(self, model, metadata: dict[str, Any]):
        self._model = model
        self.metadata = metadata

    @classmethod
    def from_registry(cls, name: str, artifacts_dir: Path = ARTIFACTS_DIR) -> "Analyzer":
        model, metadata = registry.load(name, artifacts_dir)
        return cls(model, metadata)

    @property
    def version(self) -> str:
        return f"{self.metadata['model_name']}-{self.metadata['trained_at'][:10]}"

    @property
    def target_dependent(self) -> bool:
        """目標導向模型的輸入是 (公司, 標題)；舊的句子層級 artifact 無此鍵，預設 False。"""
        return bool(self.metadata.get("target_dependent", False))

    def classify(self, articles: list[Article], target: str | None = None) -> list[ArticleSentiment]:
        from newssent.text.preprocess import build_target_text, clean_text

        if not articles:
            return []
        if self.target_dependent and target:
            # 訓練與推論走同一個 build_target_text（其內部亦呼叫 clean_text），
            # 目標字串少了或多了都會讓輸入分佈與訓練不一致，故只有此一入口。
            texts = [build_target_text(target, a.title) for a in articles]
        else:
            texts = [clean_text(a.title) for a in articles]
        proba = self._model.predict_proba(texts)
        out = []
        for article, p in zip(articles, proba):
            idx = int(p.argmax())
            out.append(
                ArticleSentiment(article=article, label=LABEL_NAMES[idx], confidence=float(p[idx]))
            )
        return out

    def analyze(self, ticker: str, articles: list[Article]) -> AnalysisResult:
        from newssent.text.preprocess import clean_text

        classified = self.classify(articles, target=company_name(ticker))
        rel, in_index = counted(ticker, articles)
        kept = [c for c, keep in zip(classified, in_index) if keep]
        index = sentiment_index([(c.label, c.confidence) for c in kept])
        keywords = extract_keywords([clean_text(c.article.title) for c in kept], ticker, exclude=aliases(ticker))
        return AnalysisResult(index=index, articles=classified, keywords=keywords, relevance=rel, in_index=in_index)
