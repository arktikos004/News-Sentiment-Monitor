/**
 * 新聞標題的主題標籤（參考 OX 新聞頁：標題下列出相關標的與熱詞）。
 * - 美股新聞：英文詞表比對標題，換成中文主題標籤
 * - 台股警示的證據標題：中文詞表比對
 * 比對不到主題就不加標籤，不從標題另外取字（取出來的多半是 Forget、Chasing 這類沒有資訊的字）。
 * 只比對標題文字，不是模型判斷，也不影響情緒分數；詞表刻意保守，寧可漏標，不要標錯。
 */

/**
 * phrase：多字片語，先比對，比對到的文字遮掉後才比對各主題的 word（單字）。
 * 所以「Treasury share cancellation」是庫藏股與股本，不會因為 Treasury 又被標成債券與利率；
 * 單獨的 treasury、yield、cancellation 意思不明（財政部、股利殖利率、取消訂閱），只在片語裡才算。
 * needs：word 比對到之後，標題還要同時符合這個條件才算——drop、jump、surge 這類字也用來講出貨量、營收，
 * 要和 stock、shares 這類字一起出現才是股價異動。
 */
export type Topic = { key: string; label: string; phrase?: RegExp; word?: RegExp; needs?: RegExp };

export const TOPICS: Topic[] = [
  { key: "earnings", label: "財報", word: /\b(earnings|quarterly|revenues?|eps|profits?)\b/i },
  { key: "guidance", label: "財測", word: /\b(guidance|outlook|forecasts?)\b/i },
  {
    key: "analyst",
    label: "分析師",
    phrase: /\bprice targets?\b/gi,
    word: /\b(upgrades?|upgraded|downgrades?|downgraded|ratings?|outperform|underperform|overweight|underweight|analysts?)\b/i,
  },
  {
    key: "move",
    label: "股價異動",
    phrase: /\b(trading (lower|higher)|sell-?offs?|(stock|market) movers?)\b/gi,
    word: /\b(jump(s|ed)?|surge(s|d)?|soar(s|ed)?|plunge(s|d)?|tumble(s|d)?|slump(s|ed)?|sinks?|sank|slides?|slid|rall(y|ies|ied)|dip(s|ped)?|falls?|fell|drop(s|ped)?|decline(s|d)?|rises?|rose|climb(s|ed)?)\b/i,
    needs: /\b(stocks?|shares?|share price|market|premarket|after-hours)\b/i,
  },
  { key: "ai", label: "AI", phrase: /\bartificial intelligence\b/gi, word: /\b(ai|openai|chatgpt|genai|llms?)\b/i },
  { key: "chips", label: "晶片", word: /\b(chips?|chipmakers?|semiconductors?|gpus?|foundr(y|ies)|wafers?)\b/i },
  {
    key: "supply",
    label: "訂單與生產",
    phrase: /\bsupply chains?\b/gi,
    word: /\b(orders?|production|suppliers?|shipments?|inventor(y|ies))\b/i,
  },
  { key: "trade", label: "關稅與貿易", phrase: /\b(trade (wars?|deals?)|export controls?)\b/gi, word: /\b(tariffs?|sanctions?)\b/i },
  {
    key: "capital",
    label: "庫藏股與股本",
    phrase:
      /\b(treasury (shares?|stocks?)( cancell?ations?)?|(share|stock) (cancell?ations?|buybacks?|repurchases?)|(cancell?ation|retirement)s? of (treasury )?shares)\b/gi,
    word: /\b(buybacks?|repurchases?)\b/i,
  },
  {
    key: "rates",
    label: "債券與利率",
    phrase:
      /\b((treasury|bond|\d+-year) (yields?|notes?|bonds?|bills?)|federal reserve|rate (cuts?|hikes?)|interest rates?)\b/gi,
    word: /\b(fed|inflation|cpi|powell|treasuries|bonds?)\b/i,
  },
  {
    key: "legal",
    label: "監管與訴訟",
    word: /\b(lawsuits?|sues?|sued|antitrust|probes?|investigations?|regulators?|sec|doj|ftc|fined?|court|ruling|jury|verdicts?|settlements?)\b/i,
  },
  { key: "people", label: "人事", phrase: /\b(job cuts|steps down)\b/gi, word: /\b(ceo|cfo|executives?|layoffs?|employees|resigns?)\b/i },
  {
    key: "deals",
    label: "併購與合作",
    phrase: /\b(stake in|partners with)\b/gi,
    word: /\b(acquires?|acquired|acquisitions?|mergers?|takeovers?|buyouts?|partnerships?)\b/i,
  },
  { key: "payout", label: "股利", phrase: /\bdividend yields?\b/gi, word: /\b(dividends?|payouts?)\b/i },
  {
    key: "market",
    label: "大盤",
    phrase: /\b(s&p( 500)?|stock market|sector update|stocks to watch|mag(nificent)? ?7|wall street)\b/gi,
    word: /\b(dow|nasdaq|futures|indexes|indices)\b/i,
  },
  { key: "crypto", label: "加密貨幣", word: /\b(bitcoin|crypto(currency|currencies)?|ethereum|solana|blockchain|tokeni[sz]ed|stablecoins?)\b/i },
];

/** 台股證據標題的中文詞表，依查證時的重要性排序（每則最多顯示前幾個） */
export const TW_TOPICS: { key: string; label: string; re: RegExp }[] = [
  { key: "tw-filing", label: "重訊", re: /重訊|重大訊息/ },
  { key: "tw-response", label: "公司回應", re: /澄清|官方這樣說|親上火線|出面說明|回應|自清/ },
  { key: "tw-regulator", label: "主管機關", re: /金管會|證交所|櫃買中心|經濟部|主管機關|裁罰|重罰|遭罰|罰款|罰鍰/ },
  { key: "tw-judicial", label: "司法調查", re: /調查局|檢調|搜索|起訴|檢方|法官|判決|訴訟|官司/ },
  { key: "tw-security", label: "資安事件", re: /資安|駭客|遇駭|遭駭|網攻|入侵|外洩/ },
  { key: "tw-governance", label: "公司治理", re: /內控|治理|弊案|掏空|股務/ },
  { key: "tw-disposition", label: "處置與注意股", re: /處置|注意股|警示股/ },
  { key: "tw-revenue", label: "營收", re: /營收/ },
  { key: "tw-eps", label: "EPS", re: /(?<![A-Za-z])EPS(?![A-Za-z])|每股(純益|盈餘)/i },
  { key: "tw-profit", label: "獲利", re: /獲利|毛利|盈餘|淨利|狂賺|虧損/ },
  { key: "tw-target", label: "目標價", re: /目標價/ },
  { key: "tw-rating", label: "評等", re: /降評|升評|評等|雙降|雙升/ },
  { key: "tw-revise-up", label: "上修", re: /上修|調升|上調/ },
  { key: "tw-revise-down", label: "下修", re: /下修|調降|下調/ },
  { key: "tw-dividend", label: "除權息", re: /除權|除息|股利|配息|股息|畸零股|高殖利率|現金殖利率/ },
  { key: "tw-funding", label: "籌資", re: /可轉債|ECB|GDR|現金增資|現增|私募/ },
  { key: "tw-call", label: "法說會", re: /法說/ },
  { key: "tw-orders", label: "出貨與訂單", re: /出貨|訂單|接單|拉貨|產能/ },
  { key: "tw-institutions", label: "法人買賣", re: /外資|投信|自營商|法人|賣超|買超|提款|減碼|加碼/ },
  { key: "tw-chips", label: "籌碼", re: /千張大戶|大戶|籌碼|融資|融券|借券|當沖|散戶/ },
  { key: "tw-insider", label: "內部人持股", re: /申報轉讓|內部人/ },
  { key: "tw-index", label: "成分股調整", re: /成分股|換血|剔除|踢出|刪除名單/ },
  { key: "tw-people", label: "人事", re: /董事長|總經理|執行長|財務長|董座|辭任|接任|裁員|跳槽/ },
  // 「殖利率」單獨出現多半是股利殖利率，只有美債、公債的殖利率才算利率；「利率」也不能比對到「殖利率」裡
  { key: "tw-rates", label: "債券與利率", re: /美債|公債|(?<!殖)利率|升息|降息|聯準會|Fed/ },
  { key: "tw-commodity", label: "原物料", re: /原油|油價|油氣|天然氣|鋼價|銅價|原物料/ },
  { key: "tw-us", label: "美股連動", re: /ADR|美股|費半|那斯達克|道瓊/ },
  { key: "tw-ai", label: "AI", re: /(?<![A-Za-z])AI(?![A-Za-z])|人工智慧/ },
  { key: "tw-semis", label: "半導體", re: /半導體|晶片|晶圓|ASIC|先進製程|封裝|CPO|載板|ABF/ },
  { key: "tw-apple", label: "蘋果供應鏈", re: /蘋果|蘋概|iPhone|摺疊機/i },
  { key: "tw-etf", label: "ETF", re: /(?<![A-Za-z])ETF|(?<!\d)00\d{3,4}[A-Z]?(?!\d)/i },
  {
    key: "tw-move",
    label: "股價異動",
    re: /重挫|下跌|跌破|崩跌|跌逾|挫逾|下殺|走弱|慘崩|翻黑|跌勢|大跌|暴跌|領跌|走跌|下挫|反挫|急挫|重摔|摔破|摔\d|翻車|熄火|跌跤|拉回|漲停|跌停|大漲|狂飆|飆天價|上漲|走高|收高|新高|新低/,
  },
  { key: "tw-market", label: "大盤", re: /台股|大盤|加權指數|權值股|台指期/ },
];

const LABEL = new Map([...TOPICS, ...TW_TOPICS].map((t) => [t.key, t.label]));

/** 美股標題符合的主題，依 TOPICS 的順序：先比對片語並遮掉，再比對單字 */
export function titleTopics(title: string): Topic[] {
  let text = title.normalize("NFKC");
  const hit = new Set<string>();
  for (const t of TOPICS) {
    if (!t.phrase) continue;
    const rest = text.replace(t.phrase, " ");
    if (rest !== text) {
      hit.add(t.key);
      text = rest;
    }
  }
  for (const t of TOPICS) if (t.word?.test(text) && (!t.needs || t.needs.test(title))) hit.add(t.key);
  return TOPICS.filter((t) => hit.has(t.key));
}

/** 台股證據標題符合的主題，依 TW_TOPICS 的順序 */
export function twTitleTopics(title: string): (typeof TW_TOPICS)[number][] {
  const text = title.normalize("NFKC");
  return TW_TOPICS.filter((t) => t.re.test(text));
}

/** 標籤鍵的顯示文字：主題用中文標籤，其他照原樣 */
export function tagLabel(key: string): string {
  return LABEL.get(key) ?? key;
}
