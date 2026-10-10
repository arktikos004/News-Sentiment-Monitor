/**
 * 新聞標題的關鍵字標籤（參考 OX 新聞頁：標題下列出相關標的與熱詞）。
 * - 美股新聞：英文詞表比對標題，換成中文主題標籤
 * - 台股警示的證據標題：中文詞表比對
 * 比對不到主題時，從標題取重點字補足（英文去掉常見字後取專有名詞與較長的字；中文用 Intl.Segmenter 斷詞，做法同 OX 的熱詞）。
 * 只比對標題文字，不是模型判斷，也不影響情緒分數；詞表刻意保守，寧可漏標，不要標錯。
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
    re: /\b(trading (lower|higher)|jump(s|ed)?|surge(s|d)?|soar(s|ed)?|plunge(s|d)?|tumble(s|d)?|slump(s|ed)?|sinks?|sank|slides?|slid|rall(y|ies|ied)|dip(s|ped)?|movers?|falls?|fell|drop(s|ped)?|decline(s|d)?|rises?|rose|climb(s|ed)?|sell-?offs?)\b/i,
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

/** 台股證據標題的中文詞表，依查證時的重要性排序（每則最多顯示前幾個） */
export const TW_TOPICS: Topic[] = [
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
  { key: "tw-dividend", label: "除權息", re: /除權|除息|股利|配息|股息|畸零股/ },
  { key: "tw-funding", label: "籌資", re: /可轉債|ECB|GDR|現金增資|現增|私募/ },
  { key: "tw-call", label: "法說會", re: /法說/ },
  { key: "tw-orders", label: "出貨與訂單", re: /出貨|訂單|接單|拉貨|產能/ },
  { key: "tw-institutions", label: "法人買賣", re: /外資|投信|自營商|法人|賣超|買超|提款|減碼|加碼/ },
  { key: "tw-chips", label: "籌碼", re: /千張大戶|大戶|籌碼|融資|融券|借券|當沖|散戶/ },
  { key: "tw-insider", label: "內部人持股", re: /申報轉讓|內部人/ },
  { key: "tw-index", label: "成分股調整", re: /成分股|換血|剔除|踢出|刪除名單/ },
  { key: "tw-people", label: "人事", re: /董事長|總經理|執行長|財務長|董座|辭任|接任|裁員|跳槽/ },
  { key: "tw-rates", label: "利率", re: /殖利率|升息|降息|利率|聯準會|Fed/ },
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

/** 美股標題符合的主題，依 TOPICS 的順序 */
export function titleTopics(title: string): Topic[] {
  return TOPICS.filter((t) => t.re.test(title));
}

/** 台股證據標題符合的主題，依 TW_TOPICS 的順序 */
export function twTitleTopics(title: string): Topic[] {
  const text = title.normalize("NFKC");
  return TW_TOPICS.filter((t) => t.re.test(text));
}

/** 標籤鍵的顯示文字：主題用中文標籤，代號與補足的重點字照原樣 */
export function tagLabel(key: string): string {
  return LABEL.get(key) ?? key;
}

// 英文標題的常見字：功能詞、標題慣用語、泛用的財經字與動詞，取重點字時略過
const EN_STOP = new Set(
  (
    "a an the and or but if of in on at to for from by with about as into over after before than then so not no nor " +
    "is are was were be been being has have had do does did it its this that these those you your we our they their " +
    "he she his her who what why how when where which will would could should can may might must just now here there " +
    "more most less all any some one two three new top big best still also up down out off vs via per amid despite " +
    "against again very much many ever even only enough own next last first since until while " +
    "stock stocks share shares market markets investor investors investing investment today week weeks year years month " +
    "months day days time times buy sell hold report reports news update updates company companies inc corp ltd group " +
    "price prices money says said say sees see set sets gets get make makes made take takes coming going growing paying " +
    "looking revealed reveals announces announced launches launched plans plan expects expected wants needs keeps keep " +
    "remains remain becomes become hits hit adds add think thinks talking nobody everyone something thing things way ways " +
    "look looks right wrong good bad better worse great huge major key heres whats thats theres " +
    "biggest exposure speeding powered nearing gaining quietly surprise surprising underestimating second flat face crazy " +
    "similar levels level million billion trillion thousand percent prediction predictions improved explain explains worth " +
    "five ten half full isn wasn doesn don won forgotten interesting"
  ).split(" "),
);

/**
 * 英文標題的重點字，依序取：專有名詞樣式（全大寫或大小寫混合，例如 UBS、OpenAI）；
 * 標題不是每字大寫時，句中大寫開頭的字（多半是公司或人名）；最後依出現順序補足。
 */
export function enKeyWords(title: string, exclude: string[], n: number): string[] {
  if (n <= 0) return [];
  const ex = new Set(exclude.map((e) => e.toLowerCase()));
  const words = title.normalize("NFKC").match(/[A-Za-z][A-Za-z0-9&]*/g) ?? [];
  const titleCase = words.length > 0 && words.filter((w) => /^[A-Z]/.test(w)).length / words.length >= 0.6;
  const tokens = words.filter((t) => {
    const l = t.toLowerCase();
    return l.length >= 3 && !EN_STOP.has(l) && !ex.has(l) && !TOPICS.some((tp) => tp.re.test(t));
  });
  const unique = [...new Map(tokens.map((t) => [t.toLowerCase(), t])).values()];
  const special = unique.filter((t) => /^[A-Z0-9&]{2,5}$/.test(t) || /[a-z][A-Z]/.test(t));
  const proper = titleCase ? [] : unique.filter((t) => !special.includes(t) && /^[A-Z]/.test(t));
  const rest = unique.filter((t) => !special.includes(t) && !proper.includes(t));
  return [...special, ...proper, ...rest].slice(0, n);
}

// 中文標題的常見字（沿用 OX 熱詞的停用字，加上新聞標題的慣用語）
const ZH_STOP = new Set(
  (
    "以及 相關 表示 今年 今天 昨日 目前 預計 可能 最新 消息 新聞 公告 發布 宣布 報導 指出 美國 台灣 全球 官方 公司 集團 市場 " +
    "投資 投資人 金融 交易 交易所 新增 因為 已經 還有 這個 這次 這些 其中 一個 成為 提供 推出 開放 預告 進行 發展 調整 計畫 " +
    "資訊 來源 更新 即時 快訊 速報 個股 上市櫃 財經 焦點 產業 鉅亨 小編 分析師 股價 股市 股票 一次 完整 必看 曝光 什麼 怎麼 " +
    "為什麼 還是 不是 沒有 可以 如何 最新調查 調查 解析 看法 這檔 這些 哪些 大咖 台北 集中 熱門 族群 萬元 億元 萬張 股東 " +
    "注意 全數 針對 同意 接連 全面 一件 一件事 原因 竟然 依舊 不如 還能 只是 這樣 那些 他們 我們 你們 今日 本週 上月 下半年 " +
    "上半年 操作 日報 情報站 優分析 經濟日報 上報"
  ).split(" "),
);

/** 斷詞前先拿掉欄目名稱（《台北股市》【即時新聞】〈…〉）與結尾的來源（「- 上市櫃」「| 經濟日報」「-CMoney 小編」） */
function zhClean(title: string): string {
  return title
    .normalize("NFKC")
    .replace(/^[^|｜]{1,8}[|｜]\s*/, "")
    .replace(/《[^》]*》|【[^】]*】|〈[^〉]*〉/g, " ")
    .replace(/\s*[-|｜]\s*[^-|｜！？!?，,。]{1,16}$/, "");
}

const ZH_SEGMENTER =
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("zh-TW", { granularity: "word" }) : null;

/** 中文標題的重點字：斷詞後去掉停用字、數字、這檔股票自己的名稱與代號，取較長的詞 */
export function zhKeyWords(title: string, exclude: string[], n: number): string[] {
  if (n <= 0 || !ZH_SEGMENTER) return [];
  const text = zhClean(title);
  const ex = exclude.filter(Boolean);
  const words: string[] = [];
  for (const part of ZH_SEGMENTER.segment(text)) {
    const w = part.segment.trim();
    if (!part.isWordLike || w.length < 2 || w.length > 8 || /^[\d.,%]/.test(w) || ZH_STOP.has(w)) continue;
    if (ex.some((e) => w.includes(e) || e.includes(w)) || TW_TOPICS.some((t) => t.re.test(w))) continue;
    if (!words.includes(w)) words.push(w);
  }
  return words.sort((a, b) => b.length - a.length).slice(0, n);
}
