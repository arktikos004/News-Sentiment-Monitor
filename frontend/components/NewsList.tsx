"use client";

/**
 * 新聞列表：由新到舊。每則依序是標題（連到原文）、判讀標籤與主題標籤、來源與時間，最後是「原文」「評分說明」。
 * 判讀標籤只寫偏正面／中性／偏負面，不放百分比或長條：百分比是沒有校準過的類別機率，收在「評分說明」裡並寫明它不是什麼。
 * 完整版（新聞分頁）有情緒篩選：選中的底色膠囊會滑動，切換時列表項目以 layout 動畫進出與重排。
 * 帶 ticker 時，標題沒提到這檔（代號或公司名）的新聞會加註；總覽的精簡預覽另把有提到的排前面。
 * 主題標籤：標題提到的其他追蹤標的、依固定詞表比對出的主題；比對不到就不加。標籤只比對標題文字，不影響情緒分數。
 */

import { ChevronDown, ExternalLink, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { NewsItem, SentimentLabel } from "@/lib/api";
import { hostname, LABEL_TOKEN, percent, relativeTime } from "@/lib/format";
import { METHOD_PATH, ONLINE_AGREEMENT, US_MODEL } from "@/lib/method";
import { delay, EASE_OUT, snappy, stagger } from "@/lib/motion";
import { mentionedTickers, mentionsTicker } from "@/lib/relevance";
import { tagLabel, titleTopics } from "@/lib/topics";

const PILL = { pos: "bg-pos-soft text-pos", neu: "bg-neu-soft text-neu", neg: "bg-neg-soft text-neg" } as const;
const ICON = { positive: TrendingUp, neutral: Minus, negative: TrendingDown } as const;

/** 單則標題的判讀：模型只讀標題，用「偏」字表示這是傾向，不是定論 */
export const ARTICLE_LABEL: Record<SentimentLabel, string> = { positive: "偏正面", neutral: "中性", negative: "偏負面" };

type Filter = "all" | SentimentLabel;
const FILTERS: { key: Filter; text: string }[] = [
  { key: "all", text: "全部" },
  { key: "positive", text: "偏正面" },
  { key: "neutral", text: "中性" },
  { key: "negative", text: "偏負面" },
];

function byNewest(a: NewsItem, b: NewsItem) {
  return (Date.parse(b.published_at) || 0) - (Date.parse(a.published_at) || 0);
}

/** 一則新聞的標籤：標題提到的其他追蹤標的（不含目前這檔，最多 2 個）與主題（最多 3 個） */
function tagsOf(title: string, ticker?: string) {
  const tickers = mentionedTickers(title)
    .filter((t) => t !== ticker)
    .slice(0, 2);
  const topics = titleTopics(title)
    .slice(0, 3)
    .map((t) => tagLabel(t.key));
  return { tickers, topics };
}

function ScoreNote({ a, id }: { a: NewsItem; id: string }) {
  return (
    <div id={id} className="mt-1.5 space-y-1 rounded-xl bg-surface-2 px-3 py-2.5 text-note text-ink-2">
      <p>算法：BERT 讀「公司名稱＋標題」兩段文字，輸出偏正面、中性、偏負面三類的機率，取最高的一類。只看標題，不讀內文。</p>
      <p>
        這則判為「{ARTICLE_LABEL[a.sentiment]}」的類別機率是 <span className="font-mono tabular-nums text-ink">{percent(a.confidence)}</span>
        ：這是模型的原始輸出，沒有做過機率校準。它不是分類準確率，也不是股價上漲的機率。
      </p>
      <p>
        線上盲標 {US_MODEL.online.n} 則的一致率是 {percent(ONLINE_AGREEMENT)}，大約每 5 則有 2 則和人工判讀不同。
        <Link href={METHOD_PATH} className="ml-1 text-brand underline-offset-2 hover:underline">
          方法與限制
        </Link>
      </p>
    </div>
  );
}

function NewsRow({ a, ticker }: { a: NewsItem; ticker?: string }) {
  const [open, setOpen] = useState(false);
  const noteId = useId();
  const token = LABEL_TOKEN[a.sentiment];
  const Icon = ICON[a.sentiment];
  const offTopic = ticker != null && mentionsTicker(ticker, a.title) === false;
  const tags = tagsOf(a.title, ticker);
  return (
    <div className="px-4 py-3.5">
      {a.url ? (
        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-headline text-ink transition-colors hover:text-brand">
          {a.title}
        </a>
      ) : (
        <p className="text-headline text-ink">{a.title}</p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-meta">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${PILL[token]}`}>
          <Icon size={12} strokeWidth={2.6} aria-hidden="true" />
          {ARTICLE_LABEL[a.sentiment]}
        </span>
        {(tags.tickers.length > 0 || tags.topics.length > 0) && <span className="sr-only">標籤：</span>}
        {tags.tickers.map((t) => (
          <span key={t} className="rounded-full bg-brand-soft px-2 py-0.5 font-mono text-brand">
            {t}
          </span>
        ))}
        {tags.topics.map((k) => (
          <span key={k} className="rounded-full bg-surface-2 px-2 py-0.5 text-ink-2">
            {k}
          </span>
        ))}
        {offTopic && <span className="rounded-full border border-hairline px-2 py-0.5 text-ink-2">標題沒提到 {ticker}</span>}
      </div>
      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-note text-ink-2">
        <span className="break-all">{a.source || hostname(a.url)}</span>
        <span>{relativeTime(a.published_at)}</span>
      </p>
      <div className="mt-0.5 flex flex-wrap gap-x-4 text-note">
        {a.url && (
          <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 text-brand underline-offset-2 hover:underline">
            原文
            <ExternalLink size={13} aria-hidden="true" />
            <span className="sr-only">（另開新分頁）</span>
          </a>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={noteId}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-9 items-center gap-1 text-brand underline-offset-2 hover:underline"
        >
          評分說明
          <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>
      {open && <ScoreNote a={a} id={noteId} />}
    </div>
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
  const sorted = useMemo(() => {
    const newest = [...articles].sort(byNewest);
    if (!limit || !ticker) return newest;
    // 精簡預覽：標題有提到這檔的排前面（sort 是穩定排序，各組內仍由新到舊）
    const off = (a: NewsItem) => (mentionsTicker(ticker, a.title) === false ? 1 : 0);
    return newest.sort((a, b) => off(a) - off(b));
  }, [articles, limit, ticker]);

  if (articles.length === 0) {
    return <p className="py-4 text-body text-ink-3">這檔股票近期沒有新聞，換一檔或稍後再重新整理。</p>;
  }

  const count = (f: Filter) => (f === "all" ? sorted.length : sorted.filter((a) => a.sentiment === f).length);
  const filtered = filter === "all" ? sorted : sorted.filter((a) => a.sentiment === filter);
  const shown = limit ? filtered.slice(0, limit) : filtered;

  return (
    <div>
      {withFilters && (
        <div className={`py-3 ${filterBarClassName}`}>
          <div role="group" aria-label="依情緒篩選" className="grid grid-cols-4 gap-1 rounded-full border border-hairline bg-surface p-1">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f.key)}
                  className={`relative flex min-h-10 items-center justify-center gap-1.5 rounded-full text-body transition-colors ${
                    active ? "font-semibold text-ink" : "text-ink-3 hover:text-ink-2"
                  }`}
                >
                  {active && (
                    <motion.span layoutId="news-filter" transition={snappy} className="absolute inset-0 rounded-full bg-surface-3" />
                  )}
                  <span className="relative">{f.text}</span>
                  <span className="relative font-mono text-meta tabular-nums text-ink-3">{count(f.key)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {withFilters && <p className="mb-3 px-1 text-note text-ink-2">標題下的主題標籤依固定詞表比對標題文字，比對不到就不加；標籤不影響情緒分數。</p>}

      {shown.length === 0 ? (
        <p className="py-6 text-center text-body text-ink-3">這個分類下沒有新聞，選「全部」看其他新聞。</p>
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
