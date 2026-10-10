"use client";

/**
 * 頂列下方的狀態列（每一頁都看得到）：資料更新時間、台股警示的最新交易日與需要查證的檔數、台股標題的評分狀態。
 * 每日排程失敗時線上會停在上一版：超過 48 小時沒更新、評分額度用盡或更新失敗都排到最前面並加上圖示。
 * 提醒用鋼藍色加圖示，不用琥珀：台股頁的琥珀只代表警示等級。
 * 高度固定（手機兩行、桌機一行），載入中先佔好位置，頂列不會跳動；讀不到時直接說讀不到。
 * 本機開發（即時後端）沒有 meta.json，不顯示。
 */

import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { siteMeta, STATIC_DATA, type AlertsResponse, type SiteMeta } from "@/lib/api";
import { latestBoard } from "@/lib/latest-board";

const STALE_HOURS = 48;

function taipeiTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

type Entry = { key: string; label: string; value: React.ReactNode; warn: boolean };

function Item({ label, value, warn }: Omit<Entry, "key">) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <dt className="text-ink-3">{label}</dt>
      <dd className={`flex items-center gap-1 font-semibold ${warn ? "text-brand" : "text-ink"}`}>
        {warn && <TriangleAlert size={12} aria-hidden="true" />}
        {value}
      </dd>
    </div>
  );
}

/** widthClass：與頂列同一個最大寬度（TopBar 的 PAGE_WIDTH），左右邊界才對得齊 */
export default function StatusStrip({ widthClass }: { widthClass: string }) {
  const [meta, setMeta] = useState<(SiteMeta & { stale: boolean }) | null | "error">(null);
  const [board, setBoard] = useState<AlertsResponse | null>(null);

  useEffect(() => {
    if (!STATIC_DATA) return;
    siteMeta()
      .then((m) => setMeta({ ...m, stale: Date.now() - Date.parse(m.generated_at) > STALE_HOURS * 3600 * 1000 }))
      .catch(() => setMeta("error"));
    latestBoard().then(setBoard).catch(() => setBoard(null));
  }, []);

  if (!STATIC_DATA) return null;

  let entries: Entry[] = [];
  if (meta === "error") {
    entries = [{ key: "error", label: "資料狀態", value: "讀不到，重新整理再試一次", warn: true }];
  } else if (meta) {
    const triggered = board ? board.summary.high + board.summary.watch : null;
    const scoringWarn = meta.alerts_status === "quota" || meta.alerts_status === "failed";
    entries = [
      { key: "updated", label: "資料更新", value: `${taipeiTime(meta.generated_at)}${meta.stale ? "，可能已過期" : ""}`, warn: meta.stale },
      ...(meta.alerts_latest
        ? [
            {
              key: "alerts",
              label: "台股警示",
              value: (
                // 整頁載入：警示頁從網址讀日期（client-side 切換會沿用它快取的上次日期）
                <a href={`/alerts?date=${meta.alerts_latest}`} className="hover:underline">
                  {md(meta.alerts_latest)}
                  {triggered != null && `，${triggered} 檔需要查證`}
                </a>
              ),
              warn: false,
            },
          ]
        : []),
      {
        key: "scoring",
        label: "台股評分",
        value: meta.alerts_status === "quota" ? "額度用盡，部分標題未評分" : meta.alerts_status === "failed" ? "更新失敗，顯示前一次結果" : "正常",
        warn: scoringWarn,
      },
    ];
    // 有問題的項目排最前面
    entries.sort((a, b) => Number(b.warn) - Number(a.warn));
  }

  return (
    <div className="border-t border-hairline">
      <dl
        aria-label="資料狀態"
        aria-busy={meta === null}
        className={`mx-auto flex h-12 w-full flex-wrap content-center items-center gap-x-4 gap-y-0.5 px-4 text-meta sm:h-8 sm:flex-nowrap sm:overflow-x-auto sm:whitespace-nowrap lg:px-8 ${widthClass}`}
      >
        {meta === null ? (
          <>
            <span className="h-3 w-28 rounded-sm bg-surface-2 motion-safe:animate-pulse" />
            <span className="h-3 w-36 rounded-sm bg-surface-2 motion-safe:animate-pulse" />
          </>
        ) : (
          entries.map(({ key, ...e }) => <Item key={key} {...e} />)
        )}
      </dl>
    </div>
  );
}
