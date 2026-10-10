"use client";

/**
 * 台股警示：某個交易日全池 49 檔的新聞情緒異常（預設只列 high / watch）。
 *
 * - 交易日來自 /api/alerts/sessions；選到非交易日自動對到前一個交易日，不送出會收到 422 的日期
 * - 看過的日期存在模組層快取，切走分頁再回來不必重抓（後端限流所有端點共用）
 * - 大螢幕兩欄：左邊是可排序的清單，右邊是選中那檔的證據與公告；手機是一張張的卡片
 * - 依回測的預先聲明：固定揭露「事前示警率與隨機響鈴無法區分」，也不提供任何「精選命中日」捷徑
 */

import { CalendarDays, ChevronLeft, ChevronRight, Clock, ExternalLink, Info, RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import AlertCard, { LEVEL } from "@/components/AlertCard";
import Skeleton from "@/components/Skeleton";
import StatusBanner from "@/components/StatusBanner";
import { IconButton, PageTitle, TopBar } from "@/components/TopBar";
import { announcementStatus } from "@/lib/announcements";
import { api, ApiError, STATIC_DATA, type AlertLevel, type AlertsResponse, type StockAlert } from "@/lib/api";
import { signed } from "@/lib/format";
import { press, snappy } from "@/lib/motion";

const WEEKDAY = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
const BACKTEST_URL = "https://github.com/arktikos004/News-Sentiment-Monitor/blob/master/docs/alert_backtest.md";

type Key = `${string}|${"triggered" | "all"}`;
const keyOf = (asOf: string, includeAll: boolean): Key => `${asOf}|${includeAll ? "all" : "triggered"}`;
type SortKey = "z" | "count" | "announce";

// 模組層快取：分頁元件卸載後仍保留（同一次開啟內有效）
const cache: {
  sessions: string[] | null;
  latest: string | null;
  asOf: string | null;
  includeAll: boolean;
  selected: string | null;
  results: Partial<Record<Key, AlertsResponse>>;
} = { sessions: null, latest: null, asOf: null, includeAll: false, selected: null, results: {} };

// 歷史回測（docs/alert_backtest.md）所用的評分器；線上改用其他評分器時要揭露回測結論未必適用
const LEGACY_SCORER = "llm-gemma3:27b";

/** 寫入模組層快取（在元件外定義：React Compiler 不允許元件內直接改外部變數） */
function remember(patch: Partial<typeof cache>) {
  Object.assign(cache, patch);
}

function describe(e: unknown): string {
  if (e instanceof ApiError && e.code === "ALERT_DATA_UNAVAILABLE") {
    return STATIC_DATA ? e.message : "警示分數庫是空的：先執行 alert_recorder 抓新聞並評分。";
  }
  if (e instanceof ApiError && e.status === 429) return "查詢太頻繁，請等一分鐘再試";
  return e instanceof Error ? e.message : "發生未知錯誤，請重新整理";
}

/** 最後一個 ≤ day 的交易日；day 早於第一個交易日時回第一個 */
function snapToSession(sessions: string[], day: string): string {
  let pick = sessions[0];
  for (const s of sessions) {
    if (s <= day) pick = s;
    else break;
  }
  return pick;
}

/** 從產業儀表板或總覽點進來時網址帶 ?date=YYYY-MM-DD&t=代號（整頁載入）：日期對齊到 ≤ 它的交易日 */
function requested(sessions: string[]): { asOf: string | null; ticker: string | null } {
  const q = new URLSearchParams(window.location.search);
  const day = q.get("date");
  return {
    asOf: day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? snapToSession(sessions, day) : null,
    ticker: q.get("t"),
  };
}

const SUMMARY: { level: AlertLevel; label: string }[] = [
  { level: "high", label: "高度異常" },
  { level: "watch", label: "留意" },
  { level: "normal", label: "正常" },
  { level: "insufficient", label: "資料不足" },
];

const STATUS_TEXT = {
  brand: "text-brand",
  neutral: "text-ink-3",
  warn: "text-warn",
} as const;

function sortAlerts(list: StockAlert[], key: SortKey): StockAlert[] {
  const z = (a: StockAlert) => a.z_score ?? Number.POSITIVE_INFINITY;
  return [...list].sort((a, b) => {
    if (key === "count") return b.article_count - a.article_count || z(a) - z(b);
    if (key === "announce") return (b.announcements?.count ?? -1) - (a.announcements?.count ?? -1) || z(a) - z(b);
    return z(a) - z(b);
  });
}

/** 大螢幕左欄：密集清單，一列一檔；點一列在右欄看證據與公告 */
function AlertList({
  alerts,
  selected,
  onSelect,
}: {
  alerts: StockAlert[];
  selected: string | null;
  onSelect: (t: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>("z");
  const rows = sortAlerts(alerts, sort);
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
        <span className="text-meta text-ink-3">{alerts.length} 檔</span>
        <div role="group" aria-label="清單排序" className="flex gap-1 text-meta">
          {(
            [
              ["z", "依 z 值"],
              ["count", "依標題數"],
              ["announce", "依公告"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={sort === k}
              onClick={() => setSort(k)}
              className={`min-h-9 rounded-full px-3 transition-colors ${sort === k ? "bg-surface-3 font-semibold text-ink" : "text-ink-3 hover:text-ink-2"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-hairline">
        {rows.map((a) => {
          const lv = LEVEL[a.level];
          const active = a.ticker === selected;
          const status = announcementStatus(a.announcements);
          return (
            <li key={a.ticker}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(a.ticker)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 ${active ? "bg-surface-2" : ""}`}
              >
                <span className={`inline-flex w-[5.5rem] shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-meta font-semibold ${lv.badge}`}>
                  <lv.Icon size={12} strokeWidth={2.4} aria-hidden="true" />
                  {lv.text}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-ink">
                    {a.name} <span className="font-mono text-meta font-normal text-ink-3">{a.ticker.replace(/\.TW$/, "")}</span>
                  </span>
                  <span className={`block truncate text-meta ${STATUS_TEXT[status.tone]}`}>
                    {a.evidence.length} 則證據，{status.text}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={`block font-mono text-body font-semibold tabular-nums ${lv.value}`}>{a.z_score == null ? "—" : signed(a.z_score)}</span>
                  <span className="block text-meta text-ink-3">{a.article_count} 則</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function AlertsPage() {
  const [sessions, setSessions] = useState(cache.sessions);
  const [latest, setLatest] = useState(cache.latest);
  const [asOf, setAsOfState] = useState(cache.asOf);
  const [includeAll, setIncludeAllState] = useState(cache.includeAll);
  const [selected, setSelectedState] = useState(cache.selected);
  const [results, setResults] = useState(cache.results);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const dateInput = useRef<HTMLInputElement>(null);

  const setAsOf = (d: string) => {
    remember({ asOf: d });
    setAsOfState(d);
    setError(null);
  };
  const setIncludeAll = (v: boolean) => {
    remember({ includeAll: v });
    setIncludeAllState(v);
    setError(null);
  };
  const setSelected = (t: string) => {
    remember({ selected: t });
    setSelectedState(t);
  };

  useEffect(() => {
    if (cache.sessions) return;
    api
      .alertSessions()
      .then((r) => {
        const want = requested(r.sessions);
        remember({ sessions: r.sessions, latest: r.latest, asOf: cache.asOf ?? want.asOf ?? r.latest, selected: cache.selected ?? want.ticker });
        setSessions(r.sessions);
        setLatest(r.latest);
        setAsOfState(cache.asOf);
        setSelectedState(cache.selected);
      })
      .catch((e: unknown) => setError(describe(e)));
  }, [retryToken]);

  const key = asOf ? keyOf(asOf, includeAll) : null;
  const data = key ? results[key] : undefined;

  useEffect(() => {
    if (!asOf || !key || cache.results[key]) return;
    let cancelled = false;
    api
      .alerts(asOf, includeAll)
      .then((r) => {
        remember({ results: { ...cache.results, [key]: r } });
        if (!cancelled) setResults(cache.results);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(describe(e));
      });
    return () => {
      cancelled = true;
    };
  }, [asOf, includeAll, key, retryToken]);

  const idx = sessions && asOf ? sessions.indexOf(asOf) : -1;
  const loading = !error && !data;
  // 有任何一張卡帶重大訊息對照時，頁尾顯名資料來源
  const announcedSince = data?.alerts.find((a) => a.announcements)?.announcements?.data_since;
  const current = data ? (data.alerts.find((a) => a.ticker === selected) ?? sortAlerts(data.alerts, "z")[0]) : undefined;
  const p = data?.params;

  return (
    <>
      <TopBar title={<PageTitle>台股警示</PageTitle>} subtitle="49 檔台股的新聞情緒異常，開盤前查證用" width="wide" />
      <StatusBanner
        width="wide"
        error={error}
        onRetry={() => {
          setError(null);
          setRetryToken((n) => n + 1);
        }}
      />

      <main className="mx-auto w-full max-w-6xl space-y-4 px-4 pt-4 lg:px-8 lg:pt-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* 交易日切換 */}
          <div className="card flex items-center gap-1 p-1.5">
            <IconButton label="前一個交易日" onClick={() => sessions && setAsOf(sessions[idx - 1])} disabled={idx <= 0}>
              <ChevronLeft size={20} />
            </IconButton>
            <motion.button
              type="button"
              whileTap={press}
              disabled={!sessions}
              onClick={() => {
                const el = dateInput.current;
                if (!el) return;
                try {
                  el.showPicker();
                } catch {
                  el.focus();
                }
              }}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl transition-colors hover:bg-surface-2"
              aria-label={asOf ? `交易日 ${asOf}，點一下選其他日期` : "選擇交易日"}
            >
              <CalendarDays size={17} className="text-brand" />
              <span className="font-mono text-title font-semibold tabular-nums text-ink">{asOf ?? " "}</span>
              {asOf && <span className="text-meta text-ink-3">{WEEKDAY[new Date(`${asOf}T00:00:00Z`).getUTCDay()]}</span>}
            </motion.button>
            <input
              ref={dateInput}
              type="date"
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              min={sessions?.[0]}
              max={sessions?.[sessions.length - 1]}
              value={asOf ?? ""}
              onChange={(e) => sessions && e.target.value && setAsOf(snapToSession(sessions, e.target.value))}
            />
            <IconButton
              label="後一個交易日"
              onClick={() => sessions && setAsOf(sessions[idx + 1])}
              disabled={!sessions || idx < 0 || idx >= sessions.length - 1}
            >
              <ChevronRight size={20} />
            </IconButton>
          </div>

          {/* 四種等級的檔數；資料不足與正常分開，不混在一起 */}
          {loading ? (
            <Skeleton className="h-[3.75rem] rounded-2xl" />
          ) : data ? (
            <dl className="card grid grid-cols-4 divide-x divide-hairline">
              {SUMMARY.map(({ level, label }) => {
                const lv = LEVEL[level];
                const n = data.summary[level];
                return (
                  <div key={level} className="flex flex-col items-center justify-center px-2 py-2">
                    <dd className={`font-mono text-title font-semibold tabular-nums ${n > 0 ? lv.value : "text-ink-3"}`}>{n}</dd>
                    <dt className="flex items-center gap-1 text-meta text-ink-3">
                      <lv.Icon size={12} aria-hidden="true" />
                      {label}
                    </dt>
                  </div>
                );
              })}
            </dl>
          ) : null}
        </div>

        {latest && asOf && asOf !== latest && (
          <button type="button" onClick={() => setAsOf(latest)} className="flex min-h-10 items-center gap-1.5 px-1 text-body text-brand">
            <RotateCcw size={15} /> 回到最新交易日（{latest}）
          </button>
        )}

        {data && !data.window_closed && (
          <p className="flex items-center gap-2 rounded-2xl bg-warn-soft px-4 py-2.5 text-meta text-warn">
            <Clock size={15} className="shrink-0" />
            這個交易日還沒開盤，標題仍在累積，結果可能再變。
          </p>
        )}

        <div className="flex items-start gap-2.5 rounded-2xl border border-hairline bg-surface-2/60 px-4 py-3 text-meta text-ink-2">
          <Info size={15} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
          <div className="space-y-1">
            {p && (
              <p>
                門檻：z 值低於 {signed(p.watch_z, 1)} 為留意、低於 {signed(p.high_z, 1)} 為高度異常。z 值是當日情緒分數相對前 {p.baseline_sessions} 個交易日的標準化差距，越負代表比平常越負面；當日至少 {p.min_articles} 則標題才判斷。
              </p>
            )}
            <p>
              歷史回測中，事前示警率與隨機響鈴無法區分（p = 0.983）。本頁是開盤前的即時警示與證據標題，用來決定先查證哪幾檔，不是提前預警。
              {data && data.scorer !== LEGACY_SCORER && "回測用本機的 Gemma 3 27B 評分；本頁改用 Google AI Studio 上的 Gemma 4 評分，尚未重新回測。"}
              <a href={BACKTEST_URL} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-brand underline-offset-2 hover:underline">
                回測紀錄
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </p>
          </div>
        </div>

        {data && (
          <div role="group" aria-label="列出哪些股票" className="grid grid-cols-2 gap-1 rounded-full border border-hairline bg-surface p-1 lg:max-w-md">
            {(
              [
                [false, `需要查證 ${data.summary.high + data.summary.watch} 檔`],
                [true, `全部 ${data.universe_size} 檔`],
              ] as const
            ).map(([all, text]) => {
              const active = includeAll === all;
              return (
                <button
                  key={text}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setIncludeAll(all)}
                  className={`relative min-h-10 rounded-full text-body transition-colors ${active ? "font-semibold text-ink" : "text-ink-3 hover:text-ink-2"}`}
                >
                  {active && <motion.span layoutId="alerts-scope" transition={snappy} className="absolute inset-0 rounded-full bg-surface-3" />}
                  <span className="relative">{text}</span>
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-2xl" />
            ))}
          </div>
        ) : data && data.alerts.length > 0 ? (
          <>
            <ul className="space-y-4 lg:hidden">
              {sortAlerts(data.alerts, "z").map((a, i) => (
                <AlertCard key={a.ticker} alert={a} index={i} />
              ))}
            </ul>
            <div className="hidden lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-6">
              <AlertList alerts={data.alerts} selected={current?.ticker ?? null} onSelect={setSelected} />
              {current && (
                <div className="sticky top-[calc(env(safe-area-inset-top)+7rem)]">
                  <AlertCard key={current.ticker} alert={current} as="div" />
                </div>
              )}
            </div>
          </>
        ) : data ? (
          <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink-2">
              <LEVEL.normal.Icon size={22} />
            </span>
            <p className="text-body text-ink">這個交易日沒有股票達到警示門檻。</p>
            {data.summary.insufficient > 0 && (
              <p className="text-meta text-ink-3">其中 {data.summary.insufficient} 檔資料不足、無法判斷；切到「全部」可以看到各自缺什麼。</p>
            )}
          </div>
        ) : null}

        {announcedSince && (
          <p className="px-1 text-meta text-ink-3">
            公司重大訊息的資料來源：臺灣證券交易所（政府資料開放平臺「上市公司每日重大訊息」資料集），依
            <a href="https://data.gov.tw/license" target="_blank" rel="noopener noreferrer" className="mx-1 text-brand underline-offset-2 hover:underline">
              政府資料開放授權條款
            </a>
            利用。本站自 {announcedSince} 起逐日累積，只收主旨。
          </p>
        )}
      </main>
    </>
  );
}
