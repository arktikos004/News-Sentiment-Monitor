import type { NewsItem } from "@/lib/api";

/**
 * 美股新聞與所選標的的相關性。
 * 後端（newssent/inference/relevance.py）替每則新聞算好 direct、in_index、mentioned_tickers、related_tickers，
 * 這裡負責分組，並組出畫面上的理由——理由只寫標題與新聞源能支持的內容，不另外生成分析。
 * 舊版靜態檔沒有這些欄位時（新版上線後到下一次排程之間）不分組，照舊顯示單一列表，並用下方的別名表在瀏覽器比對。
 *
 * 別名表與後端 config.TICKER_ALIASES／TICKER_ALIASES_CASED 相同：名稱整詞比對、不分大小寫；
 * cased 的別名同時是一般英文字，大小寫完全相同才算；代號要是獨立、全大寫的字。
 */
const ALIASES: Record<string, string[]> = {
  AAPL: ["Apple", "iPhone"],
  MSFT: ["Microsoft"],
  NVDA: ["Nvidia"],
  GOOG: ["Google", "Alphabet"],
  AMZN: ["Amazon"],
  META: ["Meta Platforms", "Facebook", "Instagram"],
  TSLA: ["Tesla"],
  AVGO: ["Broadcom"],
  AMD: ["Advanced Micro Devices"],
  INTC: ["Intel"],
  MU: ["Micron"],
  NFLX: ["Netflix"],
  QCOM: ["Qualcomm"],
  ORCL: ["Oracle"],
  ADBE: ["Adobe"],
  CRM: ["Salesforce"],
  ARM: ["Arm Holdings"],
  TSM: ["TSMC", "Taiwan Semiconductor", "Taiwan Semi"],
  UMC: ["United Microelectronics"],
  ASX: ["ASE Technology"],
  CHT: ["Chunghwa"],
  ASML: [],
};
const CASED: Record<string, string[]> = { GOOG: ["GOOGL"], META: ["Meta"], ARM: ["Arm"], ASX: ["ASE"] };
const ETF = new Set(["QQQ", "SPY"]);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tickerRe = (ticker: string) => new RegExp(`(?<![A-Za-z])${esc(ticker)}(?![A-Za-z])`);

/** 標題裡第一個符合的字詞（名稱、分大小寫的別名或代號）；都沒有回 null */
function matched(ticker: string, title: string): string | null {
  for (const name of ALIASES[ticker] ?? []) {
    const m = title.match(new RegExp(`\\b${esc(name)}(?:'s|’s|s)?\\b`, "i"));
    if (m) return name;
  }
  for (const name of CASED[ticker] ?? []) if (new RegExp(`\\b${esc(name)}(?:'s|’s)?\\b`).test(title)) return name;
  return tickerRe(ticker).test(title) ? ticker : null;
}

export const isEtf = (ticker: string) => ETF.has(ticker);

/** 標題有沒有提到這一檔；ETF 是市場綜合，一律算有 */
export function mentionsTicker(ticker: string, title: string): boolean {
  return ETF.has(ticker) || matched(ticker, title) != null;
}

/** 標題提到了哪些追蹤中的美股（不含 exclude）；ETF 只認代號 */
export function mentionedTickers(title: string, exclude?: string): string[] {
  const found = Object.keys(ALIASES).filter((t) => t !== exclude && matched(t, title) != null);
  for (const etf of ETF) if (etf !== exclude && tickerRe(etf).test(title)) found.push(etf);
  return found;
}

/** 這一檔比對用的字詞（後端的 target_aliases 優先；沒有時用本檔的別名表） */
export function aliasesOf(ticker: string, fromApi?: string[]): string[] {
  if (fromApi && fromApi.length > 0) return fromApi;
  return [...(ALIASES[ticker] ?? []), ...(CASED[ticker] ?? []), ticker];
}

/** 畫面上稱呼這一檔的名稱：第一個不是代號的別名（Apple），沒有就用代號 */
export function displayName(ticker: string, fromApi?: string[]): string {
  return aliasesOf(ticker, fromApi).find((a) => a !== ticker) ?? ticker;
}

/** 這批新聞有沒有後端算好的相關性欄位 */
export function hasRelevance(articles: NewsItem[]): boolean {
  return articles.some((a) => a.direct !== undefined);
}

/** 是否計入指數：以後端的 in_index 為準；舊版資料沒有欄位時視為計入 */
export const inIndex = (a: NewsItem) => a.in_index ?? a.direct ?? true;

/** 「標題提到 X」的 X：標題裡實際出現的那個字詞 */
export function mentionText(ticker: string, title: string): string | null {
  return matched(ticker, title);
}

/**
 * 關聯待確認的理由：新聞源為什麼把它收在這一檔，以及為什麼不計入。只陳述新聞源給的關聯與標題的字面。
 */
export function pendingReason(a: NewsItem, ticker: string, name: string): string {
  const related = a.related_tickers ?? [];
  const others = related.filter((t) => t !== ticker);
  const also = others.length > 0 ? `（也關聯 ${others.slice(0, 3).join("、")}${others.length > 3 ? " 等" : ""}）` : "";
  const why = related.length > 0 ? `Yahoo 財經把這則關聯到 ${ticker}${also}` : `新聞源把這則收在 ${ticker} 的新聞裡`;
  return `${why}，標題沒提到 ${name}，不計入指數。`;
}
