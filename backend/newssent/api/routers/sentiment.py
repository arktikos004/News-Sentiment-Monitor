from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Request

from newssent.api.deps import get_valid_ticker
from newssent.api.errors import NewsNotFoundError, NewsSourceUnavailableError
from newssent.api.schemas import IndexMethod, KeywordScore, NewsItem, NewsResponse, SentimentResponse
from newssent.config import (
    NEWS_DEFAULT_LIMIT,
    SENTIMENT_LABEL_THRESHOLD,
    SENTIMENT_MIN_ARTICLES,
    SENTIMENT_MIN_POLAR,
    SENTIMENT_SCOPE,
    SENTIMENT_WEIGHTING,
    company_name,
)
from newssent.data.provider import NewsProvider, NewsProviderError, NewsResult
from newssent.inference.analyzer import Analyzer, counted
from newssent.inference.relevance import aliases

INDEX_METHOD = IndexMethod(
    scope=SENTIMENT_SCOPE,
    weighting=SENTIMENT_WEIGHTING,
    min_articles=SENTIMENT_MIN_ARTICLES,
    min_polar=SENTIMENT_MIN_POLAR,
    threshold=SENTIMENT_LABEL_THRESHOLD,
)

router = APIRouter(prefix="/api/stocks", tags=["sentiment"])


def _fetch_news(request: Request, ticker: str, limit: int) -> NewsResult:
    provider: NewsProvider = request.app.state.news_provider
    try:
        result = provider.get_news(ticker, limit)
    except NewsProviderError as exc:
        raise NewsSourceUnavailableError(str(exc)) from exc
    if not result.articles:
        raise NewsNotFoundError(ticker)
    return result


@router.get("/{ticker}/news", response_model=NewsResponse)
def get_news(
    request: Request,
    ticker: str = Depends(get_valid_ticker),
    limit: int = Query(NEWS_DEFAULT_LIMIT, ge=1, le=100),
) -> NewsResponse:
    result = _fetch_news(request, ticker, limit)
    rel, in_index = counted(ticker, result.articles)
    target = {"target_name": company_name(ticker), "target_aliases": aliases(ticker)}

    def item(article, sentiment: str, confidence: float, i: int) -> NewsItem:
        return NewsItem(
            title=article.title,
            url=article.url,
            source=article.source,
            published_at=article.published_at,
            sentiment=sentiment,
            confidence=confidence,
            direct=rel[i].direct,
            in_index=in_index[i],
            mentioned_tickers=list(rel[i].mentioned),
            related_tickers=article.related_tickers,
        )

    analyzer: Analyzer | None = getattr(request.app.state, "analyzer", None)
    if analyzer is None:
        # 模型未載入：逐則情緒以 mock 佔位，前端依 is_mock 顯示提示
        items = [item(a, "neutral", 0.5, i) for i, a in enumerate(result.articles)]
        return NewsResponse(ticker=ticker, articles=items, stale=result.stale, is_mock=True, **target)

    classified = analyzer.classify(result.articles, target=company_name(ticker))
    items = [item(c.article, c.label, round(c.confidence, 4), i) for i, c in enumerate(classified)]
    return NewsResponse(ticker=ticker, articles=items, stale=result.stale, is_mock=False, **target)


@router.get("/{ticker}/sentiment", response_model=SentimentResponse)
def get_sentiment(
    request: Request,
    ticker: str = Depends(get_valid_ticker),
    limit: int = Query(NEWS_DEFAULT_LIMIT, ge=1, le=100),
) -> SentimentResponse:
    analyzer: Analyzer | None = getattr(request.app.state, "analyzer", None)
    if analyzer is None:
        # 模型未載入：回 mock 回應，維持 Phase 0 凍結的欄位結構
        return SentimentResponse(
            ticker=ticker,
            score=0.0,
            label="neutral",
            article_count=0,
            keywords=[],
            model_version="mock-0.0.0",
            as_of=datetime.now(timezone.utc).isoformat(),
            stale=False,
            is_mock=True,
        )

    result = _fetch_news(request, ticker, limit)
    analysis = analyzer.analyze(ticker, result.articles)
    return SentimentResponse(
        ticker=ticker,
        score=analysis.index.score,
        label=analysis.index.label,
        article_count=len(result.articles),
        keywords=[KeywordScore(word=w, score=s, count=n) for w, s, n in analysis.keywords],
        model_version=analyzer.version,
        as_of=datetime.now(timezone.utc).isoformat(),
        stale=result.stale,
        is_mock=False,
        index_count=analysis.index.article_count,
        index_counts=analysis.index.counts,
        insufficient=analysis.index.insufficient,
        index_method=INDEX_METHOD,
    )
