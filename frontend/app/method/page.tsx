"use client";

/**
 * 方法與限制：網站上的定義、算法與但書都集中在這一頁，各頁只留短標籤與連到這裡的「說明」（HelpLink 的錨點）。
 * 兩個模型各一張說明卡（用途、現行版本、測試資料的期間與樣本數、報告連結；沒驗證過的地方直接寫），
 * 後面幾段解釋畫面上的數字：情緒指數、直接相關與關聯待確認、評分說明、主題標籤、台股查證清單。
 */

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import type { MethodSection } from "@/components/HelpLink";
import { PageTitle, TopBar } from "@/components/TopBar";
import type { AlertsResponse } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { signed } from "@/lib/format";
import { latestBoard } from "@/lib/latest-board";
import { backtested, DOC_URL, scorerLabel, TW_BACKTEST, US_MODEL } from "@/lib/method";


function Doc({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand underline-offset-2 hover:underline">
      {children}
      <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}

/** 「網站上的數字怎麼讀」的一段 */
function Topic({ id, title, children }: { id: MethodSection; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-32 border-t border-hairline pt-5">
      <h3 id={`${id}-title`} className="text-body font-semibold text-ink">
        {title}
      </h3>
      <div className="mt-2 space-y-2 text-body text-ink-2">{children}</div>
    </section>
  );
}

function ModelCard({ id, title, rows }: { id: MethodSection; title: string; rows: [string, React.ReactNode][] }) {
  return (
    <section id={id} className="card scroll-mt-32 overflow-hidden">
      <h2 className="border-b border-hairline px-5 py-4 text-title font-semibold text-ink">{title}</h2>
      <dl className="divide-y divide-hairline">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-4">
            <dt className="text-note font-semibold text-ink-2">{label}</dt>
            <dd className="text-body text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function MethodPage() {
  const { modelInfo, ensureModelInfo } = useAppState();
  const [board, setBoard] = useState<AlertsResponse | null>(null);

  useEffect(() => ensureModelInfo(), [ensureModelInfo]);
  useEffect(() => {
    latestBoard()
      .then(setBoard)
      .catch(() => setBoard(null));
  }, []);

  const version = modelInfo && modelInfo !== "error" && !modelInfo.is_mock ? modelInfo.model_version : US_MODEL.name;
  const scorer = board?.scorer;
  const p = board?.params;

  return (
    <>
      <TopBar title={<PageTitle>方法與限制</PageTitle>} subtitle="兩個模型做什麼、驗證到哪裡、還有什麼沒驗證" />
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-4 lg:px-8 lg:pt-6">
        <p className="text-body text-ink-2">
          本站是每天更新 4 次的研究原型。美股與台股用的是兩個不同的模型，驗證程度也不同；下面兩張卡片分別列出。兩者都只讀新聞標題，不讀內文，也都不是股價預測。
        </p>

        <ModelCard
          id="us-model"
          title="美股標題分類"
          rows={[
            ["用途", "判斷每則美股新聞標題對所選公司偏正面、中性或偏負面，彙整成總覽與新聞頁的情緒指數。"],
            [
              "現行版本",
              <>
                <span className="font-mono">{version}</span>：微調過的 BERT，讀「公司名稱＋標題」兩段文字後輸出三類的機率，取最高的一類。
              </>,
            ],
            [
              "情緒指數",
              "只計入標題直接提到公司（名稱、別名或代號）的新聞，每則同權重：（偏正面則數 − 偏負面則數）÷ 計入則數。計入不到 3 則，或判為某個方向的那一方不到 2 則，就標「資料不足」、不給方向。新聞源關聯到這一檔、但標題沒提到公司的新聞列為「關聯待確認」，附上收錄理由，不計入。",
            ],
            [
              "同來源測試集",
              <>
                Financial PhraseBank 與 SEntFiN 1.0 合併後，依固定亂數種子切出的測試集 {US_MODEL.testN.toLocaleString()} 則：Macro F1 {US_MODEL.testMacroF1}
                。這些句子和訓練資料來自同一批語料，不是本站抓到的新聞，所以這個分數會高估線上的表現。
              </>,
            ],
            [
              "沒有驗證的部分",
              "每則標題旁的百分比是模型輸出的類別機率，沒有做過機率校準：它不是分類準確率，也不是股價上漲的機率。情緒指數和之後股價的關係也沒有驗證。",
            ],
            [
              "報告",
              <span key="docs" className="flex flex-wrap gap-x-4 gap-y-1">
                <Doc href={DOC_URL.indexRevision}>情緒指數的修訂與前後比較</Doc>
              </span>,
            ],
          ]}
        />

        <ModelCard
          id="tw-model"
          title="台股開盤前查證清單"
          rows={[
            [
              "用途",
              "49 檔台股，每個交易日開盤前，標出新聞情緒比自己前 20 個交易日明顯偏負面的股票，附負面標題與公司重大訊息，用來決定先查證哪幾檔。不是預測，也不是提前預警。",
            ],
            [
              "現行版本",
              <>
                {scorer ? scorerLabel(scorer) : "雲端託管的語言模型"}逐則判讀標題對該公司的方向（只看標題）。
                {p
                  ? `當日分數相對前 ${p.baseline_sessions} 個交易日的 z 值低於 ${signed(p.watch_z, 1)} 列為留意、低於 ${signed(p.high_z, 1)} 列為高度異常；當日至少 ${p.min_articles} 則標題才判斷。`
                  : null}
              </>,
            ],
            [
              "歷史回測",
              <>
                評分器是本機的 Gemma 3 27B。{TW_BACKTEST.from} 至 {TW_BACKTEST.to} 依價格規則選出 {TW_BACKTEST.events} 個大跌事件；事前有資料的 {TW_BACKTEST.judged}{" "}
                個事件中，事前 5 個交易日內至少示警一次的有 {TW_BACKTEST.early} 個，和隨機響鈴無法區分（單尾二項檢定 p = {TW_BACKTEST.p}）；事件日開盤前示警{" "}
                {TW_BACKTEST.sameDay}/{TW_BACKTEST.sameDayJudged}。回測用的新聞是事後回補的資料。
              </>,
            ],
            [
              "沒有驗證的部分",
              scorer && backtested(scorer)
                ? "台股中文標題沒有可對照的正確答案，無法估計逐則判讀的準確度。"
                : "現行的評分器尚未重新回測，它和回測用的 Gemma 3 判讀一致性也還沒計算，所以上面的回測結論是否適用於現行版本，目前無法確認。台股中文標題也沒有可對照的正確答案，無法估計逐則判讀的準確度。",
            ],
            [
              "報告",
              <span key="docs" className="flex flex-wrap gap-x-4 gap-y-1">
                <Doc href={DOC_URL.alertBacktest}>歷史回測</Doc>
                <Doc href={DOC_URL.scorerSwitch}>更換評分器的規則</Doc>
              </span>,
            ],
          ]}
        />

        <section aria-labelledby="reading-title" className="card space-y-5 p-5">
          <h2 id="reading-title" className="text-title font-semibold text-ink">
            網站上的數字怎麼讀
          </h2>
          <Topic id="index" title="美股情緒指數">
            <p>
              只計入標題直接提到公司的新聞，每則同權重：（偏正面則數 − 偏負面則數）÷ 計入則數，介於 −1 與 +1 之間；超過 ±0.15 才判偏正面或偏負面。
            </p>
            <p>
              計入的新聞不到 3 則，或判為某個方向的那一方不到 2 則，就標「資料不足」、不給方向。類別機率沒有校準，所以不拿來當權重。
              <Doc href={DOC_URL.indexRevision}>修訂與前後比較</Doc>
            </p>
          </Topic>
          <Topic id="relevance" title="直接相關與關聯待確認">
            <p>
              <strong className="font-semibold text-ink">直接相關</strong>：標題提到公司的名稱、別名或代號（整詞比對，Intelligence 不算 Intel）。ETF（QQQ、SPY）是市場綜合，全部計入。
            </p>
            <p>
              <strong className="font-semibold text-ink">關聯待確認</strong>：新聞源（Yahoo 財經）把它關聯到這一檔，但標題沒提到公司，可能是大盤綜述、同業的報導或只是順帶提到。
              每則附上新聞源的關聯代號當理由，不計入指數。只比對字面，不判斷公司是不是標題的主角。
            </p>
          </Topic>
          <Topic id="score" title="偏正面／中性／偏負面與評分說明">
            <p>
              每則標題由模型讀「公司名稱＋標題」判讀，只看標題、不讀內文。「評分說明」裡的百分比是模型輸出的類別機率，<strong className="font-semibold text-ink">沒有校準</strong>：
              它不是分類準確率，也不是股價上漲的機率。
            </p>
          </Topic>
          <Topic id="tags" title="主題標籤">
            <p>
              依固定詞表比對標題文字（先比對片語，例如 treasury shares 是庫藏股、Treasury yields 是債券與利率），比對不到就不加標籤。標籤不是模型判斷，也不影響分數。
            </p>
          </Topic>
          <Topic id="tw-checklist" title="台股查證清單的門檻與時間">
            <p>
              {p
                ? `當日分數相對前 ${p.baseline_sessions} 個交易日的 z 值低於 ${signed(p.watch_z, 1)} 為留意、低於 ${signed(p.high_z, 1)} 為高度異常；當日少於 ${p.min_articles} 則標題列為資料不足，不併入正常。`
                : "當日分數相對前 20 個交易日的 z 值低於 −1.5 為留意、低於 −2.0 為高度異常；當日標題太少列為資料不足，不併入正常。"}
            </p>
            <p>
              每個交易日的新聞窗口在 09:00 開盤時截止：還沒開盤時看的是「下一交易日」的清單，標題仍在累積。公司重大訊息是證交所隔天清晨才出的開放資料，所以通常比新聞晚一天；漏收的日子不能當成沒有公告。
            </p>
          </Topic>
        </section>

        <p className="text-note text-ink-2">情緒指數與警示都是模型的統計輸出，只供研究參考，不構成投資建議。</p>
      </main>
    </>
  );
}
