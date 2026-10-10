"use client";

/**
 * 產業情緒儀表板：49 檔依證交所產業別彙總成「產業 × 交易日」熱度圖。點產業名稱展開個股，
 * 點一格看當天的數字並連到那天的警示看板（佐證標題最多 3 則在那裡）。
 * 下半部是警示門檻模擬：調整基準天數、最少則數與 z 門檻，看每天會有幾檔觸發警示，
 * 並反推「每天最多 N 檔」需要的門檻。只算工作量，不重算命中率（那是新的成效數字，要先預先聲明）。
 *
 * 熱度圖用發散色（藍＝正面、紅＝負面、灰＝中性；globals.css 的 --div-*），台股頁不用綠色，
 * 免得和「跌」混淆。沒有新聞的日子留白，不和「中性」混在一起。
 */

import { ChevronDown, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import StatusBanner from "@/components/StatusBanner";
import Skeleton from "@/components/Skeleton";
import { PageTitle, TopBar } from "@/components/TopBar";
import { api, ApiError, type AlertLevel, type AlertPanelResponse, type AlertWhatIfResponse } from "@/lib/api";

const SHOW_SESSIONS = 20;
const BINS = [0.05, 0.15, 0.3, 0.5]; // |分數| 的分界：中性、弱、中、強、很強
const LEVEL_TEXT: Record<AlertLevel, string> = { high: "高度異常", watch: "留意", normal: "正常", insufficient: "資料不足" };

const signed = (v: number | null, digits = 2) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}`);
const mmdd = (d: string) => d.slice(5);

/** 發散色：|分數| ≤ 0.05 為中性灰；其餘依強度往藍（正）或紅（負）混 25／50／75／100%。 */
function cellColor(score: number | null): string | undefined {
  if (score == null) return undefined;
  const m = Math.abs(score);
  if (m <= BINS[0]) return "var(--div-mid)";
  const step = m <= BINS[1] ? 1 : m <= BINS[2] ? 2 : m <= BINS[3] ? 3 : 4;
  return `color-mix(in oklab, ${score > 0 ? "var(--div-pos)" : "var(--div-neg)"} ${step * 25}%, var(--div-mid))`;
}

function describe(e: unknown): string {
  if (e instanceof ApiError && e.status === 404) return "產業儀表板的資料由每日排程產生，目前還沒有這一份。";
  return e instanceof Error ? e.message : "發生未知錯誤，請重新整理";
}

type Cell = { score: number | null; n: number; alerts: number; z?: number | null; level?: AlertLevel };
type Picked = { label: string; day: string; cell: Cell; members?: number };

function Cells({ cells, days, label, onPick, members }: {
  cells: Cell[];
  days: string[];
  label: string;
  onPick: (p: Picked) => void;
  members?: number;
}) {
  return (
    <>
      {cells.map((c, j) => (
        <button
          key={days[j]}
          type="button"
          onClick={() => onPick({ label, day: days[j], cell: c, members })}
          aria-label={`${label} ${days[j]}：分數 ${signed(c.score)}，${c.n} 則${c.alerts ? `，${c.alerts} 檔觸發警示` : ""}`}
          className="relative flex h-5 items-center justify-center rounded-[3px] outline-offset-1"
          style={c.score == null ? { boxShadow: "inset 0 0 0 1px var(--hairline)" } : { background: cellColor(c.score) }}
        >
          {c.alerts > 0 && <span className="size-1.5 rounded-full bg-ink" />}
        </button>
      ))}
    </>
  );
}

function Heatmap({ panel }: { panel: AlertPanelResponse }) {
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);

  const view = useMemo(() => {
    const start = Math.max(0, panel.sessions.length - SHOW_SESSIONS);
    const days = panel.sessions.slice(start);
    const byTicker = new Map(panel.tickers.map((t) => [t.ticker, t]));
    const industries = panel.industries.map((g) => {
      const members = g.tickers.flatMap((t) => byTicker.get(t) ?? []);
      const cells: Cell[] = days.map((_, j) => {
        const k = start + j;
        let sum = 0;
        let n = 0;
        let alerts = 0;
        for (const m of members) {
          const s = m.score[k];
          if (s != null && m.n[k] > 0) {
            sum += s * m.n[k];
            n += m.n[k];
          }
          if (m.level[k] === "high" || m.level[k] === "watch") alerts += 1;
        }
        return { score: n ? sum / n : null, n, alerts };
      });
      const stocks = members.map((m) => ({
        name: m.name,
        cells: days.map((_, j): Cell => {
          const k = start + j;
          const triggered = m.level[k] === "high" || m.level[k] === "watch";
          return { score: m.score[k], n: m.n[k], alerts: triggered ? 1 : 0, z: m.z[k], level: m.level[k] };
        }),
      }));
      return { name: g.name, count: members.length, cells, stocks };
    });
    return { days, industries };
  }, [panel]);

  const { days, industries } = view;
  const latest = days.length - 1;
  const grid = { gridTemplateColumns: `minmax(4.5rem, 6.5rem) repeat(${days.length}, minmax(0, 1fr))` };
  const ranked = [...industries]
    .filter((g) => g.cells[latest]?.score != null)
    .sort((a, b) => (a.cells[latest].score ?? 0) - (b.cells[latest].score ?? 0));

  return (
    <section className="card p-4">
      <h2 className="text-body font-semibold text-ink">產業 × 交易日的新聞情緒</h2>
      <p className="mt-1 text-meta text-ink-3">
        每格是該產業當天標題的平均分數（依則數加權）；點產業名稱展開個股，點一格看數字。
      </p>

      <div className="mt-3 grid gap-[2px]" style={grid}>
        {industries.map((g) => (
          <div key={g.name} className="contents">
            <button
              type="button"
              onClick={() => setOpen(open === g.name ? null : g.name)}
              aria-expanded={open === g.name}
              title={g.name}
              className="flex min-w-0 items-center gap-1 pr-1 text-left text-meta text-ink-2 hover:text-ink"
            >
              <ChevronDown size={12} className={`shrink-0 transition-transform ${open === g.name ? "rotate-180" : ""}`} />
              <span className="truncate">{g.name}</span>
              <span className="shrink-0 text-ink-3">{g.count}</span>
            </button>
            <Cells cells={g.cells} days={days} label={g.name} onPick={setPicked} members={g.count} />
            {open === g.name &&
              g.stocks.map((s) => (
                <div key={s.name} className="contents">
                  <span className="truncate pl-4 text-meta text-ink-3">{s.name}</span>
                  <Cells cells={s.cells} days={days} label={s.name} onPick={setPicked} />
                </div>
              ))}
          </div>
        ))}
        <span />
        <div className="flex justify-between text-meta text-ink-3" style={{ gridColumn: `2 / span ${days.length}` }}>
          <span>{mmdd(days[0])}</span>
          <span>{mmdd(days[latest])}</span>
        </div>
      </div>

      {/* 圖例：發散色＋無新聞＋警示記號 */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-meta text-ink-3">
        <span className="flex items-center gap-1">
          負面
          {[-0.6, -0.4, -0.2, -0.1, 0, 0.1, 0.2, 0.4, 0.6].map((v) => (
            <span key={v} className="inline-block h-3 w-3 rounded-[2px]" style={{ background: cellColor(v) }} />
          ))}
          正面
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-[2px]" style={{ boxShadow: "inset 0 0 0 1px var(--hairline)" }} />
          當天沒有新聞
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-1.5 rounded-full bg-ink" />
          當天有股票觸發警示
        </span>
      </div>

      {picked && (
        <div className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5 text-meta text-ink-2">
          <p>
            <span className="font-semibold text-ink">{picked.label}</span> {picked.day}：分數{" "}
            <span className="font-mono tabular-nums text-ink">{signed(picked.cell.score)}</span>，{picked.cell.n} 則標題
            {picked.members != null
              ? `，${picked.members} 檔中 ${picked.cell.alerts} 檔觸發警示`
              : `，z ${signed(picked.cell.z ?? null)}（${LEVEL_TEXT[picked.cell.level ?? "insufficient"]}）`}
          </p>
          {/* 整頁載入：警示頁從網址讀 ?date=，對齊到 ≤ 它的交易日 */}
          <a href={`/alerts?date=${picked.day}`} className="mt-1 inline-block font-semibold text-brand hover:underline">
            看 {picked.day} 的警示看板與證據標題
          </a>
        </div>
      )}

      {/* 表格視圖：最新交易日各產業的數字（由負面到正面） */}
      <details className="mt-3">
        <summary className="cursor-pointer text-meta font-semibold text-ink-2">
          {days[latest]} 各產業的數字（{ranked.length} 個有新聞）
        </summary>
        <table className="mt-2 w-full text-meta">
          <thead className="text-ink-3">
            <tr>
              <th className="py-1 text-left font-normal">產業</th>
              <th className="py-1 text-right font-normal">分數</th>
              <th className="py-1 text-right font-normal">標題</th>
              <th className="py-1 text-right font-normal">警示</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums text-ink-2">
            {ranked.map((g) => (
              <tr key={g.name} className="border-t border-hairline">
                <td className="py-1 font-sans text-ink">{g.name}</td>
                <td className="py-1 text-right">{signed(g.cells[latest].score)}</td>
                <td className="py-1 text-right">{g.cells[latest].n}</td>
                <td className="py-1 text-right">
                  {g.cells[latest].alerts}／{g.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function Segmented<T extends number>({ label, values, value, format, onChange }: {
  label: string;
  values: T[];
  value: T;
  format: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-meta text-ink-3">{label}</p>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === value}
            onClick={() => onChange(v)}
            className={`min-h-9 rounded-full px-3 text-meta transition-colors ${
              v === value ? "bg-brand font-semibold text-brand-fg" : "bg-surface-2 text-ink-2 hover:text-ink"
            }`}
          >
            {format(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

function WhatIf({ data }: { data: AlertWhatIfResponse }) {
  const g = data.grid;
  const [baseline, setBaseline] = useState(data.default.baseline);
  const [minArticles, setMinArticles] = useState(data.default.min_articles);
  const [zi, setZi] = useState(Math.max(0, g.z.indexOf(data.default.z)));
  const [cap, setCap] = useState(3);

  const bi = g.baseline.indexOf(baseline);
  const mi = g.min_articles.indexOf(minArticles);
  // 只看可判斷的日子：評分器剛換、基準期還沒累積滿的日子全池都是資料不足，不算進來
  const days = data.sessions.map((s, k) => ({ s, k })).filter(({ k }) => data.judged[bi][mi][k] > 0);
  const counts = days.map(({ k }) => data.counts[bi][mi][zi][k]);
  const avg = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
  const most = counts.length ? Math.max(...counts) : 0;
  const busy = counts.filter((c) => c > 0).length;
  // 目標搜尋：z 由寬到嚴，第一個「期間內每天都不超過 cap 檔」的門檻
  const seek = g.z.findIndex((_, zj) => days.every(({ k }) => data.counts[bi][mi][zj][k] <= cap));

  const d0 = { b: g.baseline.indexOf(data.default.baseline), m: g.min_articles.indexOf(data.default.min_articles), z: g.z.indexOf(data.default.z) };
  const defaultDays = data.sessions.map((_, k) => k).filter((k) => data.judged[d0.b][d0.m][k] > 0);
  const defaultCounts = defaultDays.map((k) => data.counts[d0.b][d0.m][d0.z][k]);
  const defaultAvg = defaultCounts.length ? defaultCounts.reduce((a, b) => a + b, 0) / defaultCounts.length : 0;
  const scale = Math.max(most, cap, 1);

  return (
    <section className="card p-4">
      <h2 className="text-body font-semibold text-ink">警示門檻模擬</h2>
      <p className="mt-1 text-meta text-ink-3">
        調整參數，看每天會有幾檔觸發警示。只算工作量；換門檻後的事件命中率是新的成效數字，要先寫預先聲明才計算。
      </p>

      <div className="mt-3 space-y-3">
        <Segmented label="基準期（交易日）" values={g.baseline} value={baseline} format={(v) => `${v} 日`} onChange={setBaseline} />
        <Segmented label="當日至少幾則標題" values={g.min_articles} value={minArticles} format={(v) => `${v} 則`} onChange={setMinArticles} />
        <div>
          <p className="mb-1 flex justify-between text-meta text-ink-3">
            <span>警示門檻（z 低於）</span>
            <span className="font-mono tabular-nums text-ink">z &lt; {signed(g.z[zi])}</span>
          </p>
          <input
            type="range"
            min={0}
            max={g.z.length - 1}
            step={1}
            value={zi}
            onChange={(e) => setZi(Number(e.target.value))}
            aria-label="警示門檻"
            className="w-full accent-[var(--brand)]"
          />
          <p className="flex justify-between text-meta text-ink-3">
            <span>寬 {signed(g.z[0])}</span>
            <span>嚴 {signed(g.z[g.z.length - 1])}</span>
          </p>
        </div>
      </div>

      {days.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-3 py-3 text-meta text-ink-3">
          這組參數在期間內沒有可判斷的日子（基準期的資料還不夠長）。
        </p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-3 gap-2">
            {(
              [
                ["平均每天", `${avg.toFixed(1)} 檔`],
                ["最多一天", `${most} 檔`],
                ["有警示的日子", `${busy}／${days.length}`],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-surface-2 px-3 py-2">
                <dt className="text-meta text-ink-3">{k}</dt>
                <dd className="text-body font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          {/* 逐日觸發警示的檔數（單一數列，不需圖例）；水平線＝下方設定的每天上限 */}
          <div className="relative mt-4 h-28" role="img" aria-label={`逐日觸發警示的檔數，平均 ${avg.toFixed(1)} 檔，最多 ${most} 檔`}>
            <div className="flex h-full items-end gap-[2px]">
              {days.map(({ s, k }, j) => (
                <span
                  key={s}
                  title={`${s}：${counts[j]} 檔觸發警示（可判斷 ${data.judged[bi][mi][k]} 檔）`}
                  className="flex-1 rounded-t-[4px] bg-brand"
                  style={{ height: `${(counts[j] / scale) * 100}%`, minHeight: counts[j] ? 2 : 0, maxWidth: 24 }}
                />
              ))}
            </div>
            <div className="pointer-events-none absolute inset-x-0 border-t border-ink-3" style={{ bottom: `${(cap / scale) * 100}%` }}>
              <span className="absolute right-0 -top-4 text-meta text-ink-3">上限 {cap} 檔</span>
            </div>
          </div>
          <p className="mt-1 flex justify-between text-meta text-ink-3">
            <span>{mmdd(days[0].s)}</span>
            <span>{mmdd(days[days.length - 1].s)}</span>
          </p>

          <div className="mt-4 rounded-xl bg-surface-2 px-3 py-3 text-meta text-ink-2">
            <div className="flex flex-wrap items-center gap-2">
              <span>目標搜尋：每天最多</span>
              <button
                type="button"
                aria-label="減少"
                onClick={() => setCap(Math.max(1, cap - 1))}
                className="flex size-11 items-center justify-center rounded-full bg-surface text-ink transition-colors hover:bg-surface-3"
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <span className="font-mono text-body font-semibold tabular-nums text-ink">{cap}</span>
              <button
                type="button"
                aria-label="增加"
                onClick={() => setCap(Math.min(15, cap + 1))}
                className="flex size-11 items-center justify-center rounded-full bg-surface text-ink transition-colors hover:bg-surface-3"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
              <span>檔</span>
            </div>
            <p className="mt-2">
              {seek >= 0 ? (
                <>
                  在基準 {baseline} 日、至少 {minArticles} 則的條件下，期間內每天都不超過 {cap} 檔的最寬門檻是{" "}
                  <span className="font-mono font-semibold tabular-nums text-ink">z &lt; {signed(g.z[seek])}</span>
                  {seek !== zi && (
                    <button type="button" onClick={() => setZi(seek)} className="ml-2 font-semibold text-brand hover:underline">
                      套用
                    </button>
                  )}
                </>
              ) : (
                <>格點裡最嚴的門檻（z &lt; {signed(g.z[g.z.length - 1])}）也做不到每天都不超過 {cap} 檔。</>
              )}
            </p>
          </div>

          <p className="mt-3 text-meta text-ink-3">
            線上預設（基準 {data.default.baseline} 日、至少 {data.default.min_articles} 則、z &lt; {signed(data.default.z)}）：平均每天{" "}
            {defaultAvg.toFixed(1)} 檔。期間 {days[0].s}～{days[days.length - 1].s}（{days.length} 個可判斷的交易日），評分器 {data.scorer}
          </p>
        </>
      )}
    </section>
  );
}

export default function SectorsPage() {
  const [panel, setPanel] = useState<AlertPanelResponse | null>(null);
  const [whatIf, setWhatIf] = useState<AlertWhatIfResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .alertPanel()
      .then((p) => !cancelled && setPanel(p))
      .catch((e: unknown) => !cancelled && setError(describe(e)));
    api
      .alertWhatIf()
      .then((w) => !cancelled && setWhatIf(w))
      .catch((e: unknown) => !cancelled && setError(describe(e)));
    return () => {
      cancelled = true;
    };
  }, [retry]);

  return (
    <>
      <TopBar title={<PageTitle>產業儀表板</PageTitle>} subtitle="49 檔台股依產業彙總的新聞情緒" />
      <StatusBanner
        error={error}
        onRetry={() => {
          setError(null);
          setRetry((n) => n + 1);
        }}
      />
      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-4 lg:px-8 lg:pt-6">
        {panel ? <Heatmap panel={panel} /> : !error && <Skeleton className="h-96 w-full rounded-2xl" />}
        {whatIf ? <WhatIf data={whatIf} /> : !error && <Skeleton className="h-72 w-full rounded-2xl" />}
        <p className="px-1 text-meta text-ink-3">
          產業別取自證交所開放資料「上市公司每月營業收入彙總表」。分數是標題情緒的平均（−1 到 +1），只呈現衍生數值；證據標題（每檔最多 3 則）與原文連結在警示頁。
        </p>
      </main>
    </>
  );
}
