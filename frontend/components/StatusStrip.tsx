"use client";

/**
 * 頂列下方的狀態列（每一頁都看得到）：資料更新時間、台股警示的最新交易日與示警檔數、台股標題的評分狀態。
 * 每日排程失敗時線上會停在上一版：超過 48 小時沒更新、評分額度用盡或更新失敗，都以警示色標出。
 * 本機開發（即時後端）沒有 meta.json，不顯示。
 */

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
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

function Item({ label, children, warn = false }: { label: string; children: React.ReactNode; warn?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 border-l border-hairline pl-3 first:border-l-0 first:pl-0">
      <dt className="text-ink-3">{label}</dt>
      <dd className={`flex items-center gap-1 font-semibold ${warn ? "text-warn" : "text-ink"}`}>
        {warn && <TriangleAlert size={12} aria-hidden="true" />}
        {children}
      </dd>
    </div>
  );
}

/** widthClass：與頂列同一個最大寬度（TopBar 的 PAGE_WIDTH），左右邊界才對得齊 */
export default function StatusStrip({ widthClass }: { widthClass: string }) {
  const [meta, setMeta] = useState<(SiteMeta & { stale: boolean }) | null>(null);
  const [board, setBoard] = useState<AlertsResponse | null>(null);

  useEffect(() => {
    if (!STATIC_DATA) return;
    siteMeta()
      .then((m) => setMeta({ ...m, stale: Date.now() - Date.parse(m.generated_at) > STALE_HOURS * 3600 * 1000 }))
      .catch(() => setMeta(null));
    latestBoard().then(setBoard).catch(() => setBoard(null));
  }, []);

  if (!STATIC_DATA || !meta) return null;
  const triggered = board ? board.summary.high + board.summary.watch : null;
  const scoring =
    meta.alerts_status === "quota" ? "額度用盡，部分標題未評分" : meta.alerts_status === "failed" ? "更新失敗，顯示前一次結果" : "正常";

  return (
    <div className="border-t border-hairline">
      <dl
        aria-label="資料狀態"
        className={`mx-auto flex w-full items-center gap-x-3 h-8 overflow-x-auto whitespace-nowrap px-4 text-meta [scrollbar-width:none] lg:px-8 ${widthClass}`}
      >
        <Item label="資料更新" warn={meta.stale}>
          {taipeiTime(meta.generated_at)}
          {meta.stale && "，可能已過期"}
        </Item>
        {meta.alerts_latest && (
          <div className="flex shrink-0 items-center gap-1.5 border-l border-hairline pl-3">
            <dt className="text-ink-3">台股警示</dt>
            <dd>
              <Link href={`/alerts?date=${meta.alerts_latest}`} className="font-semibold text-ink hover:underline">
                {meta.alerts_latest}
                {triggered != null && `，${triggered} 檔需要查證`}
              </Link>
            </dd>
          </div>
        )}
        <Item label="台股評分" warn={meta.alerts_status === "quota" || meta.alerts_status === "failed"}>
          {scoring}
        </Item>
      </dl>
    </div>
  );
}
