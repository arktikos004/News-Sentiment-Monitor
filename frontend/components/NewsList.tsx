"use client";

/**
 * 新聞列表：由新到舊，每則附情緒標籤、信心條、來源網域與相對時間，點擊開原文。
 * 完整版（新聞分頁）有情緒篩選：選中的底色膠囊會滑動，切換時列表項目以 layout 動畫進出與重排。
 * 帶 ticker 時，標題沒提到這檔（代號或公司名）的新聞會加註；總覽的精簡預覽另把有提到的排前面。
 * 標題下方是關鍵字標籤（參考 OX 新聞頁）：標題提到的其他追蹤標的，以及依固定詞表比對出的主題；
 * 新聞分頁另有關鍵字篩選，選多個時列出符合任一個的新聞。標籤只比對標題文字，不影響情緒分數。
 */

import { ExternalLink, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import type { NewsItem, SentimentLabel } from "@/lib/api";
import { hostname, LABEL_TEXT, LABEL_TOKEN, percent, relativeTime } from "@/lib/format";
import { delay, EASE_OUT, snappy, stagger } from "@/lib/motion";
import { mentionedTickers, mentionsTicker } from "@/lib/relevance";
import { tagLabel, titleTopics } from "@/lib/topics";

const PILL = { pos: "bg-pos-soft text-pos", neu: "bg-neu-soft text-neu", neg: "bg-neg-soft text-neg" } as const;
const BAR = { pos: "bg-pos", neu: "bg-neu", neg: "bg-neg" } as const;
const ICON = { positive: TrendingUp, neutral: Minus, negative: TrendingDown } as const;

type Filter = "all" | SentimentLabel;
const FILTERS: { key: Filter; text: string }[] = [
  { key: "all", text: "全部" },
  { key: "positive", text: "正面" },
  { key: "neutral", text: "中性" },
  { key: "negative", text: "負面" },
];

function byNewest(a: NewsItem, b: NewsItem) {
  return (Date.parse(b.published_at) || 0) - (Date.parse(a.published_at) || 0);
}

/** 一則新聞的關鍵字：標題提到的其他追蹤標的（不含目前這檔），再加主題 */
function tagsOf(title: string, ticker?: string) {
  return {
    tickers: mentionedTickers(title).filter((t) => t !== ticker),
    topics: titleTopics(title).map((t) => t.key),
  };
}

/** 代號鍵是全大寫，主題鍵是小寫英文 */
const isTicker = (key: string) => /^[A-Z]+$/.test(key);

function NewsRow({ a, ticker }: { a: NewsItem; ticker?: string }) {
  const token = LABEL_TOKEN[a.sentiment];
  const Icon = ICON[a.sentiment];
  const host = hostname(a.url);
  const offTopic = ticker != null && mentionsTicker(ticker, a.title) === false;
  const tags = tagsOf(a.title, ticker);
  const body = (
    <>
      <div className="flex items-center gap-2 text-meta">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${PILL[token]}`}>
          <Icon size={12} strokeWidth={2.6} />
          {LABEL_TEXT[a.sentiment]}
          <span className="font-mono tabular-nums">{percent(a.confidence)}</span>
        </span>
        <span className="min-w-0 flex-1 truncate text-ink-3">{a.source || host}</span>
        {offTopic && <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-ink-3">標題沒提到 {ticker}</span>}
        <span className="shrink-0 text-ink-3">{relativeTime(a.published_at)}</span>
      </div>
      <p className="mt-2 text-body text-ink transition-colors group-hover:text-brand">{a.title}</p>
      {(tags.tickers.length > 0 || tags.topics.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-meta">
          <span className="sr-only">關鍵字：</span>
          {tags.tickers.slice(0, 2).map((t) => (
            <span key={t} className="rounded-full bg-brand-soft px-2 py-0.5 font-mono text-brand">
              {t}
            </span>
          ))}
          {tags.topics.slice(0, 3).map((k) => (
            <span key={k} className="rounded-full bg-surface-2 px-2 py-0.5 text-ink-2">
              {tagLabel(k)}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-2">
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
          <span className={`block h-full rounded-full ${BAR[token]}`} style={{ width: percent(a.confidence) }} />
        </span>
        {a.url && <ExternalLink size={13} className="text-ink-3" aria-label="另開新分頁" />}
      </div>
    </>
  );
  return a.url ? (
    <a href={a.url} target="_blank" rel="noopener noreferrer" className="group block px-4 py-3.5 transition-colors active:bg-surface-2">
      {body}
    </a>
  ) : (
    <div className="px-4 py-3.5">{body}</div>
  );
}

export default function NewsList({
  articles,
  limit,
  ticker,
  withFilters = false,
  filterBarClassName = "",
}: {
  articles: NewsItem[];
  limit?: number;
  ticker?: string;
  withFilters?: boolean;
  filterBarClassName?: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [words, setWords] = useState<string[]>([]);
  const sorted = useMemo(() => {
    const newest = [...articles].sort(byNewest);
    if (!limit || !ticker) return newest;
    // 精簡預覽：標題有提到這檔的排前面（sort 是穩定排序，各組內仍由新到舊）
    const off = (a: NewsItem) => (mentionsTicker(ticker, a.title) === false ? 1 : 0);
    return newest.sort((a, b) => off(a) - off(b));
  }, [articles, limit, ticker]);
  const tagged = useMemo(
    () =>
      sorted.map((a) => {
        const t = tagsOf(a.title, ticker);
        return { a, keys: [...t.tickers, ...t.topics] };
      }),
    [sorted, ticker],
  );
  // 關鍵字選項：這批新聞裡出現過的標籤與則數，多的排前面
  const options = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { keys } of tagged) for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
    return [...counts].sort((x, y) => y[1] - x[1] || tagLabel(x[0]).localeCompare(tagLabel(y[0]), "zh-Hant"));
  }, [tagged]);

  if (articles.length === 0) {
    return <p className="py-4 text-body text-ink-3">這檔股票近期沒有新聞，換一檔或稍後再重新整理。</p>;
  }

  // 換了一檔股票後，不在這批新聞裡的關鍵字自動不算
  const active = words.filter((w) => options.some(([k]) => k === w));
  const toggle = (k: string) => setWords(active.includes(k) ? active.filter((w) => w !== k) : [...active, k]);
  const count = (f: Filter) => (f === "all" ? sorted.length : sorted.filter((a) => a.sentiment === f).length);
  const filtered = tagged
    .filter(({ a }) => filter === "all" || a.sentiment === filter)
    .filter(({ keys }) => active.length === 0 || keys.some((k) => active.includes(k)))
    .map(({ a }) => a);
  const shown = limit ? filtered.slice(0, limit) : filtered;

  return (
    <div>
      {withFilters && (
        <div className={`py-3 ${filterBarClassName}`}>
          <div role="group" aria-label="依情緒篩選" className="grid grid-cols-4 gap-1 rounded-full border border-hairline bg-surface p-1">
            {FILTERS.map((f) => {
              const on = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(f.key)}
                  className={`relative flex min-h-10 items-center justify-center gap-1.5 rounded-full text-body transition-colors ${
                    on ? "font-semibold text-ink" : "text-ink-3 hover:text-ink-2"
                  }`}
                >
                  {on && <motion.span layoutId="news-filter" transition={snappy} className="absolute inset-0 rounded-full bg-surface-3" />}
                  <span className="relative">{f.text}</span>
                  <span className="relative font-mono text-meta tabular-nums text-ink-3">{count(f.key)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {withFilters && options.length > 0 && (
        <div className="mb-3">
          <div role="group" aria-label="依關鍵字篩選" className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-meta text-ink-3">關鍵字</span>
            {options.map(([k, n]) => {
              const on = active.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(k)}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-meta transition-colors ${
                    on ? "border-brand bg-brand-soft font-semibold text-brand" : "border-hairline bg-surface text-ink-2 hover:text-ink"
                  }`}
                >
                  <span className={isTicker(k) ? "font-mono" : undefined}>{tagLabel(k)}</span>
                  <span className="font-mono tabular-nums text-ink-3">{n}</span>
                </button>
              );
            })}
            {active.length > 0 && (
              <button type="button" onClick={() => setWords([])} className="min-h-9 px-2 text-meta text-brand hover:underline">
                清除關鍵字
              </button>
            )}
          </div>
          <p className="mt-1.5 text-meta text-ink-3">標籤依固定詞表比對標題文字，選多個時列出符合任一個的新聞；不影響情緒分數。</p>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="py-6 text-center text-body text-ink-3">
          {active.length > 0 ? "沒有符合這些條件的新聞。取消一個關鍵字，或把情緒切回「全部」。" : "這個分類下沒有新聞，選「全部」看其他新聞。"}
        </p>
      ) : withFilters ? (
        // 有篩選才需要 layout 動畫（項目進出與重排）；它得量測版面，成本較高，所以只用在這裡
        <ul className="card divide-y divide-hairline overflow-hidden">
          <AnimatePresence mode="popLayout">
            {shown.map((a, i) => (
              <motion.li
                key={`${a.url}-${a.title}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: stagger(i) }}
                exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE_OUT } }}
              >
                <NewsRow a={a} ticker={ticker} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <ul className="card divide-y divide-hairline overflow-hidden">
          {shown.map((a, i) => (
            <li key={`${a.url}-${a.title}`} className="animate-rise" style={delay(i, 80)}>
              <NewsRow a={a} ticker={ticker} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
