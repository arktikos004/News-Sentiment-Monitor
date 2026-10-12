"use client";

/**
 * 總覽的美股情緒卡：先列計入指數的新聞裡偏負面、中性、偏正面各幾則，再給指數與算式。
 * 指數是 (偏正面 − 偏負面) ÷ 計入則數，只計入標題直接提到公司的新聞；則數太少或同向的則數不夠時，直接寫出為什麼不給判斷。
 * 配色依美股慣例（正綠負紅），每個數字都有文字標籤。
 * 舊版靜態檔沒有計入則數的欄位時，則數取自全部收錄的新聞，並註明指數是舊算法。
 */

import { CircleHelp, Minus, TrendingDown, TrendingUp } from "lucide-react";
import CaveatNote from "@/components/CaveatNote";
import HelpLink from "@/components/HelpLink";
import type { NewsResponse, SentimentLabel, SentimentResponse } from "@/lib/api";
import { relativeTime, signed } from "@/lib/format";
import { displayName, inIndex, isEtf } from "@/lib/news-relevance";

const TONE = {
  positive: { text: "偏正面", color: "text-pos", bar: "bg-pos", pill: "bg-pos-soft text-pos", Icon: TrendingUp },
  neutral: { text: "中性", color: "text-neu", bar: "bg-neu", pill: "bg-neu-soft text-neu", Icon: Minus },
  negative: { text: "偏負面", color: "text-neg", bar: "bg-neg", pill: "bg-neg-soft text-neg", Icon: TrendingDown },
} as const;
const ORDER: SentimentLabel[] = ["negative", "neutral", "positive"];

/** 不給方向判斷的原因：則數不夠，或判為某個方向的那一方不到門檻 */
function insufficientReason(s: SentimentResponse, counts: Record<SentimentLabel, number>, n: number, name: string): string {
  const min = s.index_method?.min_articles ?? 3;
  const polar = s.index_method?.min_polar ?? 2;
  if (n < min) return `標題直接提到 ${name} 的新聞只有 ${n} 則，不到 ${min} 則，不給整體判斷。`;
  const side: SentimentLabel = s.score >= 0 ? "positive" : "negative";
  return `判為${TONE[side].text}的新聞只有 ${counts[side]} 則，不到 ${polar} 則，不給方向判斷。`;
}

export default function IndexSummary({ sentiment, news }: { sentiment: SentimentResponse; news: NewsResponse }) {
  const ticker = sentiment.ticker;
  const name = displayName(ticker, news.target_aliases);
  const revised = sentiment.index_counts != null && sentiment.index_count != null;
  const count = (label: SentimentLabel, list = news.articles) => list.filter((a) => a.sentiment === label).length;
  const counts: Record<SentimentLabel, number> = revised
    ? (sentiment.index_counts as Record<SentimentLabel, number>)
    : { positive: count("positive"), neutral: count("neutral"), negative: count("negative") };
  const n = revised ? (sentiment.index_count as number) : news.articles.length;
  const pending = revised ? news.articles.filter((a) => !inIndex(a)).length : 0;
  const insufficient = revised && sentiment.insufficient === true;
  const verdict = insufficient ? null : TONE[sentiment.label];
  const Icon = verdict ? verdict.Icon : CircleHelp;

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="index-summary">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="index-summary" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-meta font-semibold ${verdict ? verdict.pill : "bg-surface-2 text-ink-2"}`}>
          <Icon size={14} strokeWidth={2.4} aria-hidden="true" />
          {verdict ? `整體${verdict.text}` : "資料不足，不給整體判斷"}
        </h3>
        <span className="text-note text-ink-2">{relativeTime(sentiment.as_of)}更新</span>
      </div>

      <dl className="mt-5 grid grid-cols-3 divide-x divide-hairline">
        {ORDER.map((label) => (
          <div key={label} className="px-3 first:pl-0 last:pr-0">
            <dt className="text-note text-ink-2">{TONE[label].text}</dt>
            <dd className={`mt-0.5 font-mono text-[2rem] font-semibold leading-none tabular-nums ${counts[label] > 0 ? TONE[label].color : "text-ink-3"}`}>
              {counts[label]}
              <span className="ml-1 font-sans text-note font-normal text-ink-2">則</span>
            </dd>
          </div>
        ))}
      </dl>

      {n > 0 && (
        <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
          {ORDER.map((label) => counts[label] > 0 && <span key={label} className={`h-full ${TONE[label].bar}`} style={{ flexGrow: counts[label] }} />)}
        </div>
      )}

      <p className="mt-4 text-body text-ink">
        {revised
          ? isEtf(ticker)
            ? `共 ${n} 則：${ticker} 是市場綜合的 ETF，收錄的新聞全部計入。`
            : `共 ${n} 則標題直接提到 ${name}${pending > 0 ? `；另有 ${pending} 則關聯待確認，不計入` : ""}。`
          : `共 ${n} 則（新聞源收錄的全部新聞）。`}
      </p>
      <p className="mt-1 text-body text-ink-2">
        情緒指數 <span className="font-mono font-semibold tabular-nums text-ink">{signed(sentiment.score)}</span>
        {revised && n > 0 ? (
          <>
            ＝（偏正面 {counts.positive} − 偏負面 {counts.negative}）÷ {n}
          </>
        ) : (
          !revised && "（舊算法：以類別機率加權，下一次更新後改成每則同權重）"
        )}
        <HelpLink to="index" className="ml-2" />
      </p>

      {insufficient && (
        <CaveatNote tone="neutral" className="mt-4">
          <p>{insufficientReason(sentiment, counts, n, name)}</p>
        </CaveatNote>
      )}

      <p className="mt-4 border-t border-hairline pt-3 text-note text-ink-2">
        模型只讀標題，線上盲標一致率約六成。
        <HelpLink to="score" className="ml-1" />
      </p>
    </section>
  );
}
