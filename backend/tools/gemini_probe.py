"""Gemini API 候選模型實測：決定 config.GEMINI_MODEL 與 GEMINI_SYSTEM_INSTRUCTION。

用法（backend/ 目錄執行，需 GEMINI_API_KEY）:
    python tools/gemini_probe.py

依 docs/scorer_switch_prereg.md 的候選順序，逐一確認：
1. 模型是否存在（GET models/<名稱>）
2. 帶 systemInstruction 能否呼叫；不行就改把系統提示併入 user turn 再試
3. 同一份提示詞對幾則已知方向的標題，能否在 maxOutputTokens 內回出可解析的標籤
第一個「存在且能正常回答」的候選即為採用對象。只印結果，不改任何設定。
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from newssent.config import GEMINI_API_KEY  # noqa: E402
from newssent.inference.llm_review import GeminiConfigError, GeminiReviewer  # noqa: E402

CANDIDATES = ("gemma-3-27b-it", "gemma-4-31b-it", "gemma-4-26b-a4b-it", "gemini-3.5-flash-lite")

# (目標, 標題, 預期方向)：方向明確的樣本，只用來確認「會正常回答」，不是準確度評估
SAMPLES = (
    ("台積電（2330）", "台積電第三季營收創歷史新高，法人上調全年目標價", "positive"),
    ("鴻海（2317）", "鴻海遭美國商務部列入調查，股價承壓", "negative"),
    ("聯發科（2454）", "聯發科將於下週舉行法說會", "neutral"),
)


def dump_raw(model: str, system_instruction: bool, max_output_tokens: int) -> None:
    """解析不出標籤時，印出原始回應的結束原因、各段文字與 token 用量，找出是被截斷還是格式不同。"""
    import httpx

    reviewer = GeminiReviewer(model=model, api_key=GEMINI_API_KEY, system_instruction=system_instruction,
                              max_output_tokens=max_output_tokens)
    target, title, _ = SAMPLES[0]
    resp = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        headers={"x-goog-api-key": GEMINI_API_KEY}, json=reviewer._payload(target, title), timeout=60,
    )
    body = resp.json()
    cand = (body.get("candidates") or [{}])[0]
    parts = [{"thought": p.get("thought", False), "text": (p.get("text") or "")[:160]}
             for p in (cand.get("content") or {}).get("parts") or []]
    print(f"    原始（maxOutputTokens={max_output_tokens}）：HTTP {resp.status_code} "
          f"finishReason={cand.get('finishReason')} usage={body.get('usageMetadata')} parts={parts}")


def probe(model: str) -> bool:
    for system_instruction in (True, False):
        reviewer = GeminiReviewer(
            model=model, api_key=GEMINI_API_KEY, rpm=20, system_instruction=system_instruction, retries=1
        )
        if not reviewer.available():
            print(f"  {model}: 不存在或金鑰無權限")
            return False
        mode = "systemInstruction" if system_instruction else "系統提示併入 user turn"
        try:
            answers = [reviewer.judge(target, title) for target, title, _ in SAMPLES]
        except GeminiConfigError as exc:
            print(f"  {model}（{mode}）：設定錯誤 → {exc}")
            continue
        parsed = sum(a is not None for a in answers)
        expected = sum(a == e for a, (_, _, e) in zip(answers, SAMPLES))
        print(f"  {model}（{mode}）：可解析 {parsed}/{len(SAMPLES)}、符合預期 {expected}/{len(SAMPLES)} → {answers}")
        if parsed == 0:
            for tokens in (32, 1024):
                dump_raw(model, system_instruction, tokens)
        if parsed == len(SAMPLES):
            print(f"\n建議：GEMINI_MODEL = {model!r}、GEMINI_SYSTEM_INSTRUCTION = {system_instruction}")
            return True
    return False


def main() -> int:
    if not GEMINI_API_KEY:
        print("未設定 GEMINI_API_KEY（backend/.env 或環境變數）")
        return 1
    for model in CANDIDATES:
        if probe(model):
            return 0
    print("\n所有候選都無法正常回答")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
