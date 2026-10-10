---
name: 財經新聞情緒監控
description: 預設深色的「行情板」：夜盤藍底、鋼藍品牌色、IBM Plex，給開盤前查證用的研究工具
colors:
  night-ground: "#0b121c"
  surface: "#121b27"
  surface-2: "#1a2533"
  surface-3: "#223042"
  border: "#223044"
  hairline: "rgba(255, 255, 255, 0.06)"
  ink: "#e8eef6"
  ink-2: "#a6b5c8"
  ink-3: "#7a8ca3"
  steel-blue: "#5aa9e6"
  steel-blue-fg: "#06101a"
  steel-blue-soft: "rgba(90, 169, 230, 0.14)"
  pos: "#3fcf8e"
  neu: "#8a9aae"
  neg: "#f46268"
  warn: "#e8a33d"
  alert-amber-high: "#f59e42"
  alert-amber-watch: "#e3c25b"
  div-pos: "#3987e5"
  div-neg-red: "#e66767"
  div-neg-amber: "#d9822b"
  div-mid: "#383835"
  light-ground: "#f2f5f9"
  light-surface: "#ffffff"
  light-surface-2: "#eef2f7"
  light-surface-3: "#e2e8f0"
  light-border: "#d6dfe9"
  light-ink: "#0e1a26"
  light-ink-2: "#3f5266"
  light-ink-3: "#56677b"
  light-steel-blue: "#1f6fb2"
  light-pos: "#0f8a4f"
  light-neu: "#5e6e80"
  light-neg: "#c0262d"
  light-warn: "#9a6212"
  light-alert-amber-high: "#a84a05"
  light-alert-amber-watch: "#7d5c00"
  light-div-pos: "#2a78d6"
  light-div-neg-red: "#e34948"
  light-div-neg-amber: "#c76a14"
  light-div-mid: "#f0efec"
typography:
  hero:
    fontFamily: "IBM Plex Mono, ui-monospace, Cascadia Mono, monospace"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "tnum"
  title:
    fontFamily: "IBM Plex Sans, PingFang TC, Noto Sans TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "IBM Plex Sans, PingFang TC, Noto Sans TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  meta:
    fontFamily: "IBM Plex Sans, PingFang TC, Noto Sans TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
  numeric:
    fontFamily: "IBM Plex Mono, ui-monospace, Cascadia Mono, monospace"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    fontFeature: "tnum"
rounded:
  cell: "3px"
  sm: "8px"
  lg: "12px"
  xl: "14px"
  2xl: "18px"
  full: "9999px"
spacing:
  page-x: "16px"
  page-x-lg: "32px"
  card: "20px"
  stack: "16px"
  stack-lg: "24px"
  section: "32px"
  top-bar: "64px"
  status-strip: "48px"
  status-strip-sm: "32px"
  bottom-bar: "64px"
  side-rail: "256px"
  content-narrow: "768px"
  content-wide: "1152px"
components:
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  badge-alert-high:
    backgroundColor: "rgba(245, 158, 66, 0.14)"
    textColor: "{colors.alert-amber-high}"
    typography: "{typography.meta}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-alert-watch:
    backgroundColor: "rgba(227, 194, 91, 0.13)"
    textColor: "{colors.alert-amber-watch}"
    typography: "{typography.meta}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-caveat:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
    typography: "{typography.meta}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  pill-sentiment-pos:
    backgroundColor: "rgba(63, 207, 142, 0.14)"
    textColor: "{colors.pos}"
    typography: "{typography.meta}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  pill-sentiment-neg:
    backgroundColor: "rgba(244, 98, 104, 0.14)"
    textColor: "{colors.neg}"
    typography: "{typography.meta}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  segmented:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "4px"
  segmented-option:
    textColor: "{colors.ink-3}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    height: "40px"
  segmented-option-active:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
  chip-choice-active:
    backgroundColor: "{colors.steel-blue}"
    textColor: "{colors.steel-blue-fg}"
    typography: "{typography.meta}"
    rounded: "{rounded.full}"
    height: "36px"
  icon-button:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.full}"
    size: "44px"
  icon-button-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
  nav-tab-active:
    backgroundColor: "{colors.steel-blue-soft}"
    textColor: "{colors.steel-blue}"
    typography: "{typography.meta}"
    rounded: "{rounded.full}"
  status-strip:
    textColor: "{colors.ink-3}"
    typography: "{typography.meta}"
    height: "48px"
  caveat-note:
    backgroundColor: "{colors.steel-blue-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    rounded: "{rounded.2xl}"
    padding: "10px 16px"
---

# Design System: 財經新聞情緒監控

## Overview

**Creative North Star: "行情板"**

這是一張夜盤時段的行情板：預設深色，夜盤藍底（`night-ground`）上浮著一層層髮絲線卡片，鋼藍是唯一的品牌色，數字一律用 IBM Plex Mono 等寬對齊。介面密度偏高但不擁擠，研究員在開盤前幾分鐘掃過去，就要知道哪幾檔需要查證、公司有沒有說明。淺色主題是同一張行情板換成白天的紙面：結構、角色與規則不變，只換色值。

顏色帶語意，而且語意因市場而異。美股頁沿用美股慣例：綠色正面、紅色負面。台股頁避開綠色（免得和「跌」混淆），警示等級預設用琥珀（台灣讀者看到紅色會讀成「漲」），設定頁可改成紅色，選擇存在使用者的裝置。資料限制與系統提醒（還沒開盤、資料過期、公告漏收、評分額度用盡）一律用中性灰或鋼藍加圖示，不借用警示色。每處顏色都搭配文字或圖示，顏色不單獨承載語意。

動態節制而一致：大量元素用 CSS keyframes 淡入上移，指示器膠囊用彈簧在選項間滑動，全部尊重「減少動態」設定。載入中的骨架與真實內容同高，資料到了版面不跳。

**Key Characteristics:**
- 預設深色，夜盤藍底，頂部一抹鋼藍光暈給景深
- 髮絲線邊框＋內側高光＋柔和陰影的卡片，大圓角（18px）
- 單一品牌色鋼藍；語意色依市場切換慣例
- 數字一律等寬、表格數字（tabular-nums），文字用 Plex Sans，中文走系統字
- 手機底部 6 分頁列，桌機左側欄；每一頁頂列下方都有固定高度的狀態列
- 膠囊形分段控制，選中的底色用彈簧滑動

## Colors

冷調的夜盤藍中性色階，搭一支鋼藍品牌色，語意色（正／中／負、警示、熱度圖發散色）只在資料上出現。

### Primary
- **鋼藍 Steel Blue**（`steel-blue`；淺色主題 `light-steel-blue`）：品牌色。選中分頁的圖示與文字、連結、焦點外框（2px，offset 2px）、標記被點進來的那張警示卡的外框、門檻模擬的長條、選中的參數膠囊（底色鋼藍、字 `steel-blue-fg`）。淡底 `steel-blue-soft` 用於手機選中分頁的膠囊、品牌圖示底、「還沒開盤」等系統提醒的橫條。狀態列裡有問題的項目也用鋼藍加三角圖示。

### Secondary
- **美股情緒三色**：正面 `pos`（綠）、中性 `neu`（灰藍）、負面 `neg`（紅），各自配 14% 淡底（淺色主題 10%）。只用在美股頁的情緒標籤、信心條、分數與計數。

### Tertiary
- **台股警示配色**：預設琥珀關注度色階，高度異常 `alert-amber-high`、留意 `alert-amber-watch`（淺色主題 `light-alert-amber-high`、`light-alert-amber-watch`），各自配淡底；每個色值在自己的淡底與卡片底上都 ≥ 4.5:1。設定頁選「紅色」時，高度異常沿用 `neg`、留意沿用 `warn`。元件只讀 `--alert-high`／`--alert-watch` 這組變數，不直接寫色值。
- **熱度圖發散色**：正面 `div-pos`（藍）、負面 `div-neg-amber`（琥珀配色）或 `div-neg-red`（紅色配色）、中性 `div-mid`（深色主題是暖灰、淺色主題是近白）。兩極依分數強度以 OKLab 往中性混 25／50／75／100%，亮度單調。沒有新聞的格子留白，只畫一圈髮絲線，不和「中性」混在一起。

### Neutral
- **夜盤藍底 Night Ground**（`night-ground`）：頁面底色，頂部疊一層鋼藍徑向光暈（`--glow`）。iOS 狀態列區域固定畫成這個色。
- **卡片層 Surface / Surface-2 / Surface-3**：卡片本體、卡片內的次層（說明塊、骨架、hover 底）、分段控制的選中底。
- **髮絲線 Hairline**（`hairline`）：卡片邊框、清單分隔線、頂列與底部分頁列的分界。`border` 只用於表單與虛線空狀態。
- **墨色 Ink / Ink-2 / Ink-3**：主文字、次要文字（區段標題、說明）、詮釋資料（時間、來源、單位、標籤）。

### Named Rules
**The Amber-Is-Alert Rule.** 琥珀在台股頁只代表警示等級（高度異常、留意）與熱度圖的負值，不代表漲跌，也不拿來當提醒色。

**The Caveat-Is-Not-Alert Rule.** 資料限制與系統提醒用中性灰（`surface-2` 底、`ink-2` 字）或鋼藍，並一定附圖示（CircleAlert、Clock、Info、TriangleAlert）；不用琥珀或紅色。

**The Two-Markets Rule.** 美股頁綠正紅負；台股頁不出現綠色，正面在熱度圖用藍色。

**The Never-Color-Alone Rule.** 每個語意色都有文字（「高度異常」「負面」）或圖示同行，色盲與灰階下也讀得懂。

## Typography

**Display Font:** IBM Plex Mono（只給大數字，搭 ui-monospace）
**Body Font:** IBM Plex Sans（with PingFang TC、Noto Sans TC、Microsoft JhengHei、system-ui）
**Label/Mono Font:** IBM Plex Mono（情緒分數、信心、z 值、代號、日期）

**Character:** Plex Sans 管介面文字，中文落到系統黑體；Plex Mono 只給數字，讓分數像行情板上的報價一樣對齊。只載入 400 與 600 兩個字重。

### Hierarchy
- **Hero**（Mono 600，3rem，行高 1，字距 -0.025em）：美股情緒指數的大數字，一頁最多一個。
- **Title**（Sans 600，1.25rem，行高 1.3）：頁面標題、卡片內的公司名、區塊標題；搭 Mono 時是 z 值、交易日、警示摘要的檔數。
- **Body**（Sans 400，0.9375rem，行高 1.55）：新聞標題、證據標題、說明文字；強調用 600。
- **Meta**（Sans 400，0.75rem，行高 1.4）：時間、來源、單位、狀態列、徽章；區段小標用 600 加 `ink-2`。不用全大寫、不加字距。

### Named Rules
**The Mono-Numbers Rule.** 會被比較的數字（分數、z 值、則數、日期、代號）一律 Plex Mono 加 tabular-nums；中文說明不用等寬。

**The Two-Weights Rule.** 只有 400 與 600 兩個字重；層級靠字級與墨色深淺，不靠更多字重。

## Layout

手機優先、單欄堆疊；到 `lg`（1024px）時改為左側欄（256px）加內容區，底部分頁列消失。內容寬度兩檔：窄版 768px（設定）、寬版 1152px（總覽、警示、產業），頂列與 `main` 共用同一個寬度，左右邊界對齊。左右內距手機 16px、桌機 32px；卡片之間 16px（桌機兩欄 24px），總覽的大區塊之間 32px。

**頂列與狀態列：** 頂列高 64px，黏在 iOS 安全區下方，毛玻璃（底色 75% 不透明、`backdrop-blur-xl`、飽和 150%）。狀態列緊接其下、每一頁都有，高度固定：手機 48px（最多兩行）、`sm` 以上 32px（一行，超出可橫向捲動）。載入中先放兩條同高的骨架，讀不到時直接寫「讀不到」，頂列永遠不跳動。有問題的項目排最前面。

**警示頁兩欄：** 手機是一張張警示卡；`lg` 起左欄是可排序的密集清單（0.9fr），右欄是選中那檔的詳情卡（1.1fr），黏在頂列加狀態列下方。總覽的美股區在 `lg` 也是兩欄，最新新聞那欄同樣黏住。

**手機底部分頁列：** 6 個分頁各佔一欄（總覽、新聞、追蹤、警示、產業、設定），高 64px 加安全區，毛玻璃；內容底部留出對應的內距。

**卡片內的查證順序：** 警示卡由上而下固定是證據標題 → 公司重大訊息 → 分數數字 → 近 5 個交易日走勢（可收合，手機預設收起、桌機詳情預設展開）。

**The No-Jump Rule.** 每個會非同步載入的區塊，骨架高度貼近真實內容；資料到了不把下方內容往下推。

## Elevation & Depth

混合式：深色主題上用「內側 1px 高光＋柔和外陰影」讓卡片從夜盤藍底浮起，再加一圈半透明髮絲線收邊；卡片內的次層靠 `surface-2`／`surface-3` 的色階疊出層次，不再加陰影。頁首的鋼藍徑向光暈只給整頁一點景深。

### Shadow Vocabulary
- **Card**（深色 `box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(2,6,12,0.35)`；淺色 `0 1px 2px rgba(14,26,38,0.05), 0 8px 24px rgba(14,26,38,0.06)`）：所有卡片、側欄選中項的底、分段控制選中的膠囊。
- **Float**（深色 `0 16px 40px rgba(2,6,12,0.6)`；淺色 `0 16px 40px rgba(14,26,38,0.18)`）：提示訊息（toast）等浮在內容上方的層。

### Named Rules
**The Hairline-Card Rule.** 卡片 = 18px 圓角 + 1px 髮絲線 + Card 陰影 + `surface` 底，集中在一個 `card` utility；不另外發明卡片樣式。

## Shapes

圓潤但不軟爛。卡片 18px；卡片內的區塊、日期切換鈕、說明塊 14px；骨架、設定列的圖示方塊 12px；徽章、標籤、分段控制、圖示按鈕、分頁膠囊一律全圓角。熱度圖的格子是 3px 小方塊，圖例方塊 2px，長條頂端 4px。邊框只有一種重量：1px。

## Components

### Buttons
- **Shape:** 全圓角膠囊或圓形。
- **Icon Button:** 44px 圓形，`ink-2` 圖示（19–20px），hover 換 `surface-2` 底、`ink` 色，停用時 50% 透明。按下縮放到 0.97。
- **Text Link Button:** 鋼藍文字加右箭頭（「看完整警示」「看全部 N 則」），最小高度 44px。
- **Choice Chip:** 參數選擇用 36px 高膠囊，未選 `surface-2` 底，選中鋼藍底、`steel-blue-fg` 字、600。
- **Focus:** 全站 2px 鋼藍外框，offset 2px。

### Chips
- **警示等級徽章：** 全圓角，淡底配同色字，meta 600，前面一個 12px 圖示（高度異常 Siren、留意 TriangleAlert、正常 CircleCheck、資料不足 CircleHelp）。正常與資料不足用 `surface-2` 底。
- **情緒標籤（美股）：** 全圓角，`pos`／`neu`／`neg` 淡底配同色字，附趨勢圖示與 Mono 信心百分比。
- **提醒標籤：** `surface-2` 底、`ink-2` 字，附 CircleAlert；「澄清」公告用鋼藍淡底。
- **關鍵字標籤：** 每則新聞標題下方一列全圓角小標籤，meta 字級、不可點。
  - 美股新聞：標題提到的其他追蹤標的用 `steel-blue-soft` 底、鋼藍 Mono 代號（最多 2 個）；主題（財報、分析師、股價異動、大盤…）用 `surface-2` 底、`ink-2` 字（最多 3 個），來自 `lib/topics.ts` 的英文詞表。兩者都沒有時，從標題取 2 個重點字補上（專有名詞樣式優先），樣式同主題。
  - 台股警示卡的證據標題：中文詞表比對出的主題（最多 3 個，依查證重要性排序：重訊、公司回應、主管機關…股價異動、大盤）；比對不到時用 Intl.Segmenter 斷詞取 2 個重點字，排除這檔自己的名稱與代號。
  - 只比對標題文字，不是模型判斷，也不影響情緒分數；新聞分頁的情緒篩選下方有一行 meta 說明。

### Cards / Containers
- **Corner Style:** 18px。
- **Background:** `surface`；內層說明塊 `surface-2`，系統提醒橫條 `steel-blue-soft`。
- **Shadow Strategy:** Card 陰影（見 Elevation & Depth）。
- **Border:** 1px 髮絲線。
- **Internal Padding:** 20px（熱度圖與門檻模擬卡 16px）；清單列 16px 左右、14px 上下，以髮絲線分隔。

### Inputs / Fields
- **分段控制：** 全圓角容器，髮絲線邊框，4px 內距；選項 40px 高，未選 `ink-3`、hover `ink-2`；選中底（`surface-3`，或設定頁的 `surface` 加 Card 陰影）用彈簧在選項間滑動。
- **日期：** 不直接露出原生欄位；整個日期按鈕（Mono 標題字級加星期）開啟系統日期選擇器，左右各一個圖示按鈕切換前後交易日。

### Navigation
- **桌機側欄：** 256px，上方品牌標誌（鋼藍淡底方塊），分頁列 44px 高、14px 圓角；選中項是一塊帶 Card 陰影的 `surface` 底，圖示轉鋼藍、文字 600，底塊在分頁間滑動。底部放免責聲明。
- **手機底部分頁列：** 6 欄，圖示 21px 疊在 meta 標籤上；選中項是 56×32px 的鋼藍淡底膠囊，圖示與文字轉鋼藍、線寬加粗到 2.2。

### 警示卡（Signature）
公司名（Title）＋ Mono 代號，下方等級徽章；右上 Mono z 值，用警示色。內容依查證順序：證據標題（最多 3 則，前面是警示色小圓點，連結底線用髮絲線、hover 轉鋼藍）→ 公司重大訊息（Megaphone 圖示、狀態標籤、公開資訊觀測站連結）→ 當日分數／20 日基準／則數的 Mono 數字 → 可收合的近 5 日走勢。從總覽點進來的那一張加 2px 鋼藍外框。

### 狀態列（Signature）
`dl` 形式的「標籤：值」列，標籤 `ink-3`、值 `ink` 600；有問題的值轉鋼藍並加 TriangleAlert，排到最前。

### 產業熱度圖（Signature）
產業 × 交易日的格子，間距 2px，格高 20px；當天有股票觸發警示的格子中央放一顆 `ink` 小圓點。附圖例（發散色階、無新聞、警示記號）與可展開的數字表格。

## Do's and Don'ts

### Do:
- **Do** 讓台股警示等級只讀 `--alert-high`／`--alert-watch`，配色切換由 `data-alert-palette` 決定。
- **Do** 用中性灰或鋼藍加圖示表達資料限制與系統提醒。
- **Do** 美股頁用 `pos` 綠正面、`neg` 紅負面；台股頁的正面用 `div-pos` 藍。
- **Do** 所有比較用數字用 Plex Mono 加 tabular-nums。
- **Do** 卡片一律走 `card` utility（18px、髮絲線、Card 陰影）。
- **Do** 骨架與真實內容同高；狀態列高度固定（手機 48px、`sm` 以上 32px）。
- **Do** 警示卡依證據標題 → 重大訊息 → 數字 → 走勢的順序排列。
- **Do** 觸控目標至少 44px，焦點用 2px 鋼藍外框。
- **Do** 進場只動 transform 與 opacity，並遵守減少動態設定。

### Don't:
- **Don't** 在台股頁用綠色，也不要讓琥珀出現在警示等級與熱度圖負值以外的地方。
- **Don't** 用琥珀或紅色表示「還沒開盤」「資料過期」「公告漏收」這類資料限制。
- **Don't** 讓顏色單獨承載語意；徽章、標籤、提醒都要有文字或圖示。
- **Don't** 把「沒有新聞」畫成中性灰；熱度圖的空格只留一圈髮絲線。
- **Don't** 加入 400、600 以外的字重，或為中文介面加全大寫與字距。
- **Don't** 在淺色主題改動結構或角色，只換色值。
