/**
 * 新聞標題的主題標籤（參考 OX 新聞頁：標題下列出相關標的，熱詞可以篩選）。
 * 用固定的英文詞表比對美股新聞標題，換成中文標籤。只比對標題文字，不是模型判斷，也不影響情緒分數；
 * 詞表刻意保守，寧可漏標，不要標錯。
 */
export type Topic = { key: string; label: string; re: RegExp };

export const TOPICS: Topic[] = [
  { key: "earnings", label: "財報", re: /\b(earnings|quarterly|revenues?|eps|profits?)\b/i },
  { key: "guidance", label: "財測", re: /\b(guidance|outlook|forecasts?)\b/i },
  {
    key: "analyst",
    label: "分析師",
    re: /\b(upgrades?|upgraded|downgrades?|downgraded|price targets?|ratings?|outperform|underperform|overweight|underweight|analysts?)\b/i,
  },
  {
    key: "move",
    label: "股價異動",
    re: /\b(trading (lower|higher)|jumps?|surges?|soars?|plunges?|tumbles?|slumps?|sinks?|slides?|rall(y|ies)|dips?|movers?|falls?|fell|drops?|dropped|declines?|rises?|rose|climbs?|sell-?offs?)\b/i,
  },
  { key: "ai", label: "AI", re: /\b(ai|artificial intelligence|openai|chatgpt|genai|llms?)\b/i },
  { key: "chips", label: "晶片", re: /\b(chips?|chipmakers?|semiconductors?|gpus?|foundr(y|ies)|wafers?)\b/i },
  { key: "supply", label: "訂單與生產", re: /\b(orders?|production|supply chain|suppliers?|shipments?|inventor(y|ies))\b/i },
  { key: "trade", label: "關稅與貿易", re: /\b(tariffs?|trade (war|deal)s?|export controls?|sanctions?)\b/i },
  { key: "rates", label: "利率", re: /\b(fed|federal reserve|rate (cut|hike)s?|interest rates?|inflation|cpi|powell|treasur(y|ies)|yields?)\b/i },
  {
    key: "legal",
    label: "監管與訴訟",
    re: /\b(lawsuits?|sues?|sued|antitrust|probes?|investigations?|regulators?|sec|doj|ftc|fined?|court|ruling|jury|verdicts?|settlements?)\b/i,
  },
  { key: "people", label: "人事", re: /\b(ceo|cfo|executives?|layoffs?|job cuts|employees|resigns?|steps down)\b/i },
  { key: "deals", label: "併購與合作", re: /\b(acquires?|acquired|acquisitions?|mergers?|takeovers?|buyouts?|stake in|partnerships?|partners with)\b/i },
  { key: "payout", label: "股利與庫藏股", re: /\b(dividends?|buybacks?|repurchases?)\b/i },
  {
    key: "market",
    label: "大盤",
    re: /\b(dow|s&p( 500)?|nasdaq|stock market|futures|indexes|indices|sector update|stocks to watch|mag(nificent)? ?7|wall street)\b/i,
  },
  { key: "crypto", label: "加密貨幣", re: /\b(bitcoin|crypto(currency|currencies)?|ethereum|solana|blockchain|tokeni[sz]ed|stablecoins?)\b/i },
];

const LABEL = new Map(TOPICS.map((t) => [t.key, t.label]));

/** 標題符合的主題，依 TOPICS 的順序 */
export function titleTopics(title: string): Topic[] {
  return TOPICS.filter((t) => t.re.test(title));
}

/** 標籤鍵的顯示文字：主題用中文標籤，代號照原樣 */
export function tagLabel(key: string): string {
  return LABEL.get(key) ?? key;
}
