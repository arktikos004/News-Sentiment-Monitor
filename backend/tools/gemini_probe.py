"""Gemini API 候選模型實測：決定 config 的 GEMINI_MODEL、GEMINI_SYSTEM_INSTRUCTION、GEMINI_MAX_OUTPUT_TOKENS、GEMINI_THINKING。

用法（backend/ 目錄執行，需 GEMINI_API_KEY）:
    python tools/gemini_probe.py

依 docs/scorer_switch_prereg.md 的候選順序，逐一確認模型存在、能在各種輸出設定下回出可解析的標籤，
並量每次呼叫的延遲——會先「思考」的模型（Gemma 4）延遲決定了每次排程能評多少則。
只印結果，不改任何設定。
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from newssent.config import GEMINI_API_KEY  # noqa: E402
from newssent.inference.llm_review import GeminiConfigError, GeminiReviewer  # noqa: E402

CANDIDATES = ("gemma-3-27b-it", "gemma-4-31b-it", "gemma-4-26b-a4b-it", "gemini-3.5-flash-lite")

# (名稱, maxOutputTokens, thinkingConfig)：模型預設思考、關閉思考、最低思考
VARIANTS = (
    ("預設思考", 1024, None),
    ("thinkingBudget=0", 64, {"thinkingBudget": 0}),
    ("thinkingLevel=minimal", 256, {"thinkingLevel": "minimal"}),
)

# (目標, 標題, 預期方向)：方向明確的樣本，只用來確認「會正常回答」，不是準確度評估
SAMPLES = (
    ("台積電（2330）", "台積電第三季營收創歷史新高，法人上調全年目標價", "positive"),
    ("鴻海（2317）", "鴻海遭美國商務部列入調查，股價承壓", "negative"),
    ("聯發科（2454）", "聯發科將於下週舉行法說會", "neutral"),
)


def say(msg: str) -> None:
    print(msg, flush=True)


def run_variant(model: str, name: str, tokens: int, thinking: dict | None) -> None:
    reviewer = GeminiReviewer(model=model, api_key=GEMINI_API_KEY, rpm=60, max_output_tokens=tokens,
                              thinking=thinking, retries=1)
    answers, secs = [], []
    try:
        for target, title, _ in SAMPLES:
            t0 = time.monotonic()
            answers.append(reviewer.judge(target, title))
            secs.append(time.monotonic() - t0)
    except GeminiConfigError as exc:
        say(f"    {name}：不接受此設定 → {str(exc)[:160]}")
        return
    parsed = sum(a is not None for a in answers)
    expected = sum(a == e for a, (_, _, e) in zip(answers, SAMPLES))
    avg = sum(secs) / len(secs)
    say(f"    {name}（maxOutputTokens={tokens}）：可解析 {parsed}/3、符合預期 {expected}/3、"
        f"每則 {avg:.1f} 秒（{', '.join(f'{x:.1f}' for x in secs)}）→ {answers}")


def main() -> int:
    if not GEMINI_API_KEY:
        say("未設定 GEMINI_API_KEY（backend/.env 或環境變數）")
        return 1
    for model in CANDIDATES:
        if not GeminiReviewer(model=model, api_key=GEMINI_API_KEY).available():
            say(f"  {model}：不存在或金鑰無權限")
            continue
        say(f"  {model}：")
        for name, tokens, thinking in VARIANTS:
            run_variant(model, name, tokens, thinking)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
