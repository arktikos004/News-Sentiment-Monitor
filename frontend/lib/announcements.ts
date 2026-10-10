import type { AlertEvidence, AnnouncementCheck } from "@/lib/api";

/**
 * 公告對照的一句話狀態（警示卡、總覽清單、警示頁列表共用）。
 * 不能把「沒有資料」說成「沒有公告」：區間早於公告資料起點、區間內有漏收的交易日，
 * 或區間後段還沒收錄（當天的公告隔天清晨才出）時，都要說清楚涵蓋到哪一天。
 * caveat 是資料限制的提醒，用中性樣式；台股頁的琥珀只留給警示等級。
 */
export type AnnouncementStatus = { text: string; tone: "brand" | "neutral" | "caveat" };

const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

export function announcementStatus(check: AnnouncementCheck | null | undefined): AnnouncementStatus {
  if (!check || check.window_end < check.data_since) return { text: "沒有公告資料可對照", tone: "neutral" };
  const missing = check.missing_days ?? [];
  const before = check.window_start < check.data_since; // 區間前段早於資料起點
  const after = check.window_end > check.data_through; // 區間後段還沒收錄
  const from = before ? check.data_since : check.window_start;
  const to = after ? check.data_through : check.window_end;
  if (check.count > 0) {
    const clarified = check.items.some((a) => a.clarification);
    const limits = `${before ? `，${md(check.data_since)} 之前沒有資料` : ""}${after ? `，${md(check.data_through)} 之後尚未收錄` : ""}`;
    return { text: `${check.count} 則重大訊息${clarified ? "（含澄清）" : ""}${limits}`, tone: "brand" };
  }
  if (missing.length > 0) return { text: `${missing.map(md).join("、")} 公告漏收，無法確認`, tone: "caveat" };
  if (from > to) return { text: "這段期間的公告尚未收錄", tone: "caveat" };
  if (before || after) {
    // 日期區間的頭尾就是資料的起訖，「之前」「之後」不必再寫一次日期
    const days = from === to ? md(from) : `${md(from)}–${md(to)}`;
    return { text: `${days} 未發布${before ? "，之前沒有資料" : ""}${after ? "，之後尚未收錄" : ""}`, tone: "caveat" };
  }
  return { text: "公司未發布重大訊息", tone: "neutral" };
}

/** 比對用的標題：去掉「討論牆|」這類欄目前綴、全形半形統一、拿掉空白與標點，同一則報導的不同版面就會一樣 */
function normalizeTitle(title: string): string {
  return title
    .replace(/^[^|｜]{1,8}[|｜]\s*/, "")
    .normalize("NFKC")
    .replace(/[\s\p{P}\p{S}]/gu, "")
    .toLowerCase();
}

/** 同一則報導常被不同版面重複收錄：正規化後相同的標題只留第一則（已依負面程度排序） */
export function uniqueEvidence(items: AlertEvidence[]): AlertEvidence[] {
  const seen = new Set<string>();
  return items.filter((e) => {
    const k = normalizeTitle(e.title);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
