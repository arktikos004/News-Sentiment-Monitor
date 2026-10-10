"use client";

/**
 * 台股警示的單檔卡片，依查證的順序排列：先看證據標題（當日評分為負的標題，最多 3 則，同一則報導只列一次；
 * 每則標題下方附關鍵字標籤），
 * 再看公司近 3 個交易日有沒有發布重大訊息（證交所開放資料，只收主旨），最後才是分數與走勢。
 * 警示等級用台股警示配色（設定頁可選琥珀或紅色），不代表漲跌方向。
 * 台股代號過不了 /api/stocks 的代號驗證，所以不連到美股的總覽與新聞頁。
 */

import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  ExternalLink,
  FileQuestion,
  Info,
  Megaphone,
  Siren,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import AlertTrend from "@/components/AlertTrend";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { announcementStatus, uniqueEvidence } from "@/lib/announcements";
import type { AlertLevel, AnnouncementCheck, StockAlert } from "@/lib/api";
import { relativeTime, signed } from "@/lib/format";
import { delay } from "@/lib/motion";
import { twTitleTopics, zhKeyWords } from "@/lib/topics";

/**
 * 證據標題下方的關鍵字：中文詞表比對出的主題（最多 3 個，依查證時的重要性排序）；
 * 一個都沒比對到時，從標題斷詞取 2 個重點字（排除這檔自己的名稱與代號）。只比對標題文字，不影響分數。
 */
function EvidenceTags({ title, exclude }: { title: string; exclude: string[] }) {
  const topics = twTitleTopics(title)
    .slice(0, 3)
    .map((t) => t.label);
  const tags = topics.length ? topics : zhKeyWords(title, exclude, 2);
  if (tags.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5 text-meta">
      <span className="sr-only">關鍵字：</span>
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-ink-2">
          {t}
        </span>
      ))}
    </div>
  );
}

// 公開資訊觀測站沒有穩定的單則公告連結，只能連到首頁、請使用者以代號查詢
export const MOPS_URL = "https://mops.twse.com.tw/";

export const LEVEL: Record<
  AlertLevel,
  { text: string; badge: string; value: string; color: string; Icon: LucideIcon }
> = {
  high: { text: "高度異常", badge: "bg-alert-high-soft text-alert-high", value: "text-alert-high", color: "var(--alert-high)", Icon: Siren },
  watch: { text: "留意", badge: "bg-alert-watch-soft text-alert-watch", value: "text-alert-watch", color: "var(--alert-watch)", Icon: TriangleAlert },
  normal: { text: "正常", badge: "bg-surface-2 text-ink-2", value: "text-ink", color: "var(--brand)", Icon: CircleCheck },
  insufficient: { text: "資料不足", badge: "bg-surface-2 text-ink-3", value: "text-ink-3", color: "var(--ink-3)", Icon: CircleHelp },
};

// 資料限制的提醒（漏收、尚未收錄）用中性底加圖示；琥珀與紅色只留給警示等級
const STATUS_STYLE = {
  brand: "bg-brand-soft text-brand",
  neutral: "bg-surface-2 text-ink-2",
  caveat: "bg-surface-2 text-ink-2",
} as const;

/**
 * 公告對照。區間早於公告資料的起點時不顯示細節（不能把「沒有資料」說成「沒有公告」）；
 * 區間有一部分在資料範圍外時加註，例如當天的公告要隔天清晨才出。區間內有漏收的日子時，也不能說「沒有公告」。
 * 「新聞內容尚未經公司公告證實」只在有證據標題時才說：沒有標題就沒有可證實的內容。
 */
function Announcements({ check, code, hasEvidence }: { check: AnnouncementCheck; code: string; hasEvidence: boolean }) {
  const status = announcementStatus(check);
  // 涵蓋到哪一天已經寫在狀態標籤裡，這裡只補充原因
  const note = [
    check.window_start < check.data_since && `本站自 ${check.data_since} 起收錄公告`,
    check.window_end > check.data_through && "當天的公告要隔天清晨才會收錄",
  ]
    .filter(Boolean)
    .map((t) => `${t}。`)
    .join("");
  const mops = (
    <a href={MOPS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-brand underline-offset-2 hover:underline">
      公開資訊觀測站
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  );

  return (
    <section className="mt-4">
      <h3 className="flex flex-wrap items-center gap-2 text-meta font-semibold text-ink-2">
        <Megaphone size={14} className="text-brand" aria-hidden="true" />
        公司重大訊息（近 3 個交易日）
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 [word-break:keep-all] ${STATUS_STYLE[status.tone]}`}>
          {status.tone === "caveat" && <CircleAlert size={12} aria-hidden="true" />}
          {status.text}
        </span>
      </h3>
      {check.count > 0 ? (
        <ul className="mt-2 space-y-2.5 rounded-xl border border-hairline px-3 py-3">
          {check.items.map((a) => (
            <li key={`${a.day}-${a.time}-${a.subject}`} className="min-w-0">
              <p className="text-body text-ink">
                {a.clarification && (
                  <span className="mr-1.5 inline-flex rounded-full bg-brand-soft px-2 py-0.5 align-middle text-meta font-semibold text-brand">澄清</span>
                )}
                {a.subject}
              </p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-meta text-ink-3">
                <span className="font-mono tabular-nums">
                  {a.day} {a.time.slice(0, 5)}
                </span>
                <span>符合條款{a.clause}</span>
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 flex items-start gap-1.5 text-meta text-ink-3">
        <FileQuestion size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          {hasEvidence && check.count === 0 && status.tone === "neutral" && status.text !== "沒有公告資料可對照" && "新聞內容尚未經公司公告證實。"}
          全文請到{mops}以代號 {code} 查詢。{note}
        </span>
      </p>
    </section>
  );
}

/**
 * as="li"：手機的卡片清單，id 讓總覽點進來時能捲到這一檔（scroll-margin 留出頂列與狀態列），marked 加外框標出是哪一檔。
 * as="div"：大螢幕右欄的詳情。
 */
export default function AlertCard({
  alert,
  index = 0,
  as = "li",
  marked = false,
}: {
  alert: StockAlert;
  index?: number;
  as?: "li" | "div";
  marked?: boolean;
}) {
  const lv = LEVEL[alert.level];
  const triggered = alert.level === "high" || alert.level === "watch";
  const evidence = uniqueEvidence(alert.evidence);
  const code = alert.ticker.replace(/\.TW$/, "");
  const Tag = as;

  return (
    <Tag
      id={as === "li" ? `alert-${code}` : undefined}
      className={`card animate-rise scroll-mt-[calc(env(safe-area-inset-top)+7.75rem)] overflow-hidden ${marked ? "ring-2 ring-brand" : ""}`}
      style={as === "li" ? delay(index, 0, 40) : undefined}
    >
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-baseline gap-2">
              <span className="truncate text-title font-semibold text-ink">{alert.name}</span>
              <span className="font-mono text-meta text-ink-3">{code}</span>
            </h2>
            <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-meta font-semibold ${lv.badge}`}>
              <lv.Icon size={12} strokeWidth={2.4} aria-hidden="true" />
              {lv.text}
            </span>
          </div>
          {alert.z_score != null && (
            <div className="text-right">
              <p className={`font-mono text-title font-semibold tabular-nums ${lv.value}`}>{signed(alert.z_score)}</p>
              <p className="text-meta text-ink-3">z 值</p>
            </div>
          )}
        </div>

        {alert.level === "insufficient" ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-meta text-ink-2">
            <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {alert.reason ?? "資料不足，無法判斷。"}
          </p>
        ) : (
          <>
            {(triggered || evidence.length > 0) && (
              <section className="mt-4">
                <h3 className="text-meta font-semibold text-ink-2">證據標題（{evidence.length} 則）</h3>
                {evidence.length > 0 ? (
                  <ul className="mt-2 space-y-3">
                    {evidence.map((e) => (
                      <li key={`${e.title}-${e.published_at}`} className="flex gap-3">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full" style={{ background: lv.color }} aria-hidden="true" />
                        <div className="min-w-0">
                          {e.url ? (
                            <a
                              href={e.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-body text-ink underline decoration-hairline underline-offset-4 hover:text-brand hover:decoration-brand"
                            >
                              {e.title}
                              <ExternalLink size={13} className="ml-1 inline align-[-1px] text-ink-3" aria-label="另開新分頁" />
                            </a>
                          ) : (
                            <p className="text-body text-ink">{e.title}</p>
                          )}
                          <EvidenceTags title={e.title} exclude={[alert.name, code]} />
                          <p className="mt-0.5 flex flex-wrap gap-x-3 text-meta text-ink-3">
                            <span>{e.source}</span>
                            <span>{relativeTime(e.published_at)}</span>
                            <span>
                              分數 <span className="font-mono tabular-nums text-ink-2">{signed(e.score)}</span>
                            </span>
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2.5 text-meta text-ink-2">
                    當日 {alert.article_count} 則標題都沒有負面評分，所以沒有可查證的負面標題；這次警示來自情緒比平常低（當日 {signed(alert.score_today)}，20 日基準{" "}
                    {signed(alert.baseline_mean)}）。
                  </p>
                )}
              </section>
            )}

            {alert.announcements && (triggered || alert.announcements.count > 0) && (
              <Announcements check={alert.announcements} code={code} hasEvidence={evidence.length > 0} />
            )}

            <p className="mt-4 text-meta text-ink-3">
              當日分數 <span className="font-mono tabular-nums text-ink-2">{signed(alert.score_today)}</span>
              ，20 日基準 <span className="font-mono tabular-nums text-ink-2">{signed(alert.baseline_mean)}</span>
              ，當日標題 <span className="font-mono tabular-nums text-ink-2">{alert.article_count}</span> 則
            </p>

            <Collapsible defaultOpen={as === "div"} className="mt-3 border-t border-hairline">
              <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between text-meta font-semibold text-ink-2">
                近 5 個交易日走勢
                <ChevronDown size={16} className="text-ink-3 transition-transform duration-300 group-data-[state=open]:rotate-180" aria-hidden="true" />
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden pb-1 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                <AlertTrend points={alert.recent} baseline={alert.baseline_mean} color={lv.color} />
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </div>
    </Tag>
  );
}
