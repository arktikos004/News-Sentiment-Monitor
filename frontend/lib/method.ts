/**
 * 「方法與限制」的數字、報告連結與評分器名稱：各頁的說明都從這裡取，同一個數字只寫一次。
 * 出處：同來源測試集 backend/artifacts/bert-combined/metadata.json；線上盲標 docs/confirmation_2026-09-03.md；
 * 台股回測 docs/alert_backtest.md；換評分器的規則 docs/scorer_switch_prereg.md。
 */

const DOCS = "https://github.com/arktikos004/News-Sentiment-Monitor/blob/master/docs";

export const DOC_URL = {
  confirmation: `${DOCS}/confirmation_2026-09-03.md`,
  targetSentiment: `${DOCS}/experiment_target_sentiment.md`,
  indexRevision: `${DOCS}/sentiment_index_revision.md`,
  alertBacktest: `${DOCS}/alert_backtest.md`,
  scorerSwitch: `${DOCS}/scorer_switch_prereg.md`,
} as const;

/** 站內的「方法與限制」頁 */
export const METHOD_PATH = "/method";

/** 美股標題分類（bert-combined）：同來源測試集與線上盲標 */
export const US_MODEL = {
  name: "bert-combined",
  testMacroF1: 0.875,
  testN: 2859,
  online: { n: 60, agreed: 36, negativeRecall: 0.462, from: "2026-08-10", to: "2026-08-13", pVsPrevious: 0.804 },
} as const;

export const ONLINE_AGREEMENT = US_MODEL.online.agreed / US_MODEL.online.n;

/** 台股開盤前查證清單的歷史回測：只用本機的 Gemma 3 27B 評分過 */
export const TW_BACKTEST = {
  scorer: "llm-gemma3:27b",
  from: "2024-09",
  to: "2025-11",
  events: 21,
  judged: 17,
  early: 4,
  sameDayJudged: 12,
  sameDay: 0,
  p: 0.983,
} as const;

const SCORER_NAMES: [RegExp, string][] = [
  [/^llm-gemini:gemma-4-26b-a4b-it\b/, "Gemma 4 26B（Google AI Studio）"],
  [/^llm-gemma3:27b$/, "Gemma 3 27B（本機）"],
];

/** 評分器的版本字串 → 讀得懂的名稱；不認得的照原樣顯示 */
export function scorerLabel(scorer: string): string {
  return SCORER_NAMES.find(([re]) => re.test(scorer))?.[1] ?? scorer;
}

/** 這個評分器做過歷史回測嗎（只有回測用的那一個做過） */
export function backtested(scorer: string): boolean {
  return scorer === TW_BACKTEST.scorer;
}
