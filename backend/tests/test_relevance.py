"""新聞與標的的相關性（inference/relevance.py）：整詞比對、分大小寫的別名、代號、ETF，以及已知的誤判。"""

import pytest

from newssent.data.provider import Article, _to_article
from newssent.inference.relevance import aliases, mentioned_tickers, mentions, relevance


@pytest.mark.parametrize(
    ("ticker", "title"),
    [
        ("AAPL", "Apple unveils new iPhone lineup"),
        ("AAPL", "iPhones are selling out in China"),
        ("AAPL", "Is $AAPL a buy after earnings?"),
        ("INTC", "Intel's foundry wins a customer"),
        ("TSM", "Taiwan Semi raises its outlook"),
        ("META", "Meta Platforms adds AI features to Instagram"),
        ("META", "Meta cuts jobs"),
        ("ARM", "Arm Holdings shares jump"),
        ("GOOG", "GOOGL hits a record"),
    ],
)
def test_mentions(ticker, title):
    assert mentions(ticker, title)


@pytest.mark.parametrize(
    ("ticker", "title"),
    [
        ("INTC", "Artificial Intelligence spending keeps rising"),  # 整詞比對：Intelligence 不是 Intel
        ("META", "The metaverse is back"),
        ("META", "Investors look for meta trends"),  # 分大小寫的別名：小寫 meta 不算
        ("ARM", "Investors arm themselves with cash"),
        ("MU", "Mutual funds pile into tech"),  # 代號要是獨立的字
        ("AAPL", "Stocks rally as Fed holds rates"),
    ],
)
def test_does_not_mention(ticker, title):
    assert not mentions(ticker, title)


def test_known_false_positives_are_pinned():
    """只看字面，不判斷公司是不是主角：這些會被算成提到（已知限制，寫在 relevance.py）。"""
    assert mentions("ORCL", "Lessons from the Oracle of Omaha")
    assert mentions("ASX", "ASE board approves new listing rules")
    assert mentions("AAPL", "Samsung beats Apple in shipments")  # 提到了，但主角是 Samsung


def test_etf_is_always_direct():
    assert relevance("QQQ", "Stocks rally as Fed holds rates").direct
    assert relevance("SPY", "Treasury yields climb").direct


def test_mentioned_tickers_excludes_the_target():
    assert mentioned_tickers("Apple and Microsoft lead the Nasdaq; QQQ gains", exclude="AAPL") == ("MSFT", "QQQ")
    rel = relevance("AAPL", "Microsoft and Broadcom rally on AI demand")
    assert not rel.direct and rel.mentioned == ("MSFT", "AVGO")


def test_aliases_include_names_and_ticker():
    assert aliases("AAPL") == ["Apple", "iPhone", "AAPL"]
    assert aliases("META") == ["Meta Platforms", "Facebook", "Instagram", "Meta", "META"]
    assert aliases("QQQ") == ["QQQ"]


def test_related_tickers_from_both_payload_formats():
    old = _to_article({"title": "Apple rallies", "link": "u", "publisher": "p", "providerPublishTime": 0, "relatedTickers": ["AAPL", "MSFT", "AAPL"]})
    assert old.related_tickers == ["AAPL", "MSFT"]
    new = _to_article(
        {"content": {"title": "Apple rallies", "pubDate": "2026-10-01T00:00:00Z", "finance": {"stockTickers": [{"symbol": "AAPL"}, {"symbol": "AVGO"}]}}}
    )
    assert new.related_tickers == ["AAPL", "AVGO"]


def test_old_cache_without_related_tickers_still_loads():
    a = Article.from_dict({"title": "t", "url": "u", "published_at": "2026-10-01T00:00:00Z", "source": "s"})
    assert a.related_tickers == []
    assert Article.from_dict(a.to_dict()) == a
