"""研究工具共用的統計函式：Wilson 信賴區間、Cohen's κ、McNemar 精確檢定、Spearman 相關。

過去 tools/ 底下各寫一份，邊界情況（沒有樣本、兩邊都只用同一個標籤）的處理不一致。
現在只留這一份；與舊實作的逐筆對照見 tests/test_stats.py。
"""

from __future__ import annotations

import math
from collections import Counter
from collections.abc import Iterable, Sequence


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """比例 k/n 的 Wilson 信賴區間；n＝0 時回 (NaN, NaN)。"""
    if n == 0:
        return (math.nan, math.nan)
    p = k / n
    denom = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return (center - half, center + half)


def cohen_kappa(a: Sequence[str], b: Sequence[str], labels: Iterable[str] | None = None) -> float:
    """兩組標籤的 Cohen's κ。

    labels：計算期望一致率時要加總的標籤；None＝兩邊實際出現過的標籤。
    沒有樣本，或期望一致率為 1（兩邊從頭到尾只用同一個標籤）時 κ 沒有定義，回 NaN。
    """
    if len(a) != len(b):
        raise ValueError(f"兩組標籤的筆數不同：{len(a)} vs {len(b)}")
    n = len(a)
    if n == 0:
        return math.nan
    po = sum(x == y for x, y in zip(a, b)) / n
    count_a, count_b = Counter(a), Counter(b)
    keys = set(count_a) | set(count_b) if labels is None else labels
    pe = sum(count_a[k] * count_b[k] for k in keys) / (n * n)
    return (po - pe) / (1 - pe) if pe < 1 else math.nan


def mcnemar_exact(truth: Sequence[str], a: Sequence[str], b: Sequence[str]) -> tuple[int, int, float]:
    """兩組判讀對同一批答案的配對比較：McNemar 精確檢定（雙尾二項）。

    只看不一致格：回傳 (只有 a 對的筆數, 只有 b 對的筆數, p 值)。
    小樣本時兩組的一致率差幾個百分點常常只是噪音，配對設計就該用這個檢定。
    """
    a_only = sum(1 for t, x, y in zip(truth, a, b) if x == t and y != t)
    b_only = sum(1 for t, x, y in zip(truth, a, b) if y == t and x != t)
    n = a_only + b_only
    if n == 0:
        return a_only, b_only, 1.0
    tail = sum(math.comb(n, i) for i in range(min(a_only, b_only) + 1)) / (2**n)
    return a_only, b_only, min(1.0, 2 * tail)


def spearman(xs: Sequence[float], ys: Sequence[float]) -> float:
    """Spearman 等級相關；少於 3 對時回 NaN。"""
    from scipy.stats import spearmanr

    return float(spearmanr(xs, ys).statistic) if len(xs) >= 3 else math.nan
