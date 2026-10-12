"""關鍵字雲：對計入指數的標題做 TF-IDF 計分，取全庫加總最高的詞。

停用詞、代號與公司本身的名稱必須剔除——否則每檔股票的關鍵字雲都被自己的名字佔滿。
純函式，輸入為 clean_text() 後的標題清單；回傳 (字詞, 分數, 含這個字的標題數)。
"""

from __future__ import annotations


def extract_keywords(
    titles: list[str], ticker: str, top_n: int = 15, exclude: list[str] | None = None
) -> list[tuple[str, float, int]]:
    """exclude：公司名稱與別名（多字的名稱拆成單字一起剔除）。"""
    import re

    from sklearn.feature_extraction.text import TfidfVectorizer

    if not titles:
        return []

    # max_df=0.8：出現在 8 成以上標題的詞（幾乎必是公司名本身）自動剔除，
    # 否則每檔股票的關鍵字雲都被自己的名字佔滿；標題太少全被 max_df 濾掉時退一步重試
    try:
        vectorizer = TfidfVectorizer(
            stop_words="english", ngram_range=(1, 1), max_features=500, max_df=0.8
        )
        matrix = vectorizer.fit_transform(titles)
    except ValueError:
        try:
            vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 1), max_features=500)
            matrix = vectorizer.fit_transform(titles)
        except ValueError:  # 全部標題都只含停用詞
            return []

    scores = matrix.sum(axis=0).A1
    docs = (matrix > 0).sum(axis=0).A1
    words = vectorizer.get_feature_names_out()

    banned = {ticker.lower(), ticker.lower().replace(".", "")}
    for name in exclude or []:
        banned.update(w.lower() for w in re.findall(r"[A-Za-z0-9]+", name))
    ranked = sorted(
        (
            (w, float(s), int(d))
            for w, s, d in zip(words, scores, docs)
            if w.lower() not in banned and not w.isdigit()
        ),
        key=lambda t: t[1],
        reverse=True,
    )
    return [(w, round(s, 4), d) for w, s, d in ranked[:top_n]]
