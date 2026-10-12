"use client";

/**
 * 頂列下方的狀態列（每一頁都看得到）：資料更新時間，以及台股警示的三件事各自的狀態——
 * 評分服務（正常、額度用盡、更新失敗）、資料覆蓋（可判讀幾檔、幾檔資料不足）、警示結果（幾檔需要查證）。
 * 「資料不足」單獨列出，不併進「正常」，也不用一個燈號概括全部。
 * 每日排程失敗時線上會停在上一版：超過 48 小時沒更新、評分額度用盡或更新失敗都排到最前面並加上圖示。
 * 提醒用鋼藍色加圖示，不用琥珀：台股頁的琥珀只代表警示等級。
 * 手機兩行、桌機一行；每一項的文字自己說得通（標籤只給螢幕閱讀器），手機上才放得下。
 * 本機開發（即時後端）沒有 meta.json，不顯示。
 */

import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { siteMeta, STATIC_DATA, type AlertsResponse, type SiteMeta } from "@/lib/api";
import { boardPhase, coverage, md } from "@/lib/board-phase";
import { taipeiTime } from "@/lib/format";
import { latestBoard } from "@/lib/latest-board";

const STALE_HOURS = 48;

/** 狀態列裡的檔數：等寬、半粗，沒有標籤也看得出重點 */
const Num = ({ children }: { children: React.ReactNode }) => <span className="font-mono font-semibold tabular-nums text-ink">{children}</span>;

type Entry = { key: string; label: string; value: React.ReactNode; warn: boolean; href?: string };

function Item({ label, value, warn, href }: Omit<Entry, "key">) {
  const body = (
    <>
      {warn && <TriangleAlert size={12} aria-hidden="true" />}
      {value}
    </>
  );
  return (
    <div className="flex shrink-0 items-center">
      <dt className="sr-only">{label}</dt>
      <dd className={`flex items-center gap-1 ${warn ? "font-semibold text-brand" : "text-ink-2"}`}>
        {href ? (
          // 整頁載入：警示頁從網址讀日期（client-side 切換會沿用它快取的上次日期）
          <a href={href} className="flex items-center gap-1 hover:underline">
            {body}
          </a>
        ) : (
          body
        )}
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
    entries = [{ key: "error", label: "資料狀態", value: "資料狀態讀不到，重新整理再試一次", warn: true }];
  } else if (meta) {
    const scoringWarn = meta.alerts_status === "quota" || meta.alerts_status === "failed";
    const c = board ? coverage(board) : null;
    const day = board ? (boardPhase(board) === "upcoming" ? `${md(board.as_of)} 開盤前` : boardPhase(board) === "today" ? "今日" : md(board.as_of)) : null;
    entries = [
      {
        key: "updated",
        label: "資料更新",
        value: `${taipeiTime(meta.generated_at)} 更新${meta.stale ? "，可能已過期" : ""}`,
        warn: meta.stale,
      },
      {
        key: "scoring",
        label: "評分服務",
        value:
          meta.alerts_status === "quota"
            ? "評分額度用盡，部分標題未評分"
            : meta.alerts_status === "failed"
              ? "評分更新失敗，顯示前一次結果"
              : meta.alerts_status === "ok"
                ? "評分服務正常"
                : "評分服務狀態不明",
        warn: scoringWarn,
      },
      ...(c && board
        ? [
            {
              key: "judged",
              label: "資料覆蓋",
              value: (
                <span>
                  可判讀 <Num>{c.judged}</Num>/{c.universe} 檔
                </span>
              ),
              warn: false,
            },
            {
              key: "insufficient",
              label: "資料不足",
              value: (
                <span>
                  <Num>{c.insufficient}</Num> 檔資料不足
                </span>
              ),
              warn: false,
            },
            {
              key: "triggered",
              label: "警示結果",
              value: (
                <span>
                  {day}：<Num>{c.triggered}</Num> 檔需要查證
                </span>
              ),
              warn: false,
              href: `/alerts?date=${board.as_of}`,
            },
          ]
        : []),
    ];
    // 有問題的項目排最前面
    entries.sort((a, b) => Number(b.warn) - Number(a.warn));
  }

  return (
    <div className="border-t border-hairline">
      <dl
        aria-label="資料狀態"
        aria-busy={meta === null}
        className={`mx-auto flex min-h-12 w-full flex-wrap content-center items-center gap-x-4 gap-y-0.5 px-4 py-1 text-meta sm:h-8 sm:min-h-0 sm:flex-nowrap sm:overflow-x-auto sm:whitespace-nowrap sm:py-0 lg:px-8 ${widthClass}`}
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
