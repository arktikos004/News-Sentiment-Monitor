"""新聞與標的的相關性：標題有沒有直接提到這家公司。

美股新聞源（Yahoo 財經）會把一則新聞關聯到好幾個代號：大盤綜述、同業的報導、只是順帶提到的文章都會收進來。
情緒指數只計入標題直接提到公司（名稱、別名或代號）的新聞；其餘列為「關聯待確認」，畫面上附 Yahoo 的關聯代號當理由。
等有附來源的公司關係表（供應商、客戶、同業）之後，才會另外標「間接相關」——共同出現 AI、科技之類的字不算相關。

比對規則（config.TICKER_ALIASES）：
- 名稱與別名整詞比對、不分大小寫，容許所有格與複數（Intel's、iPhones）；Intelligence 不是 Intel
- TICKER_ALIASES_CASED 的別名同時是一般英文字，只在大小寫完全相同時才算（Meta、Arm）
- 代號本身要是獨立、全大寫的字（$AAPL、AAPL）
- ETF（QQQ、SPY）是市場綜合，一律算直接相關

已知限制（tests/test_relevance.py 釘住）：只看字面，不判斷公司是不是標題的主角；
ASE 也可能是別的機構的縮寫、「Oracle of Omaha」指的是巴菲特，這些都會被算成提到。
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache

from newssent.config import ETF_TICKERS, TICKER_ALIASES, TICKER_ALIASES_CASED, company_name


@dataclass(frozen=True)
class Relevance:
    direct: bool  # 標題提到這家公司；ETF 一律為 True
    mentioned: tuple[str, ...]  # 標題提到的其他追蹤標的（依 TICKER_ALIASES 的順序）


def aliases(ticker: str) -> list[str]:
    """比對用的字詞（畫面說明「標題沒提到 Apple」也用它）：名稱、分大小寫的別名、代號。"""
    t = (ticker or "").upper()
    names = [*TICKER_ALIASES.get(t, ()), *TICKER_ALIASES_CASED.get(t, ())]
    if not names and company_name(t) != t:
        names = [company_name(t)]
    return [*names, t]


@lru_cache(maxsize=None)
def _patterns(ticker: str) -> tuple[re.Pattern[str], ...]:
    t = ticker.upper()
    suffix = r"(?:'s|’s|s)?"
    pats = [re.compile(rf"\b{re.escape(n)}{suffix}\b", re.IGNORECASE) for n in TICKER_ALIASES.get(t, ())]
    pats += [re.compile(rf"\b{re.escape(n)}(?:'s|’s)?\b") for n in TICKER_ALIASES_CASED.get(t, ())]
    pats.append(re.compile(rf"(?<![A-Za-z]){re.escape(t)}(?![A-Za-z])"))
    return tuple(pats)


def mentions(ticker: str, title: str) -> bool:
    """標題有沒有提到這一檔（不含 ETF 的特例）。"""
    return any(p.search(title) for p in _patterns(ticker))


def mentioned_tickers(title: str, exclude: str | None = None) -> tuple[str, ...]:
    """標題提到的追蹤標的（不含 exclude）；ETF 只認代號。"""
    found = [t for t in TICKER_ALIASES if t != exclude and mentions(t, title)]
    found += [t for t in sorted(ETF_TICKERS) if t != exclude and re.search(rf"(?<![A-Za-z]){t}(?![A-Za-z])", title)]
    return tuple(found)


def relevance(ticker: str, title: str) -> Relevance:
    t = (ticker or "").upper()
    direct = t in ETF_TICKERS or mentions(t, title)
    return Relevance(direct=direct, mentioned=mentioned_tickers(title, exclude=t))
