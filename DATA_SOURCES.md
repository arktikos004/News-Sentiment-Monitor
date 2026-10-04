# 資料來源與授權

本專案用到的每一項外部資料、資料集與模型，列出來源、授權或使用條款、用途，以及是否對外公開。
套件授權見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)，生成式 AI 的使用見 [AI_USE.md](AI_USE.md)。

## 新聞與市場資料

| 資料 | 來源 | 授權或條款 | 用途 | 是否對外公開 |
| --- | --- | --- | --- | --- |
| 美股英文新聞標題（標題、網址、媒體名稱、發布時間） | Yahoo Finance，經 `yfinance` 套件取得（個股新聞串流；2026-10 起該端點失效，改走搜尋端點） | Yahoo 服務條款：限個人使用，不得再散布；標題的著作權屬原媒體 | 美股情緒指數（24 檔） | 只公開每檔最多 20 則的「標題＋原文連結＋媒體名稱＋情緒判讀」；完整的標題快取以加密封包存放，不公開 |
| 台股中文新聞標題（標題、網址、來源、發布時間） | FinMind API 的 `TaiwanStockNews`（彙整多家媒體） | FinMind 條款：授權範圍限於使用其服務，不含對外再散布、轉售或鏡像；標題的著作權屬原媒體 | 台股情緒預警的評分 | 只公開預警卡上每檔最多 3 則佐證標題（附來源與原文連結）；完整的評分資料庫以加密封包存放，不公開 |
| 台股交易日曆、除權息日 | FinMind API 的 `TaiwanStockTradingDate`、`TaiwanStockDividendResult` | 同上 | 預警回測的事件對齊 | 否 |
| 台股與加權指數股價 | Yahoo Finance，經 `yfinance` | Yahoo 服務條款：限個人使用，不得再散布 | 預警回測（計算事件前後的報酬） | 否；只公開回測的彙總統計 |
| NewsAPI | newsapi.org | 免費 Developer 方案只能在開發環境使用，不得用於正式環境 | 程式保留了介面，**目前沒有啟用** | 否 |

本專案**不抓取、不儲存、不轉載新聞內文**。資料庫只有標題與中繼資料，網站上每一則標題都連回原文。
`docs/` 裡的抽測樣本（共約 150 則英文標題）與回測報告引用的標題，是實驗記錄的一部分，數量有限且註明出處。

### 評分時送出的資料

台股預警的評分呼叫 Google 的 Gemini API（Google AI Studio）。送出的內容只有公司名稱與新聞標題，沒有任何個人資料。
依 Google 免費方案的條款，送出的內容可能被用來改進其產品。

## 訓練資料集

| 資料集 | 來源 | 授權 | 用途 |
| --- | --- | --- | --- |
| Financial PhraseBank v1.0（`Sentences_50Agree`，4,846 句） | Malo et al. (2014)；由 Hugging Face `takala/financial_phrasebank` 下載 | CC BY-NC-SA 3.0（非商業、相同方式分享） | 基線模型 `bert` 的訓練；與 SEntFiN 合併訓練 `bert-combined` |
| SEntFiN 1.0（10,753 則標題，實體層級標注） | Sinha et al. (2022)；由作者的 GitHub `pyRis/SEntFiN` 下載 | MIT | `bert-sentfin`、`bert-combined` 的訓練 |

兩個資料集都是人工標注，沒有用模型產生訓練標籤。

## 預訓練模型與本專案的權重

| 模型 | 提供者 | 授權 | 用途 |
| --- | --- | --- | --- |
| `bert-base-uncased` | Google | Apache-2.0 | 正式模型 `bert-combined` 的起點；五模型比較 |
| `distilbert-base-uncased` | Hugging Face | Apache-2.0 | 五模型比較 |
| `roberta-base` | Meta | MIT | 五模型比較 |
| `gemma3:27b` | Google（Gemma Terms of Use），經本機 Ollama 執行 | Gemma Terms of Use | 實驗 #6 的 LLM 覆核組；2026-09-26 以前的預警評分與預警回測 |
| `gemma-4-26b-a4b-it` | Google，經 Gemini API | Apache-2.0（模型）；Gemini API 服務條款 | 2026-09-27 起的預警評分 |
| Release `models-v1`（`bert-combined.joblib`） | 本專案訓練產物 | CC BY-NC-SA 3.0（承襲 Financial PhraseBank 的條件） | 正式情緒模型 |

## 人工標注

線上抽測共 120 則英文標題，全部由開發者本人標注：

- 2026-07-17 批 30 則：先由 AI 助手初標，開發者逐則複核（29 則維持、1 則修改）。這一批不是盲標，只當參考。
- 2026-08-05 批 30 則、確認實驗批 60 則（2026-09-03 完成）：盲標，標注時看不到模型輸出。

標注者只有一人且就是開發者，無法量測標注者之間的一致性，這是已知的限制。

## 若要商業化，需要更換或取得授權的項目

| 項目 | 現況 | 需要做的事 |
| --- | --- | --- |
| 新聞標題來源 | Yahoo、FinMind，條款都不含對外再散布 | 向新聞媒體或有授權的資料商取得顯示授權 |
| 情緒模型權重 | 訓練資料含非商業授權的 Financial PhraseBank | 改用可商用的語料（SEntFiN 為 MIT）加上自行標注的資料重新訓練，或向 PhraseBank 作者取得商業授權 |
| LLM 評分 | Gemini API 免費方案 | 改用付費方案，或自行部署 Apache-2.0 授權的 Gemma 4 |
