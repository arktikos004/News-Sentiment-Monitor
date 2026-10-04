"""YFinanceNewsProvider 單元測試：雙 payload 解析、快取命中、stale 降級。

全部離線（monkeypatch _fetch），不打真實網路。
"""

import pytest

from newssent.data.cache import NewsCache
from newssent.data.provider import (
    Article,
    NewsProviderError,
    YFinanceNewsProvider,
    _to_article,
)


def test_to_article_new_format():
    item = {
        "id": "abc",
        "content": {
            "title": "Apple hits record high",
            "pubDate": "2026-07-10T12:00:00Z",
            "canonicalUrl": {"url": "https://example.com/a"},
            "clickThroughUrl": {"url": "https://example.com/b"},
            "provider": {"displayName": "Reuters"},
        },
    }
    art = _to_article(item)
    assert art == Article(
        title="Apple hits record high",
        url="https://example.com/a",  # canonicalUrl 優先
        published_at="2026-07-10T12:00:00Z",
        source="Reuters",
    )


def test_to_article_new_format_falls_back_to_clickthrough_url():
    item = {"content": {"title": "T", "clickThroughUrl": {"url": "https://example.com/c"}}}
    art = _to_article(item)
    assert art is not None and art.url == "https://example.com/c"


def test_to_article_old_format_epoch_converted():
    item = {
        "title": "Old style news",
        "link": "https://example.com/old",
        "publisher": "Bloomberg",
        "providerPublishTime": 1752192000,  # 2025-07-11T00:00:00Z
    }
    art = _to_article(item)
    assert art is not None
    assert art.published_at.startswith("2025-07-1")
    assert art.published_at.endswith("+00:00")
    assert art.source == "Bloomberg"


def test_to_article_filters_garbage():
    assert _to_article({"content": {"title": "  "}}) is None  # 空標題
    assert _to_article({"title": ""}) is None
    assert _to_article("not a dict") is None


@pytest.fixture
def cache(tmp_path):
    c = NewsCache(tmp_path / "news.db")
    yield c
    c.close()


def _articles(n: int = 2) -> list[Article]:
    return [
        Article(title=f"t{i}", url=f"https://x/{i}", published_at="2026-07-11T00:00:00Z", source="s")
        for i in range(n)
    ]


def test_cache_hit_skips_fetch(cache, monkeypatch):
    provider = YFinanceNewsProvider(cache=cache, bucket_seconds=3600)
    calls = {"n": 0}

    def fake_fetch(ticker, limit):
        calls["n"] += 1
        return _articles()

    monkeypatch.setattr(provider, "_fetch", fake_fetch)

    r1 = provider.get_news("AAPL", limit=5)
    r2 = provider.get_news("AAPL", limit=5)  # 同一時間桶：走快取
    assert calls["n"] == 1
    assert not r1.stale and not r2.stale
    assert [a.title for a in r2.articles] == ["t0", "t1"]


def test_fetch_failure_falls_back_to_stale_cache(cache, monkeypatch):
    provider = YFinanceNewsProvider(cache=cache, bucket_seconds=3600)
    # 先塞一筆「舊時間桶」的快取
    cache.write("AAPL", bucket=1, articles=[a.to_dict() for a in _articles(1)])

    monkeypatch.setattr(
        provider, "_fetch", lambda t, n: (_ for _ in ()).throw(ConnectionError("斷網"))
    )
    result = provider.get_news("AAPL", limit=5)
    assert result.stale is True
    assert result.articles[0].title == "t0"


def test_fetch_failure_without_cache_raises(cache, monkeypatch):
    provider = YFinanceNewsProvider(cache=cache, bucket_seconds=3600)
    monkeypatch.setattr(
        provider, "_fetch", lambda t, n: (_ for _ in ()).throw(ConnectionError("斷網"))
    )
    with pytest.raises(NewsProviderError):
        provider.get_news("TSLA", limit=5)


class _EmptyTicker:
    """2026-10 之後的實況：Yahoo 的個股新聞串流端點回 404，yfinance 不報錯、只回空清單。"""

    def __init__(self, ticker):
        pass

    def get_news(self, count):
        return []


def _fake_search(news):
    class FakeSearch:
        def __init__(self, query, news_count):
            self.news = news

    return FakeSearch


def test_empty_yfinance_response_treated_as_failure(cache, monkeypatch):
    """個股串流與搜尋備援都回空清單才視為失敗（觸發降級），不寫入空快取。"""
    provider = YFinanceNewsProvider(cache=cache, bucket_seconds=3600)
    monkeypatch.setattr("yfinance.Ticker", _EmptyTicker)
    monkeypatch.setattr("yfinance.Search", _fake_search([]))
    with pytest.raises(NewsProviderError):
        provider.get_news("MSFT", limit=5)


def test_empty_ticker_stream_falls_back_to_search_and_keeps_only_related(cache, monkeypatch):
    """個股串流回空 → 改走搜尋端點；搜尋會帶出只是順帶提到的文章，只留 relatedTickers 含該代號者。"""
    search_news = [
        {"title": "TSMC beats", "link": "https://x/1", "publisher": "Reuters",
         "providerPublishTime": 1791102000, "relatedTickers": ["NVDA", "TSM"]},
        {"title": "Unrelated story", "link": "https://x/2", "publisher": "Zacks",
         "providerPublishTime": 1791102100, "relatedTickers": ["AAPL"]},
    ]
    provider = YFinanceNewsProvider(cache=cache, bucket_seconds=3600)
    monkeypatch.setattr("yfinance.Ticker", _EmptyTicker)
    monkeypatch.setattr("yfinance.Search", _fake_search(search_news))

    result = provider.get_news("TSM", limit=5)
    assert not result.stale
    assert [(a.title, a.source, a.url) for a in result.articles] == [("TSMC beats", "Reuters", "https://x/1")]


def test_search_fallback_keeps_everything_when_related_tickers_field_is_absent(cache, monkeypatch):
    search_news = [{"title": "Some story", "link": "https://x/1", "publisher": "CNBC", "providerPublishTime": 1791102000}]
    provider = YFinanceNewsProvider(cache=cache, bucket_seconds=3600)
    monkeypatch.setattr("yfinance.Ticker", _EmptyTicker)
    monkeypatch.setattr("yfinance.Search", _fake_search(search_news))
    assert [a.title for a in provider.get_news("TSM", limit=5).articles] == ["Some story"]


def test_stale_fallback_is_logged_not_silent(cache, monkeypatch, caplog):
    """新聞源失敗退回舊快取時必須留下紀錄——否則排程全綠、網站卻停在舊資料，沒人會發現。"""
    provider = YFinanceNewsProvider(cache=cache, bucket_seconds=3600)
    cache.write("AAPL", bucket=1, articles=[a.to_dict() for a in _articles(1)])
    monkeypatch.setattr(provider, "_fetch", lambda t, n: (_ for _ in ()).throw(ConnectionError("斷網")))
    with caplog.at_level("WARNING", logger="newssent"):
        assert provider.get_news("AAPL", limit=5).stale is True
    assert any("AAPL" in r.getMessage() and "斷網" in r.getMessage() for r in caplog.records)
