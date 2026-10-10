"use client";

/**
 * 總覽：先看台股今日警示（需要查證的少數幾檔、第一則證據標題、公司公告狀態），再看目前美股標的的新聞情緒。
 * 每個區塊在載入中都有同樣高度的骨架，資料到了不會把下方內容往下推（避免版面跳動）。
 * 錯誤處理對應 Phase 0 凍結契約（422/404/503），訊息對照在 app-state.describeError。
 */

import { ChevronDown, ChevronRight, Hash, RefreshCw, SearchX } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LEVEL } from "@/components/AlertCard";
import KeywordList from "@/components/KeywordList";
import NewsList from "@/components/NewsList";
import Panel from "@/components/Panel";
import SearchSheet from "@/components/SearchSheet";
import SentimentScale from "@/components/SentimentScale";
import Skeleton from "@/components/Skeleton";
import StatusBanner from "@/components/StatusBanner";
import { IconButton, PageTitle, TopBar } from "@/components/TopBar";
import { announcementStatus } from "@/lib/announcements";
import type { AlertsResponse, NewsItem } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { signed } from "@/lib/format";
import { latestBoard } from "@/lib/latest-board";
import { press } from "@/lib/motion";

const PREVIEW = 5;
const WEEKDAY = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
const STATUS_TEXT = { brand: "text-brand", neutral: "text-ink-3", warn: "text-warn" } as const;

function HeroSkeleton() {
  return (
    <div className="card space-y-5 p-5 sm:p-6">
      <div className="flex justify-between">
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-5 w-28" />
      </div>
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-12 w-40" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

/** 台股今日警示：最新交易日需要查證的幾檔，點一列到警示頁看完整證據（整頁載入，讓警示頁讀到網址的日期與代號） */
function TodayAlerts() {
  const [board, setBoard] = useState<AlertsResponse | null | "error">(null);

  useEffect(() => {
    latestBoard()
      .then(setBoard)
      .catch(() => setBoard("error"));
  }, []);

  const heading = <h2 className="text-title font-semibold text-ink">台股今日警示</h2>;

  if (board === "error") {
    return (
      <section className="card p-5">
        {heading}
        <p className="mt-2 text-body text-ink-2">警示資料暫時讀不到。稍後重新整理，或到「警示」分頁重試。</p>
      </section>
    );
  }
  if (board === null) {
    return (
      <section className="card space-y-3 p-5" aria-busy="true">
        {heading}
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </section>
    );
  }

  const triggered = board.alerts
    .filter((a) => a.level === "high" || a.level === "watch")
    .sort((a, b) => (a.z_score ?? 0) - (b.z_score ?? 0));
  const weekday = WEEKDAY[new Date(`${board.as_of}T00:00:00Z`).getUTCDay()];

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 px-5 pb-3 pt-5">
        <div>
          {heading}
          <p className="mt-0.5 text-meta text-ink-3">
            {board.as_of}（{weekday}），{board.universe_size} 檔中 {triggered.length} 檔需要查證
            {!board.window_closed && "；還沒開盤，標題仍在累積"}
          </p>
        </div>
        <a href={`/alerts?date=${board.as_of}`} className="flex min-h-11 items-center gap-0.5 text-body text-brand">
          看完整警示
          <ChevronRight size={16} aria-hidden="true" />
        </a>
      </div>
      {triggered.length === 0 ? (
        <p className="border-t border-hairline px-5 py-4 text-body text-ink-2">
          這個交易日沒有股票達到警示門檻
          {board.summary.insufficient > 0 && `；另有 ${board.summary.insufficient} 檔標題太少、無法判斷`}。
        </p>
      ) : (
        <ul className="divide-y divide-hairline border-t border-hairline">
          {triggered.map((a) => {
            const lv = LEVEL[a.level];
            const status = announcementStatus(a.announcements);
            const first = a.evidence[0];
            return (
              <li key={a.ticker}>
                <a
                  href={`/alerts?date=${board.as_of}&t=${encodeURIComponent(a.ticker)}`}
                  className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2"
                >
                  <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-meta font-semibold ${lv.badge}`}>
                    <lv.Icon size={12} strokeWidth={2.4} aria-hidden="true" />
                    {lv.text}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold text-ink">
                      {a.name} <span className="font-mono text-meta font-normal text-ink-3">{a.ticker.replace(/\.TW$/, "")}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-meta text-ink-2">
                      {first ? first.title : `當日 ${a.article_count} 則標題都沒有負面評分`}
                    </span>
                    <span className={`block text-meta ${STATUS_TEXT[status.tone]}`}>{status.text}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`block font-mono text-body font-semibold tabular-nums ${lv.value}`}>{signed(a.z_score)}</span>
                    <span className="block text-meta text-ink-3">z 值</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** 正面、中性、負面各幾則（取代原本的環圈圖：同一批新聞不再畫第三次） */
function Counts({ articles }: { articles: NewsItem[] }) {
  const n = (s: NewsItem["sentiment"]) => articles.filter((a) => a.sentiment === s).length;
  return (
    <p className="mt-3 px-1 text-meta text-ink-3">
      共 {articles.length} 則：<span className="text-pos">正面 {n("positive")}</span>、中性 {n("neutral")}、
      <span className="text-neg">負面 {n("negative")}</span>
    </p>
  );
}

export default function OverviewPage() {
  const { ticker, view, refresh } = useAppState();
  const { sentiment, news, error } = view;
  const ready = sentiment && news;
  const firstLoad = !ready && !error;
  const [searching, setSearching] = useState(false);

  const onRefresh = () => {
    const pending = refresh();
    if (!pending || !ticker) return;
    pending.then((ok) => (ok ? toast.success(`${ticker} 已更新`, { duration: 1800 }) : toast.error(`${ticker} 更新失敗，請看頁面上的說明`)));
  };

  return (
    <>
      <TopBar title={<PageTitle>總覽</PageTitle>} subtitle="台股今日警示與美股新聞情緒" width="wide" />

      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 pt-4 lg:px-8 lg:pt-6">
        <TodayAlerts />

        <section aria-labelledby="us-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="us-heading" className="flex items-center gap-2 text-title font-semibold text-ink">
              美股新聞情緒
              <motion.button
                type="button"
                whileTap={press}
                onClick={() => setSearching(true)}
                aria-label={ticker ? `切換美股標的，目前是 ${ticker}` : "切換美股標的"}
                className="flex min-h-10 items-center gap-1 rounded-full border border-hairline bg-surface px-3 font-mono text-body font-semibold text-ink transition-colors hover:bg-surface-2"
              >
                {ticker ?? " "}
                <ChevronDown size={16} className="text-ink-3" aria-hidden="true" />
              </motion.button>
            </h2>
            <IconButton label="重新整理" onClick={onRefresh} disabled={view.loading}>
              <RefreshCw size={19} className={view.loading ? "animate-spin" : undefined} />
            </IconButton>
          </div>
          <SearchSheet open={searching} onOpenChange={setSearching} />
          <StatusBanner
            inline
            error={error}
            stale={sentiment?.stale || news?.stale}
            mock={sentiment?.is_mock || news?.is_mock}
            onRetry={refresh}
          />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
            <div className="space-y-4 lg:space-y-6">
              {ready ? (
                <div>
                  <SentimentScale
                    score={sentiment.score}
                    label={sentiment.label}
                    articles={news.articles}
                    articleCount={sentiment.article_count}
                    asOf={sentiment.as_of}
                  />
                  <Counts articles={news.articles} />
                </div>
              ) : firstLoad ? (
                <HeroSkeleton />
              ) : (
                <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink-3">
                    <SearchX size={22} />
                  </span>
                  <p className="text-body text-ink-2">換一檔美股，或稍後按「重試」。</p>
                </div>
              )}

              {(ready || firstLoad) && (
                <Panel title="熱門關鍵字" icon={Hash}>
                  {ready ? (
                    <KeywordList keywords={sentiment.keywords} ticker={ticker ?? undefined} />
                  ) : (
                    <div className="space-y-3">
                      {Array.from({ length: 6 }, (_, i) => (
                        <Skeleton key={i} className="h-6 w-full" />
                      ))}
                    </div>
                  )}
                </Panel>
              )}
            </div>

            {(ready || firstLoad) && (
              <section aria-labelledby="latest-news" className="lg:sticky lg:top-[calc(env(safe-area-inset-top)+7.5rem)]">
                <div className="mb-3 flex min-h-11 items-center justify-between px-1">
                  <h3 id="latest-news" className="text-body font-semibold text-ink-2">
                    最新新聞
                  </h3>
                  {ready && news.articles.length > PREVIEW && (
                    <Link href="/news" className="flex min-h-11 items-center gap-0.5 text-body text-brand">
                      看全部 {news.articles.length} 則
                      <ChevronRight size={16} aria-hidden="true" />
                    </Link>
                  )}
                </div>
                {ready ? (
                  <NewsList articles={news.articles} limit={PREVIEW} />
                ) : (
                  <div className="card divide-y divide-hairline">
                    {Array.from({ length: PREVIEW }, (_, i) => (
                      <div key={i} className="space-y-2.5 px-4 py-3.5">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-1 w-full" />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
