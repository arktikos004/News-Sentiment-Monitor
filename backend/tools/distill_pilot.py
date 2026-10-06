"""中文小模型蒸餾的初步實驗（探索性、離線）：線上語言模型的評分當教師，訓練中文小模型。

用法（backend/ 目錄執行；學生模型的訓練要用 CUDA 版 torch 的另一個環境，見 docs/distill_pilot_prereg.md）:
    python tools/distill_pilot.py --db <alert_scores.db 快照> --out <repo 外的目錄> --expect-sha256 <雜湊>
    python tools/distill_pilot.py --db <...> --out <...> --split-only    # 只印切分筆數，不訓練

切分、模型、指標與判定門檻事先寫在 docs/distill_pilot_prereg.md（先 commit、再跑）；
本工具只計算並套用門檻，不調參、不用測試集挑模型，測試集只評估一次。

- 教師＝線上評分器 config.ALERT_SCORER（Gemma 4，Apache-2.0）。本機 gemma3:27b（ALERT_SCORER_LEGACY）
  只當參考評分者、不進訓練：Gemma 條款把「以 Gemma 輸出蒸餾的模型」算作衍生模型，Gemma 4 不適用該條款。
- 語言模型只給標籤（one-hot），所以是以教師的硬標籤訓練，沒有教師的機率分布可學。
- 盤勢報導標題與看板一致，一律排除（config.ALERT_PRICE_REPORT_PATTERNS）。
- 不接上線上流程：網站的評分器不變。

--out 底下的檔案只留本機：test_predictions.csv 含新聞標題、student.joblib 是以新聞標題訓練的權重，
都不得進公開 repo（工具拒絕 repo 內的 --out）。report.md 與 metrics.json 只有彙總數字。
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import platform
import re
import sqlite3
import sys
import time
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix, f1_score, precision_recall_fscore_support
from sklearn.pipeline import Pipeline

BACKEND_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))

from newssent.config import (  # noqa: E402
    ALERT_SCORER,
    ALERT_SCORER_LEGACY,
    ALERT_UNIVERSE,
    LABEL_NAMES,
    SPLIT_SEED,
)
from newssent.inference.alert_recorder import scoring_target  # noqa: E402
from newssent.inference.alerts import (  # noqa: E402
    AlertLevel,
    assess,
    daily_scores,
    headline_score,
    is_price_report,
    session_open,
)
from newssent.ml.dataset import Split, grouped_stratified_split  # noqa: E402
from newssent.ml.evaluate import benchmark_cpu_ms, benchmark_gpu_ms  # noqa: E402
from newssent.ml.models.base import SentimentModel, align_proba  # noqa: E402
from newssent.text.preprocess import build_target_text  # noqa: E402
from tools.scorer_agreement import cohen_kappa, spearman, wilson  # noqa: E402

# --- 預先聲明的設定與判定門檻（docs/distill_pilot_prereg.md）；改動必須先改該文件並 commit ---
TEST_START = "2026-09-22T00:00:00+00:00"  # 發布時間（UTC）在此（含）之後＝測試集
VAL_RATIO = 0.15                          # 切點之前的標題群組，分層抽 15% 當驗證集（只供學生早停）
STUDENT_NAME = "bert-zh-distill"
STUDENT_PRETRAINED = "google-bert/bert-base-chinese"  # Apache-2.0；超參數全用 TransformerModel 預設
KAPPA_MIN = 0.60       # 與 docs/scorer_switch_prereg.md 換線上評分器時的採用門檻相同
NEG_RECALL_MIN = 0.80  # 教師判負面者，學生至少要抓到八成（預警只看負向偏離）

NEG = LABEL_NAMES.index("negative")
_ALERT = {AlertLevel.WATCH, AlertLevel.HIGH}
_NON_WORD = re.compile(r"[\W_]+")


@dataclass(frozen=True)
class Row:
    ticker: str
    title: str
    published_at: str  # UTC、秒精度的 ISO 字串（score_store 的統一格式：字串比較＝時間先後）
    label: int         # 教師標籤＝LABEL_NAMES 的索引


def teacher_label(p_negative: float, p_neutral: float, p_positive: float) -> int:
    """語言模型的評分是 one-hot：取機率最大的類別。並列（例如全為 0）代表資料有問題，不猜。"""
    probs = (p_negative, p_neutral, p_positive)
    top = max(probs)
    if probs.count(top) != 1:
        raise ValueError(f"無法判定教師標籤：{probs}")
    return probs.index(top)


def load_rows(db_path: Path, scorer: str = ALERT_SCORER) -> tuple[list[Row], int]:
    """該評分器評過的 (ticker, 標題)，依發布時間、ticker、標題排序（結果可重現）。

    回傳 (資料列, 排除的盤勢報導則數)。資料庫以唯讀開啟。
    """
    conn = sqlite3.connect(f"file:{db_path.as_posix()}?mode=ro", uri=True)
    try:
        raw = conn.execute(
            """
            SELECT h.ticker, h.title, h.published_at, s.p_negative, s.p_neutral, s.p_positive
            FROM headline_scores s
            JOIN headlines h ON h.ticker = s.ticker AND h.title = s.title
            WHERE s.scorer = ?
            ORDER BY h.published_at, h.ticker, h.title
            """,
            (scorer,),
        ).fetchall()
    finally:
        conn.close()
    rows = [
        Row(ticker, title, published_at, teacher_label(neg, neu, pos))
        for ticker, title, published_at, neg, neu, pos in raw
        if not is_price_report(title)
    ]
    return rows, len(raw) - len(rows)


def load_sessions(db_path: Path) -> list[date]:
    conn = sqlite3.connect(f"file:{db_path.as_posix()}?mode=ro", uri=True)
    try:
        return [date.fromisoformat(s) for (s,) in conn.execute("SELECT session FROM trading_sessions ORDER BY session")]
    finally:
        conn.close()


def title_group(title: str) -> str:
    """切分的群組鍵：同一則標題掛在不同個股底下，或只差標點、空白、全半形、大小寫，都算同一則。"""
    return _NON_WORD.sub("", unicodedata.normalize("NFKC", title)).lower()


def split_rows(
    rows: list[Row], test_start: str = TEST_START, val_ratio: float = VAL_RATIO, seed: int = SPLIT_SEED
) -> Split:
    """時間切點分出測試集，切點之前再以標題群組分層切出驗證集。回傳 rows 的索引。

    同一群組不跨集合：群組內任一列在切點之後，整組歸測試，不留在訓練或驗證。
    grouped_stratified_split 依比例取整後剩下的群組（落在比例 0 的第三份）併入訓練。
    """
    groups = [title_group(r.title) for r in rows]
    test_groups = {g for g, r in zip(groups, rows) if r.published_at >= test_start}
    test = [i for i, g in enumerate(groups) if g in test_groups]
    dev = [i for i, g in enumerate(groups) if g not in test_groups]
    inner = grouped_stratified_split(
        groups, [r.label for r in rows], (1 - val_ratio, val_ratio, 0.0), seed, indices=dev
    )
    return Split(train=sorted(inner.train + inner.test), val=inner.val, test=test)


def model_input(row: Row) -> str:
    """與教師評分時同一組資訊：目標公司（名稱＋代號）與標題。transformer 會還原成 sentence pair。"""
    return build_target_text(scoring_target(row.ticker, ALERT_UNIVERSE[row.ticker]), row.title)


class CharTfidfModel(SentimentModel):
    """基準：字元 1–3-gram TF-IDF＋LogisticRegression（balanced）。

    baselines.TfidfLogRegModel 用預設的斷詞規則，中文標題沒有空白，整段會被當成一個詞，對中文無效。
    """

    name = "tfidf_char_lr"

    def __init__(self, random_state: int = 42):
        self._pipe = Pipeline(
            [
                ("tfidf", TfidfVectorizer(analyzer="char", ngram_range=(1, 3), min_df=2, sublinear_tf=True)),
                ("clf", LogisticRegression(max_iter=2000, class_weight="balanced", random_state=random_state)),
            ]
        )

    def fit(self, texts, labels, val_texts=None, val_labels=None) -> "CharTfidfModel":
        self._pipe.fit(texts, labels)
        return self

    def predict_proba(self, texts: list[str]) -> np.ndarray:
        return align_proba(self._pipe.predict_proba(texts), self._pipe.classes_)


def agreement_metrics(y_true: list[int], y_pred: list[int]) -> dict:
    """y_true＝教師（或參考評分者對照的對象）、y_pred＝模型，皆為 LABEL_NAMES 的索引。"""
    n = len(y_true)
    agree = sum(a == b for a, b in zip(y_true, y_pred))
    neg_total = sum(a == NEG for a in y_true)
    neg_hit = sum(a == NEG and b == NEG for a, b in zip(y_true, y_pred))
    p, r, f, s = precision_recall_fscore_support(y_true, y_pred, labels=[0, 1, 2], zero_division=0)
    return {
        "n": n,
        "agree": agree,
        "agreement": agree / n if n else math.nan,
        "agreement_ci": wilson(agree, n),
        "kappa": cohen_kappa([(LABEL_NAMES[a], LABEL_NAMES[b]) for a, b in zip(y_true, y_pred)]),
        "macro_f1": float(f1_score(y_true, y_pred, labels=[0, 1, 2], average="macro", zero_division=0)) if n else math.nan,
        "neg_hit": neg_hit,
        "neg_total": neg_total,
        "neg_recall": neg_hit / neg_total if neg_total else math.nan,
        "neg_recall_ci": wilson(neg_hit, neg_total),
        "per_class": {
            LABEL_NAMES[i]: {"precision": float(p[i]), "recall": float(r[i]), "f1": float(f[i]), "support": int(s[i])}
            for i in range(3)
        },
        "confusion": confusion_matrix(y_true, y_pred, labels=[0, 1, 2]).tolist(),  # 列＝教師、欄＝模型
    }


def verdict(kappa: float, neg_recall: float) -> str:
    """預先聲明的判定，依序套用；NaN 一律視為未達門檻。"""
    if kappa >= KAPPA_MIN and neg_recall >= NEG_RECALL_MIN:
        return "初步可行：下一步以人工標注驗收"
    if kappa >= KAPPA_MIN:
        return "部分可行：可做初篩，負面仍交給語言模型"
    return "不可行"


def cpu_single_ms(model: SentimentModel, texts: list[str], n: int = 50) -> float:
    """逐則呼叫（批次 1）的 CPU 延遲：即時判讀一則新標題要等多久。"""
    sample = texts[:n]
    model.predict_proba(sample[:1])  # 暖機
    t0 = time.perf_counter()
    for text in sample:
        model.predict_proba([text])
    return round((time.perf_counter() - t0) * 1000 / len(sample), 3)


def daily_comparison(
    rows: list[Row], teacher_probs: np.ndarray, student_probs: np.ndarray, sessions: list[date], test_start: str
) -> dict:
    """看板實際用的量：每日分數與警示等級，只比較測試期的交易日（次要、描述性）。

    交易日 s 的標題窗是 [前一交易日開盤, s 開盤)，只取窗口完全落在切點之後的交易日。
    z 值的基準窗（前 20 個交易日）多半落在切點之前，學生在那段是對訓練資料預測，結果對學生偏樂觀。
    """
    start = datetime.fromisoformat(test_start)
    ordered = sorted(sessions)
    test_sessions = {s for prev, s in zip(ordered, ordered[1:]) if session_open(prev) >= start}
    by_ticker: dict[str, list[int]] = defaultdict(list)
    for i, r in enumerate(rows):
        by_ticker[r.ticker].append(i)

    xs: list[float] = []
    ys: list[float] = []
    levels: Counter = Counter()
    for idx in by_ticker.values():
        stamps = [datetime.fromisoformat(rows[i].published_at) for i in idx]
        series = [
            daily_scores(((t, headline_score(probs[i][0], probs[i][2])) for t, i in zip(stamps, idx)), ordered)
            for probs in (teacher_probs, student_probs)
        ]
        for k, (t_day, s_day) in enumerate(zip(*series)):
            if t_day.session not in test_sessions:
                continue
            if t_day.score is not None and s_day.score is not None:
                xs.append(t_day.score)
                ys.append(s_day.score)
            levels[(assess(series[0][: k + 1]).level, assess(series[1][: k + 1]).level)] += 1

    return {
        "test_sessions": sorted(s.isoformat() for s in test_sessions),
        "daily_pairs": len(xs),
        "daily_spearman": spearman(xs, ys),
        "assessed": sum(levels.values()),
        "teacher_alerts": sum(n for (a, _), n in levels.items() if a in _ALERT),
        "student_alerts": sum(n for (_, b), n in levels.items() if b in _ALERT),
        "both_alerts": sum(n for (a, b), n in levels.items() if a in _ALERT and b in _ALERT),
        "levels": {f"{a.value}→{b.value}": n for (a, b), n in sorted(levels.items())},
    }


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _cpu_name() -> str:
    if sys.platform == "win32":
        try:
            import winreg

            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0") as key:
                return str(winreg.QueryValueEx(key, "ProcessorNameString")[0]).strip()
        except OSError:
            pass
    return platform.processor()


def environment() -> dict:
    import sklearn

    info = {"python": platform.python_version(), "os": platform.platform(), "cpu": _cpu_name(), "scikit-learn": sklearn.__version__}
    try:
        import torch
        import transformers
    except ImportError:
        return info
    info.update(
        {
            "torch": torch.__version__,
            "transformers": transformers.__version__,
            "torch_cpu_threads": torch.get_num_threads(),
            "cuda": torch.version.cuda,
            "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        }
    )
    return info


def _distribution(rows: list[Row], idx: list[int]) -> dict[str, int]:
    counts = Counter(rows[i].label for i in idx)
    return {name: counts.get(i, 0) for i, name in enumerate(LABEL_NAMES)}


def split_summary(rows: list[Row], split: Split, test_start: str = TEST_START) -> dict:
    return {
        name: {"n": len(idx), "labels": _distribution(rows, idx)}
        for name, idx in (("train", split.train), ("val", split.val), ("test", split.test))
    } | {"test_rows_before_cut": sum(rows[i].published_at < test_start for i in split.test)}


def run(db_path: Path, out: Path, log=print) -> dict:
    from newssent.ml.models.transformer import TransformerModel  # torch／transformers：只在真的要訓練時載入

    rows, n_price = load_rows(db_path)
    split = split_rows(rows)
    texts = [model_input(r) for r in rows]
    labels = [r.label for r in rows]

    def pick(idx: list[int], xs: list) -> list:
        return [xs[i] for i in idx]

    tr_x, tr_y = pick(split.train, texts), pick(split.train, labels)
    va_x, va_y = pick(split.val, texts), pick(split.val, labels)
    te_x, te_y = pick(split.test, texts), pick(split.test, labels)

    majority = Counter(tr_y).most_common(1)[0][0]
    tfidf = CharTfidfModel().fit(tr_x, tr_y)
    log(f"基準完成；開始訓練學生 {STUDENT_PRETRAINED}（訓練 {len(tr_x)}、驗證 {len(va_x)}）")
    student = TransformerModel(name=STUDENT_NAME, pretrained=STUDENT_PRETRAINED)
    t0 = time.perf_counter()
    student.fit(tr_x, tr_y, va_x, va_y)
    train_seconds = time.perf_counter() - t0

    # 學生對全部列預測（CPU，與部署情境相同）：測試集指標只用測試列；其餘列供每日分數的基準窗
    student_probs = student.predict_proba(texts)
    student_pred = student_probs.argmax(axis=1).tolist()
    tfidf_pred = tfidf.predict(texts).tolist()

    test = {
        "majority": agreement_metrics(te_y, [majority] * len(te_y)),
        "tfidf_char_lr": agreement_metrics(te_y, pick(split.test, tfidf_pred)),
        "student": agreement_metrics(te_y, pick(split.test, student_pred)),
    }
    val = {
        "tfidf_char_lr": agreement_metrics(va_y, pick(split.val, tfidf_pred)),
        "student": agreement_metrics(va_y, pick(split.val, student_pred)),
    }

    # 參考評分者：本機 gemma3:27b 對同一批標題（只比較，不進訓練）
    legacy = {(r.ticker, r.title): r.label for r in load_rows(db_path, ALERT_SCORER_LEGACY)[0]}
    both = [i for i, r in enumerate(rows) if (r.ticker, r.title) in legacy]
    both_test = [i for i in split.test if (rows[i].ticker, rows[i].title) in legacy]
    reference = {
        "legacy_vs_teacher_all": agreement_metrics(pick(both, labels), [legacy[(rows[i].ticker, rows[i].title)] for i in both]),
        "legacy_vs_teacher_test": agreement_metrics(
            pick(both_test, labels), [legacy[(rows[i].ticker, rows[i].title)] for i in both_test]
        ),
        "student_vs_teacher_same_test_rows": agreement_metrics(pick(both_test, labels), pick(both_test, student_pred)),
    }

    speed = {
        "student": {
            "cpu_ms_batch64": benchmark_cpu_ms(student, te_x),
            "cpu_ms_single": cpu_single_ms(student, te_x),
            "gpu_ms_batch64": benchmark_gpu_ms(student, te_x),
        },
        "tfidf_char_lr": {"cpu_ms_batch64": benchmark_cpu_ms(tfidf, te_x), "cpu_ms_single": cpu_single_ms(tfidf, te_x)},
    }

    teacher_probs = np.eye(3)[labels]
    daily = daily_comparison(rows, teacher_probs, student_probs, load_sessions(db_path), TEST_START)

    res = {
        "generated_at": datetime.now().astimezone().isoformat(timespec="minutes"),
        "teacher": ALERT_SCORER,
        "reference_scorer": ALERT_SCORER_LEGACY,
        "data": {"db": str(db_path), "sha256": sha256_file(db_path), "rows": len(rows), "price_reports_excluded": n_price},
        "split": {"test_start": TEST_START, "val_ratio": VAL_RATIO, "seed": SPLIT_SEED} | split_summary(rows, split),
        "student": {"name": STUDENT_NAME, "pretrained": STUDENT_PRETRAINED, **student.hyperparams(), "train_seconds": round(train_seconds, 1)},
        "majority_label": LABEL_NAMES[majority],
        "test": test,
        "val": val,
        "reference": reference,
        "speed": speed,
        "daily": daily,
        "verdict": verdict(test["student"]["kappa"], test["student"]["neg_recall"]),
        "thresholds": {"kappa_min": KAPPA_MIN, "neg_recall_min": NEG_RECALL_MIN},
        "environment": environment(),
    }

    out.mkdir(parents=True, exist_ok=True)
    (out / "metrics.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "report.md").write_text(render(res), encoding="utf-8")
    with (out / "test_predictions.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["ticker", "published_at", "title", "teacher", "student", "p_negative", "p_neutral", "p_positive", "tfidf", "legacy"])
        for i in split.test:
            r = rows[i]
            ref = legacy.get((r.ticker, r.title))
            w.writerow(
                [r.ticker, r.published_at, r.title, LABEL_NAMES[r.label], LABEL_NAMES[student_pred[i]],
                 *(f"{p:.4f}" for p in student_probs[i]), LABEL_NAMES[tfidf_pred[i]], "" if ref is None else LABEL_NAMES[ref]]
            )
    import joblib

    joblib.dump(student, out / "student.joblib")
    return res


def _pct(x: float) -> str:
    return "—" if x is None or math.isnan(x) else f"{x:.1%}"


def _ci(ci) -> str:
    lo, hi = ci
    return "—" if math.isnan(lo) else f"{lo:.1%}–{hi:.1%}"


def _metric_row(name: str, m: dict) -> str:
    neg_p = m["per_class"]["negative"]["precision"]
    return (
        f"| {name} | {m['n']} | {_pct(m['agreement'])}（{_ci(m['agreement_ci'])}） | {m['kappa']:.3f} | {m['macro_f1']:.3f} "
        f"| {m['neg_hit']}/{m['neg_total']}＝{_pct(m['neg_recall'])}（{_ci(m['neg_recall_ci'])}） | {_pct(neg_p)} |"
    )


def _ms(x) -> str:
    return "—" if x is None else f"{x:.2f}"


def render(res: dict) -> str:
    st = res["test"]["student"]
    sp = res["speed"]
    daily = res["daily"]
    header = "| 比較 | 則數 | 一致率（95% CI） | κ | Macro F1 | 負面召回率（95% CI） | 負面精確率 |"
    rule = "| --- | --- | --- | --- | --- | --- | --- |"
    lines = [
        "# 中文小模型蒸餾：初步實驗報告（探索性）",
        "",
        f"> 產出 {res['generated_at']}｜教師 `{res['teacher']}`｜學生 `{res['student']['pretrained']}`"
        "｜切分與門檻見 docs/distill_pilot_prereg.md",
        f"> 資料快照 SHA-256 `{res['data']['sha256']}`（{res['data']['rows']} 則；排除盤勢報導 {res['data']['price_reports_excluded']} 則）",
        "",
        f"**判定：{res['verdict']}**（κ {st['kappa']:.3f}，門檻 {KAPPA_MIN:.2f}；負面召回率 {_pct(st['neg_recall'])}，門檻 {NEG_RECALL_MIN:.0%}）",
        "",
        "以下「一致率」都是與語言模型評分的一致，不是準確率：台股中文標題沒有人工標注可對照。",
        "",
        "## 切分",
        "",
        "| 集合 | 則數 | 負面 | 中性 | 正面 |",
        "| --- | --- | --- | --- | --- |",
    ]
    for key, name in (("train", "訓練"), ("val", "驗證"), ("test", "測試")):
        part = res["split"][key]
        lines.append(f"| {name} | {part['n']} | " + " | ".join(str(part["labels"][n]) for n in LABEL_NAMES) + " |")
    lines += [
        "",
        f"測試＝發布時間 ≥ {res['split']['test_start']}；切點之前的列因同標題而整組歸測試：{res['split']['test_rows_before_cut']} 則。",
        "",
        "## 測試集：與教師的一致性",
        "",
        header,
        rule,
        _metric_row(f"全猜多數類（{res['majority_label']}）", res["test"]["majority"]),
        _metric_row("字元 TF-IDF＋邏輯迴歸", res["test"]["tfidf_char_lr"]),
        _metric_row(f"學生（{res['student']['pretrained']}）", st),
        "",
        "## 參考：兩個教師之間（本機 gemma3:27b 對線上 Gemma 4）",
        "",
        header,
        rule,
        _metric_row("教師二對教師一：全部重疊", res["reference"]["legacy_vs_teacher_all"]),
        _metric_row("教師二對教師一：測試窗內重疊", res["reference"]["legacy_vs_teacher_test"]),
        _metric_row("學生對教師一：同一批測試列", res["reference"]["student_vs_teacher_same_test_rows"]),
        "",
        "## 混淆矩陣（學生，測試集；列＝教師、欄＝學生）",
        "",
        "| 教師＼學生 | " + " | ".join(LABEL_NAMES) + " |",
        "| --- |" + " --- |" * len(LABEL_NAMES),
    ]
    for name, counts in zip(LABEL_NAMES, st["confusion"]):
        lines.append(f"| {name} | " + " | ".join(str(c) for c in counts) + " |")
    lines += [
        "",
        "| 類別 | 精確率 | 召回率 | F1 | 教師則數 |",
        "| --- | --- | --- | --- | --- |",
    ]
    for name in LABEL_NAMES:
        c = st["per_class"][name]
        lines.append(f"| {name} | {_pct(c['precision'])} | {_pct(c['recall'])} | {c['f1']:.3f} | {c['support']} |")
    val = res["val"]
    lines += [
        "",
        f"驗證集（只供學生早停）：學生一致率 {_pct(val['student']['agreement'])}、κ {val['student']['kappa']:.3f}；"
        f"TF-IDF 一致率 {_pct(val['tfidf_char_lr']['agreement'])}、κ {val['tfidf_char_lr']['kappa']:.3f}。",
        "",
        "## 推論速度（每則毫秒）",
        "",
        "| 模型 | CPU 批次 64 | CPU 逐則 | GPU 批次 64 |",
        "| --- | --- | --- | --- |",
        f"| 學生 | {_ms(sp['student']['cpu_ms_batch64'])} | {_ms(sp['student']['cpu_ms_single'])} | {_ms(sp['student']['gpu_ms_batch64'])} |",
        f"| 字元 TF-IDF＋邏輯迴歸 | {_ms(sp['tfidf_char_lr']['cpu_ms_batch64'])} | {_ms(sp['tfidf_char_lr']['cpu_ms_single'])} | — |",
        "",
        f"學生訓練耗時 {res['student']['train_seconds']} 秒。",
        "",
        "## 每日分數與警示（次要、描述性）",
        "",
        f"測試期交易日 {len(daily['test_sessions'])} 天（{'、'.join(daily['test_sessions'])}）。",
        f"每日分數 Spearman（{daily['daily_pairs']} 個個股×交易日）：{daily['daily_spearman']:.3f}。",
        f"警示（watch 或 high）：教師 {daily['teacher_alerts']}、學生 {daily['student_alerts']}、兩者皆有 {daily['both_alerts']}"
        f"（共評估 {daily['assessed']} 個個股×交易日）。",
        "z 值的基準窗多半落在切點之前，學生在那段是對訓練資料預測，這一節對學生偏樂觀。",
        "",
        "| 教師→學生 | 個股×交易日 |",
        "| --- | --- |",
    ]
    lines += [f"| {k} | {n} |" for k, n in daily["levels"].items()]
    env = res["environment"]
    lines += ["", "## 環境", "", "| 項目 | 值 |", "| --- | --- |"]
    lines += [f"| {k} | {v} |" for k, v in env.items()]
    lines.append("")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="中文小模型蒸餾的初步實驗（離線、探索性）")
    parser.add_argument("--db", type=Path, required=True, help="alert_scores.db 的快照（唯讀開啟）")
    parser.add_argument("--out", type=Path, required=True, help="輸出目錄；必須在 repo 之外（逐則輸出含新聞標題）")
    parser.add_argument("--expect-sha256", help="資料快照的 SHA-256；不符就停止")
    parser.add_argument("--split-only", action="store_true", help="只印切分筆數，不訓練")
    args = parser.parse_args(argv)

    out = args.out.resolve()
    if out == REPO_ROOT or REPO_ROOT in out.parents:
        parser.error("--out 必須在 repo 之外：逐則預測含新聞標題、權重以新聞標題訓練，都不得公開")
    if not args.db.is_file():
        parser.error(f"找不到資料庫：{args.db}")
    sha = sha256_file(args.db)
    if args.expect_sha256 and sha != args.expect_sha256.lower():
        print(f"資料快照的 SHA-256 不符：{sha} ≠ {args.expect_sha256}")
        return 1

    if args.split_only:
        rows, n_price = load_rows(args.db)
        summary = split_summary(rows, split_rows(rows))
        print(f"資料快照 SHA-256 {sha}；教師 {ALERT_SCORER}：{len(rows)} 則（排除盤勢報導 {n_price} 則）")
        for key in ("train", "val", "test"):
            part = summary[key]
            print(f"  {key}: {part['n']} 則  " + "／".join(f"{n} {part['labels'][n]}" for n in LABEL_NAMES))
        print(f"  切點之前、因同標題而整組歸測試：{summary['test_rows_before_cut']} 則")
        return 0

    res = run(args.db, out)
    print(render(res))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
