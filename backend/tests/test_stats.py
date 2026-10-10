"""newssent.ml.stats：與合併前 tools/ 裡各自的實作逐筆對照。

報告引用的 κ、McNemar p 都出自舊實作；合併後在非退化情況下必須算出完全相同的數字。
下面的 _old_* 是合併前的原始碼（凍結的對照組，不要修改）。
"""

from __future__ import annotations

import math
import random
from collections import Counter
from math import comb

import pytest

from newssent.config import LABEL_NAMES
from newssent.ml.stats import cohen_kappa, mcnemar_exact, spearman, wilson


def _old_kappa_scorer_agreement(pairs: list[tuple[str, str]]) -> float:
    n = len(pairs)
    if n == 0:
        return math.nan
    po = sum(a == b for a, b in pairs) / n
    ca, cb = Counter(a for a, _ in pairs), Counter(b for _, b in pairs)
    pe = sum(ca[label] * cb[label] for label in LABEL_NAMES) / (n * n)
    return (po - pe) / (1 - pe) if pe < 1 else math.nan


def _old_kappa_judge_qualify(human: list[str], pred: list[str]) -> float:
    n = len(human)
    po = sum(h == p for h, p in zip(human, pred)) / n
    ch, cp = Counter(human), Counter(pred)
    pe = sum(ch[k] * cp[k] for k in set(ch) | set(cp)) / (n * n)
    return 1.0 if pe == 1 else (po - pe) / (1 - pe)


def _old_mcnemar(human: list[str], a: list[str], b: list[str]) -> tuple[int, int, float]:
    a_only = sum(1 for h, x, y in zip(human, a, b) if x == h and y != h)
    b_only = sum(1 for h, x, y in zip(human, a, b) if y == h and x != h)
    n = a_only + b_only
    if n == 0:
        return a_only, b_only, 1.0
    tail = sum(comb(n, i) for i in range(min(a_only, b_only) + 1)) / (2**n)
    return a_only, b_only, min(1.0, 2 * tail)


def _random_labels(rng: random.Random, n: int, choices: list[str]) -> list[str]:
    return [rng.choice(choices) for _ in range(n)]


@pytest.mark.parametrize("seed", range(20))
def test_kappa_matches_both_old_implementations(seed):
    rng = random.Random(seed)
    n = rng.randint(5, 300)
    a = _random_labels(rng, n, LABEL_NAMES)
    # 判讀方偶爾沒給出合法標籤（judge_qualify 的 MISSING）：只出現在一邊，不影響期望一致率
    b = _random_labels(rng, n, [*LABEL_NAMES, "missing"])
    assert cohen_kappa(a, b, LABEL_NAMES) == _old_kappa_scorer_agreement(list(zip(a, b)))
    assert cohen_kappa(a, b) == _old_kappa_judge_qualify(a, b)


def test_kappa_is_undefined_without_samples_or_variety():
    assert math.isnan(cohen_kappa([], []))
    # 兩邊都只用同一個標籤：期望一致率為 1，κ 沒有定義（舊 judge_qualify 會回 1.0）
    assert math.isnan(cohen_kappa(["neutral"] * 5, ["neutral"] * 5))


def test_kappa_rejects_mismatched_lengths():
    with pytest.raises(ValueError):
        cohen_kappa(["negative", "neutral"], ["negative"])


@pytest.mark.parametrize("seed", range(20))
def test_mcnemar_matches_old_implementation(seed):
    rng = random.Random(1000 + seed)
    n = rng.randint(1, 120)
    truth = _random_labels(rng, n, LABEL_NAMES)
    a = _random_labels(rng, n, LABEL_NAMES)
    b = _random_labels(rng, n, LABEL_NAMES)
    assert mcnemar_exact(truth, a, b) == _old_mcnemar(truth, a, b)


def test_mcnemar_without_discordant_pairs_is_not_significant():
    labels = ["negative", "positive"]
    assert mcnemar_exact(labels, labels, labels) == (0, 0, 1.0)


def test_wilson_and_spearman_edges():
    lo, hi = wilson(80, 100)
    assert lo < 0.8 < hi
    assert all(math.isnan(x) for x in wilson(0, 0))
    assert math.isnan(spearman([1.0, 2.0], [2.0, 1.0]))
    assert spearman([1.0, 2.0, 3.0], [10.0, 20.0, 30.0]) == pytest.approx(1.0)
