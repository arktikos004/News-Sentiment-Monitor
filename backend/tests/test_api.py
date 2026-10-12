def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_model_info_marked_as_mock(client):
    r = client.get("/api/model")
    assert r.status_code == 200
    assert r.json()["is_mock"] is True


def test_news_returns_articles_from_provider(client):
    r = client.get("/api/stocks/AAPL/news")
    assert r.status_code == 200
    body = r.json()
    assert body["ticker"] == "AAPL"
    assert len(body["articles"]) == 4
    assert body["is_mock"] is True
    # 標題的著作權屬原媒體：每一則都要帶媒體名稱與原文連結，前端才能標示來源並連回原文
    assert [a["source"] for a in body["articles"]] == ["Example"] * 4
    assert [a["url"] for a in body["articles"]] == [f"https://example.com/{i}" for i in range(1, 5)]
    # 模型沒載入時，相關性照樣算（只看標題文字）
    assert [a["in_index"] for a in body["articles"]] == [True, True, True, False]


def test_news_lowercase_ticker_normalized(client):
    r = client.get("/api/stocks/aapl/news")
    assert r.status_code == 200
    assert r.json()["ticker"] == "AAPL"


def test_news_invalid_ticker_returns_422(client):
    r = client.get("/api/stocks/../news")
    # 路徑會被 FastAPI 正規化，改用明確非法字元驗證格式檢查
    r = client.get("/api/stocks/TOOLONGXY/news")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INVALID_TICKER_FORMAT"


def test_news_empty_returns_404(empty_client):
    r = empty_client.get("/api/stocks/AAPL/news")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NEWS_NOT_FOUND"


def test_sentiment_mock_shape(client):
    r = client.get("/api/stocks/AAPL/sentiment")
    assert r.status_code == 200
    body = r.json()
    assert body["label"] in ("negative", "neutral", "positive")
    assert -1 <= body["score"] <= 1
    assert body["is_mock"] is True


def test_sentiment_with_loaded_model(client_with_model):
    r = client_with_model.get("/api/stocks/AAPL/sentiment")
    assert r.status_code == 200
    body = r.json()
    assert body["is_mock"] is False
    assert body["model_version"] == "fake-1.0"
    # 4 則收錄、3 則標題直接提到 Apple：指數只算那 3 則（FakeAnalyzer 全判 positive）
    assert body["article_count"] == 4 and body["index_count"] == 3
    assert body["index_counts"] == {"positive": 3, "neutral": 0, "negative": 0}
    assert body["label"] == "positive" and body["score"] == 1.0 and body["insufficient"] is False
    assert body["index_method"]["scope"] == "direct" and body["index_method"]["weighting"] == "equal"
    assert body["keywords"] == [{"word": "earnings", "score": 1.0, "count": 2}]


def test_news_with_loaded_model(client_with_model):
    r = client_with_model.get("/api/stocks/AAPL/news")
    assert r.status_code == 200
    body = r.json()
    assert body["is_mock"] is False
    assert all(a["sentiment"] == "positive" for a in body["articles"])
    assert all(a["confidence"] == 0.9 for a in body["articles"])
    assert [a["direct"] for a in body["articles"]] == [True, True, True, False]
    assert [a["in_index"] for a in body["articles"]] == [True, True, True, False]
    assert body["articles"][3]["related_tickers"] == ["AAPL", "MSFT"]
    assert body["target_name"] == "Apple" and "iPhone" in body["target_aliases"] and "AAPL" in body["target_aliases"]


def test_sentiment_is_insufficient_with_fewer_than_three_direct_titles(client_with_model, sample_articles):
    from newssent.api.main import app

    from tests.conftest import FakeProvider

    app.state.news_provider = FakeProvider([sample_articles[0], sample_articles[3]])
    body = client_with_model.get("/api/stocks/AAPL/sentiment").json()
    assert body["index_count"] == 1 and body["insufficient"] is True and body["label"] == "neutral"


def test_model_info_with_loaded_model(client_with_model):
    r = client_with_model.get("/api/model")
    assert r.status_code == 200
    body = r.json()
    assert body["is_mock"] is False
    assert body["test_macro_f1"] == 0.72


def test_health_reports_model_loaded(client_with_model):
    r = client_with_model.get("/health")
    assert r.status_code == 200
    assert r.json()["model_loaded"] is True
