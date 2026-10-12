"use client";

/**
 * 方法與限制：兩個模型各一張說明卡，列出用途、現行版本、測試資料的期間與樣本數、報告連結；
 * 現行版本沒有驗證過的地方直接寫出來。不放進分頁列，總覽、新聞、警示、設定各處用連結導過來。
 */

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { PageTitle, TopBar } from "@/components/TopBar";
import type { AlertsResponse } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { signed } from "@/lib/format";
import { latestBoard } from "@/lib/latest-board";
import { backtested, DOC_URL, ONLINE_AGREEMENT, scorerLabel, TW_BACKTEST, US_MODEL } from "@/lib/method";

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Doc({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand underline-offset-2 hover:underline">
      {children}
      <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}

function ModelCard({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <section className="card overflow-hidden">
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
  const o = US_MODEL.online;

  return (
    <>
      <TopBar title={<PageTitle>方法與限制</PageTitle>} subtitle="兩個模型做什麼、驗證到哪裡、還有什麼沒驗證" />
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-4 lg:px-8 lg:pt-6">
        <p className="text-body text-ink-2">
          本站是每天更新 4 次的研究原型。美股與台股用的是兩個不同的模型，驗證程度也不同；下面兩張卡片分別列出。兩者都只讀新聞標題，不讀內文，也都不是股價預測。
        </p>

        <ModelCard
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
              "同來源測試集",
              <>
                Financial PhraseBank 與 SEntFiN 1.0 合併後，依固定亂數種子切出的測試集 {US_MODEL.testN.toLocaleString()} 則：Macro F1 {US_MODEL.testMacroF1}
                。這些句子和訓練資料來自同一批語料，不是本站抓到的新聞，所以這個分數會高估線上的表現。
              </>,
            ],
            [
              "線上盲標",
              <>
                {o.from} 至 {o.to.slice(5)} 本站收錄的 {o.n} 則美股標題，人工盲標（標注者為開發者本人，標注時看不到模型輸出）：一致率 {pct(ONLINE_AGREEMENT)}（
                {o.agreed}/{o.n}）；人工判為負面的標題，模型也判負面的有 {pct(o.negativeRecall)}。和前一版模型比較，McNemar 檢定 p = {o.pVsPrevious}，兩者無法區分。
              </>,
            ],
            [
              "沒有驗證的部分",
              "每則標題旁的百分比是模型輸出的類別機率，沒有做過機率校準：它不是分類準確率，也不是股價上漲的機率。情緒指數和之後股價的關係也沒有驗證。",
            ],
            [
              "報告",
              <span key="docs" className="flex flex-wrap gap-x-4 gap-y-1">
                <Doc href={DOC_URL.confirmation}>線上確認實驗</Doc>
                <Doc href={DOC_URL.targetSentiment}>任務定義的比較實驗</Doc>
              </span>,
            ],
          ]}
        />

        <ModelCard
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
                ? "台股中文標題沒有人工標注，無法估計逐則判讀的準確度。"
                : "現行的評分器尚未重新回測，它和回測用的 Gemma 3 判讀一致性也還沒計算，所以上面的回測結論是否適用於現行版本，目前無法確認。台股中文標題也沒有人工標注，無法估計逐則判讀的準確度。",
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

        <p className="text-note text-ink-2">情緒指數與警示都是模型的統計輸出，只供研究參考，不構成投資建議。</p>
      </main>
    </>
  );
}
