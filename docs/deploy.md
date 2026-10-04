# 部署：news.sekinv.com（靜態站＋每日排程）

2026-09 起公開站改為**全靜態**：沒有常駐後端，GitHub Actions 每天跑一次運算，把 API 的回應匯出成
JSON，Next.js 靜態輸出後部署到 Cloudflare Pages。本機開發（`start_all.bat`、uvicorn＋`next dev`）不受影響。

```
GitHub Actions（daily.yml，每天台北 07:30、13:30、19:30、01:30）
  還原狀態（state 分支：加密封包 private.tar.gz.enc〔alert_scores.db、news_cache.db〕、上一版網站資料）
  → alert_recorder：FinMind 台股中文新聞 → Gemini API 評分（gemma-4-26b-a4b-it，每次限 45 分鐘；exit 3＝額度或時間用盡，照常部署）
  → export_static：TestClient 呼叫現有 API → frontend/public/data/*.json（含發布關卡）
  → next build（NEXT_PUBLIC_STATIC_DATA=1）→ wrangler pages deploy → 保存狀態
```

## 重點設計

| 問題 | 做法 |
|---|---|
| 靜態站沒有後端 | `newssent/export_static.py` 用 TestClient 逐一呼叫現有端點、原樣寫檔；數字與本機 API 同源 |
| 美股代號原本可任意輸入 | 只提供 `config.STATIC_TICKERS`（24 檔）；前端搜尋改為清單篩選，舊版存下的清單外代號退回 AAPL |
| 本機 gemma3:27b 雲端跑不動 | `GeminiReviewer`（`inference/llm_review.py`），同一份提示詞；版本字串 `llm-gemini:<模型>` 與本機分數分開 |
| 新評分器沒有 20 日基準 | `backfill.yml` 手動回補分數；看板全是「資料不足」的交易日不匯出 |
| 把假資料發布出去 | 匯出關卡：模型 mock、覆蓋率 < 70%、預警日期倒退 → exit 1，不部署，線上維持上一版 |
| 資料庫要跨次保存 | 孤立分支 `state`，每次覆寫成單一 commit（SQLite 整檔改寫，留歷史會無限長大）；另存 30 天 artifact |
| 新聞資料不得再散布 | 兩個資料庫只以 AES-256-GCM 加密封包 `private.tar.gz.enc` 存在公開的 state 分支（`scripts/state_crypt.py`，金鑰在 Secret `STATE_KEY`）；`commit_state.sh` 遇到明文 `.db` 直接失敗；backfill 的 artifact 只留彙總報告 |
| 模型 439 MB 不能進 git | GitHub Release `models-v1` ＋ `backend/models.lock`（sha256）＋ actions/cache |
| pickle 模型對版本敏感 | `backend/requirements-ci.txt` 鎖定與 Windows 開發機相同的版本 |
| 股價站要讀情緒 | `frontend/public/_headers` 對 `/data/*` 開放跨站讀取 |

## Workflows

| 檔案 | 觸發 | 做什麼 |
|---|---|---|
| `daily.yml` | 每天 4 次（UTC 23:30、05:30、11:30、17:30）、手動 | 上述完整流程；手動可指定 Pages 分支（非 master＝preview 網址） |
| `deploy.yml` | master 上 `frontend/**` 變動、手動 | 用 state 分支上的上一版資料重新 build 部署，不跑 Python |
| `backfill.yml` | 手動 | 回補較早期間的分數＋一致性報告（`tools/scorer_agreement.py`，artifact 保留 90 天）；近 45 天由 daily 自動消化 |
| `gemini-probe.yml` | 手動 | 實測 Gemini 候選模型可否作答與延遲（`tools/gemini_probe.py`） |
| `leakage.yml` | master push、PR | 洩漏回歸測試 |

三個會寫狀態或部署的 workflow 共用 `concurrency: site`，不會互相覆蓋。

## Secrets（GitHub repo → Settings → Secrets and variables → Actions）

| 名稱 | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 權限：Account → Cloudflare Pages → Edit |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 帳號 ID |
| `GEMINI_API_KEY` | Google AI Studio 金鑰 |
| `FINMIND_TOKEN` | FinMind 註冊 token（每小時額度 300 → 600；沒有也能跑，較慢） |
| `STATE_KEY` | state 分支私有資料封包的金鑰（`python scripts/state_crypt.py keygen` 產生；遺失就解不開封包，另存一份在密碼管理器） |

## 常用操作

```bash
# 把雲端最新的資料庫拿回本機分析（需要 STATE_KEY）
git fetch github state && git show github/state:private.tar.gz.enc > /tmp/private.tar.gz.enc
STATE_KEY=... python scripts/state_crypt.py unpack --bundle /tmp/private.tar.gz.enc --dest backend

# 本機產生靜態站預覽
cd backend && python -m newssent.export_static --out ../frontend/public/data
cd ../frontend && NEXT_PUBLIC_STATIC_DATA=1 NEXT_PUBLIC_TICKERS=$(jq -r '.tickers|join(",")' public/data/tickers.json) npm run build
npx wrangler pages dev out

# 換模型：上傳新的 Release（新 tag）→ 更新 backend/models.lock 的 tag 與 sha256
```

## 回復

- 某次執行把資料庫弄壞：到該次之前的 run 下載 `state-<run_id>` artifact，解開後覆寫 state 分支。
- 網站內容有誤：Cloudflare Pages 專案 → Deployments → 對上一版按 Rollback。
