# 基於自然語言處理之新聞情緒分析與即時監控系統

[![tests](https://github.com/arktikos004/News-Sentiment-Monitor/actions/workflows/leakage.yml/badge.svg)](https://github.com/arktikos004/News-Sentiment-Monitor/actions/workflows/leakage.yml)
[![lint](https://github.com/arktikos004/News-Sentiment-Monitor/actions/workflows/lint.yml/badge.svg)](https://github.com/arktikos004/News-Sentiment-Monitor/actions/workflows/lint.yml)
[![daily](https://github.com/arktikos004/News-Sentiment-Monitor/actions/workflows/daily.yml/badge.svg)](https://github.com/arktikos004/News-Sentiment-Monitor/actions/workflows/daily.yml)

判斷財經新聞標題對該公司股價是好是壞，算成情緒分數：美股看個股新聞情緒，台股在開盤前列出需要先查證的個股。

**公開站：<https://news.sekinv.com>**（網站名稱「財經新聞情緒監控」，每天更新 4 次）

> 個人研究原型。情緒分數與警示供研究與查證參考，**不構成投資建議**。

## 目錄

- [功能](#功能)
- [專案狀態與主要結果](#專案狀態與主要結果)
- [快速開始](#快速開始)
- [重現研究結果](#重現研究結果)
- [專案結構](#專案結構)
- [文件](#文件)
- [問題回報與維護者](#問題回報與維護者)
- [授權](#授權)

## 功能

- **美股新聞情緒**：逐則判讀近期新聞標題（正面／中性／負面），彙總成 −1 到 +1 的情緒指數與關鍵字。
  模型是目標導向的 BERT（`bert-combined`），輸入是（公司名, 標題），答的是「對這支股票是好是壞」而不是標題的語氣。
- **台股開盤前警示**：台灣 50 成分股的中文新聞由 LLM 逐則評分；當日分數對前 20 個交易日的 z 值低於 −1.5 列為「留意」、
  低於 −2 列為「高度異常」。每張警示附上當日最負面的證據標題，並對照證交所的公司重大訊息。
- **產業儀表板與門檻模擬**：產業 × 交易日的情緒熱度圖；調整基準天數、最少則數與 z 門檻，看每天會有幾檔觸發警示。
- **分頁式 App**：總覽、新聞、追蹤、警示、產業、設定；手機是底部分頁列、電腦是左側欄，可以加到主畫面（PWA）。

公開站是靜態站，美股只提供預先計算的 24 檔（`config.STATIC_TICKERS`）；本機跑 API 時可以查任何美股代號。

## 專案狀態與主要結果

每日排程持續運作中（台北時間 07:30、13:30、19:30、01:30），細節見 [docs/deploy.md](docs/deploy.md)。
重要結論都先寫預先聲明再看結果；沒有複製出來的結果照實記錄。人工標注由開發者本人完成，標注時看不到模型輸出
（07-17 那批是 AI 初標再人工複核，其餘為盲標）。

| 項目 | 結果 |
| --- | --- |
| 美股模型選型（[選型依據](docs/model_selection.md)） | 五個模型比較後選 BERT：測試 Macro F1 0.8458（TF-IDF 基線 0.7286） |
| 任務定義修正（[實驗 #6](docs/experiment_target_sentiment.md)） | 從「標題語氣」改成「對這支股票是好是壞」，正式模型換成 `bert-combined`；60 則人工標注一致率 46.7%→61.7%（候選結論） |
| 確認實驗（[結果](docs/confirmation_2026-09-03.md)） | 新的 60 則標注上 60.0% vs 63.3%，p = 0.804，**沒有確認**。換模型的理由是任務定義，正式模型維持 `bert-combined`，但不再宣稱一致率提升 |
| 台股警示回測（[結果](docs/alert_backtest.md)） | 21 件大跌事件，事前 5 日示警率與隨機響鈴無法區分（p = 0.983）：**不宣稱提前預警**，網站只做開盤前的查證清單 |
| 中文小模型蒸餾（[初步實驗](docs/distill_pilot.md)） | κ = 0.639、負面召回 66.4%，依預先聲明的門檻判定「部分可行」；離線實驗，沒有上線 |
| 資料誠信 | 打亂標籤測試、[預訓練污染分析](docs/pretraining_contamination.md)、[時間戳語意](docs/timestamp_semantics.md)（發布到抓取的落差中位數 2.94 小時） |

## 快速開始

需求：Python 3.12（3.11 以上即可）、Node.js 20.9 以上（CI 用 24）。訓練 transformer 需要 NVIDIA GPU，推論用 CPU 即可。

### 後端

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate                       # macOS／Linux：source .venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu   # 有 NVIDIA GPU 改用 .../whl/cu128
pip install -e ".[dev]"
pytest                                       # 全部測試；pytest -m leakage 只跑洩漏防治
uvicorn newssent.api.main:app --port 8001    # 互動式 API 文件在 http://localhost:8001/docs
```

- 沒有模型檔時 API 以 mock 模式啟動（回應的 `is_mock` 為 true）。要用正式模型就執行 `bash scripts/fetch_models.sh`：
  依 `backend/models.lock` 從 GitHub Release 下載並驗證 sha256（需要已登入的 gh CLI）。
- 美股新聞源預設 yfinance（免金鑰）。要改用 NewsAPI：把 `backend/.env.example` 複製成 `.env`、填入 `NEWSAPI_KEY`，
  再把 `config.NEWS_PROVIDER` 改成 `"newsapi"`。
- 推送前的洩漏測試閘門：`powershell -File scripts/install_hooks.ps1`。

台股警示讀的是分數庫 `backend/alert_scores.db`，第一次要先抓新聞並評分：

```powershell
$env:GEMINI_API_KEY = "<Google AI Studio 金鑰>"
$env:FINMIND_TOKEN = "<FinMind token>"          # 可省略，只是每小時額度較低
python -m newssent.inference.alert_recorder    # 抓最近 45 天的中文新聞並評分
```

預設用 Google AI Studio 託管的模型評分（**會把新聞標題送到 Google**）；加 `--backend ollama` 改用本機 Ollama。

### 前端

```powershell
cd frontend
npm install
npm run dev        # http://localhost:3000；/api/* 由 Next 轉送到 :8001（環境變數 API_PROXY_TARGET 可改）
npm test           # lib/ 的單元測試；靜態檢查用 npm run lint
```

用手機看：手機和電腦連同一個 Wi-Fi，在電腦執行 `npm run build; npm start`，手機開 `http://<電腦的區網 IP>:3000`。
後端每個 IP 每分鐘限 30 次、所有端點合計，經 Next 轉送後所有裝置算同一個 IP，多台裝置同時操作可能看到「查詢太頻繁」。

### 主要 API

| 端點 | 說明 |
| --- | --- |
| `GET /api/stocks/{ticker}/sentiment` | 情緒指數與關鍵字 |
| `GET /api/stocks/{ticker}/news` | 新聞與逐則情緒 |
| `GET /api/alerts`（可加 `?as_of=`、`include_all=true`） | 某個交易日的台股警示看板 |
| `GET /api/alerts/sessions` | 可以查的交易日 |
| `GET /api/alerts/panel`、`/api/alerts/whatif` | 產業儀表板資料、警示門檻模擬 |
| `GET /api/model`、`/health` | 模型資訊 |

錯誤一律回 `{"error": {"code": ..., "message": ...}}`，代碼見 [api/errors.py](backend/newssent/api/errors.py)。

## 重現研究結果

在 `backend/` 執行：

| 指令 | 產出 |
| --- | --- |
| `python -m newssent.data.phrasebank`、`python -m newssent.data.sentfin` | 下載並切分語料，產出 [資料探索](docs/data_exploration.md) 報告 |
| `python -m newssent.ml.train --model bert --corpus combined` | 訓練（語料 `phrasebank`、`sentfin`、`combined`） |
| `python -m newssent.ml.tune --model bert`、`python -m newssent.ml.compare` | 超參數搜尋、[模型比較表](docs/model_comparison.md) |
| `python tools/compare_arms.py`、`python tools/spot_check.py sample` | 實驗 #6 的方案對照、線上抽測取樣 |
| `python tools/alert_backtest.py run` | 台股警示回測（需要分數庫） |
| `python tools/contamination_check.py`、`python tools/timestamp_lag.py` | 預訓練污染分析、時間戳落差 |

新聞標題資料庫依 FinMind 與 Yahoo 的條款不能再散布，只以加密封包放在 `state` 分支。
要重現台股警示回測，得自己用 `alert_recorder` 回補新聞並評分。

## 專案結構

```text
backend/newssent/
  config.py          唯一設定來源：標籤順序、切分 seed、預警門檻、股票池
  data/              新聞源（yfinance／NewsAPI）與快取、FinMind 中文新聞、證交所重大訊息（mops.py）、語料、分數庫
  text/              clean_text()：訓練與推論共用的前處理
  ml/                訓練、調參、評估、比較、artifact registry、統計函式（stats.py）
  inference/         情緒指數與關鍵字；台股預警（alerts、alert_board、alert_recorder、panel）；LLM 判讀（llm_review）
  api/               FastAPI 路由、回應契約、錯誤格式
  export_static.py   每日把 API 回應匯出成靜態站的 JSON
backend/tools/       研究工具：抽測、方案對照、污染檢查、時間戳落差、警示回測、評分器一致性、蒸餾實驗
backend/tests/       pytest，不連網
frontend/            Next.js 分頁式 App：app/ 六個分頁，lib/api.ts 讀即時 API 或靜態 JSON
scripts/             state 分支的加密封包、模型下載、git hooks
docs/                研究報告、預先聲明、實驗設計、部署說明
```

另外兩個分支：`state`（每日狀態，每次覆寫；新聞資料庫是加密封包）、`mops-data`（證交所重大訊息，只新增）。

## 文件

- **方法論**：[預先聲明](docs/preregistration_2026-08-14.md)、[確認實驗結果](docs/confirmation_2026-09-03.md)、
  [預訓練污染分析](docs/pretraining_contamination.md)、[時間戳語意](docs/timestamp_semantics.md)
- **台股警示**：[回測預先聲明](docs/alert_backtest_prereg.md)、[回測結果](docs/alert_backtest.md)、
  [換評分器的預先聲明](docs/scorer_switch_prereg.md)、[裁判資格考預先聲明](docs/judge_qualification_prereg.md)、
  [中文小模型蒸餾](docs/distill_pilot.md)（[預先聲明](docs/distill_pilot_prereg.md)）
- **實驗與模型**：[實驗 #6 任務定義修正](docs/experiment_target_sentiment.md)、[模型比較](docs/model_comparison.md)、
  [選型依據](docs/model_selection.md)、[實驗設計](docs/experiment_design.md)
- **線上抽測**：[人工複核](docs/online_spot_check.md)、[07-17 批](docs/online_spot_check_2026-07-17.md)
- **系統**：[架構](docs/architecture.md)、[資料探索](docs/data_exploration.md)、[SEntFiN 語料](docs/data_exploration_sentfin.md)、[部署與排程](docs/deploy.md)
- **規劃與設計**：[開發計畫](PLAN.md)、[產品](PRODUCT.md)、[視覺設計](DESIGN.md)

## 問題回報與維護者

- 問題與建議：請開 [GitHub issue](https://github.com/arktikos004/News-Sentiment-Monitor/issues)。
- 維護者：[@arktikos004](https://github.com/arktikos004)。個人專案：問題設定、資料管線、模型訓練與評估、前後端、
  線上抽測的人工標注都由開發者本人完成；開發過程與系統內使用的生成式 AI 見 [AI_USE.md](AI_USE.md)。

## 授權

- 本 repo 的程式碼與文件未採用開源授權，保留所有權利。
- 正式模型權重（Release `models-v1`）的訓練語料含 Financial PhraseBank，依其條件以 CC BY-NC-SA 3.0 提供（非商業、相同方式分享）。
- 新聞標題的著作權屬原媒體；本站只顯示標題、媒體名稱與原文連結，不儲存也不轉載內文。
- 第三方套件、資料與模型的授權見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 與 [DATA_SOURCES.md](DATA_SOURCES.md)。
