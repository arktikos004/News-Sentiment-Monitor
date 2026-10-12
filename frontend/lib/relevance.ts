/**
 * 新聞標題是否提到這一檔：代號本身或公司常用名稱。yfinance 的新聞源會混進大盤綜述與其他公司的報導，
 * 總覽的預覽把有提到的排前面，沒提到的加註，讓使用者知道情緒指數裡含有這類標題。
 * ETF（QQQ、SPY）本來就是市場綜合，不判斷，回 null。
 */
const NAMES: Record<string, string[]> = {
  AAPL: ["apple", "iphone"],
  MSFT: ["microsoft"],
  NVDA: ["nvidia"],
  GOOG: ["google", "alphabet"],
  AMZN: ["amazon"],
  META: ["meta platforms", "facebook", "instagram", "meta's"],
  TSLA: ["tesla"],
  AVGO: ["broadcom"],
  AMD: ["advanced micro devices"],
  INTC: ["intel"],
  MU: ["micron"],
  NFLX: ["netflix"],
  QCOM: ["qualcomm"],
  ORCL: ["oracle"],
  ADBE: ["adobe"],
  CRM: ["salesforce"],
  ASML: [],
  ARM: ["arm holdings"],
  TSM: ["tsmc", "taiwan semiconductor"],
  UMC: ["united microelectronics"],
  ASX: ["ase technology"],
  CHT: ["chunghwa"],
};

const ETF = new Set(["QQQ", "SPY"]);

/** 公司名稱整詞比對（不分大小寫，容許所有格與複數）：intel 不會比對到 Intelligence */
function nameRe(name: string): RegExp {
  return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:'s|s)?\\b`, "i");
}

export function mentionsTicker(ticker: string, title: string): boolean | null {
  if (ETF.has(ticker)) return null;
  const t = title.toLowerCase();
  if (new RegExp(`(^|[^a-z])${ticker.toLowerCase()}([^a-z]|$)`).test(t)) return true;
  return (NAMES[ticker] ?? []).some((n) => nameRe(n).test(title));
}

/**
 * 標題提到了哪些追蹤中的美股（新聞列的關鍵字標籤用）。代號要是全大寫的獨立字，避免 ARM、MU 這類一般英文字誤判；
 * 公司名稱不分大小寫。ETF 只認代號。
 */
export function mentionedTickers(title: string): string[] {
  const found = Object.entries(NAMES)
    .filter(([ticker, names]) => new RegExp(`\\b${ticker}\\b`).test(title) || names.some((n) => nameRe(n).test(title)))
    .map(([ticker]) => ticker);
  for (const etf of ETF) if (new RegExp(`\\b${etf}\\b`).test(title)) found.push(etf);
  return found;
}
