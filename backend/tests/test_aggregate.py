"""情緒指數（inference/aggregate.py）：每則同權重、資料不足的規則、舊算法可回退。"""

from newssent.inference.aggregate import sentiment_index


def test_empty_is_neutral_zero_and_insufficient():
    r = sentiment_index([])
    assert r.score == 0.0 and r.label == "neutral" and r.article_count == 0 and r.insufficient


def test_all_positive():
    r = sentiment_index([("positive", 1.0)] * 3)
    assert r.score == 1.0 and r.label == "positive" and not r.insufficient
    assert r.counts == {"positive": 3, "neutral": 0, "negative": 0}


def test_all_negative():
    r = sentiment_index([("negative", 1.0)] * 3)
    assert r.score == -1.0 and r.label == "negative"


def test_neutral_articles_do_not_move_score():
    r = sentiment_index([("neutral", 0.9), ("neutral", 0.8), ("neutral", 0.7)])
    assert r.score == 0.0 and r.label == "neutral" and not r.insufficient


def test_equal_weight_ignores_class_probability():
    # 每則同權重：類別機率沒有校準，不拿來當權重
    r = sentiment_index([("positive", 0.99), ("negative", 0.34), ("negative", 0.34), ("neutral", 0.9)])
    assert r.score == -0.25 and r.label == "negative"


def test_fewer_than_three_articles_is_insufficient():
    r = sentiment_index([("positive", 0.9), ("positive", 0.9)])
    assert r.score == 1.0 and r.insufficient and r.label == "neutral"


def test_a_direction_needs_two_articles():
    # 1 正面 2 中性：score 0.33 超過門檻，但只有 1 則同向 → 不判方向
    r = sentiment_index([("positive", 0.9), ("neutral", 0.9), ("neutral", 0.9)])
    assert round(r.score, 2) == 0.33 and r.insufficient and r.label == "neutral"
    r = sentiment_index([("positive", 0.9), ("positive", 0.9), ("neutral", 0.9)])
    assert r.label == "positive" and not r.insufficient


def test_mixed_below_threshold_is_neutral():
    r = sentiment_index([("positive", 0.6), ("negative", 0.6), ("neutral", 0.6)])
    assert r.score == 0.0 and r.label == "neutral" and r.article_count == 3 and not r.insufficient


def test_confidence_weighting_is_still_available():
    # 舊算法（config.SENTIMENT_WEIGHTING＝"confidence"）：高機率正面 + 低機率負面 → 淨正
    r = sentiment_index([("positive", 0.9), ("negative", 0.1)], weighting="confidence", min_articles=1, min_polar=1)
    assert r.score == 0.4 and r.label == "positive"
