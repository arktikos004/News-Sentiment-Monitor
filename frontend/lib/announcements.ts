import type { AnnouncementCheck } from "@/lib/api";

/**
 * 公告對照的一句話狀態（警示卡、總覽清單、警示頁列表共用）。
 * 不能把「沒有資料」說成「沒有公告」：區間早於公告資料起點、或區間內有漏收的交易日時，都說無法確認。
 */
export type AnnouncementStatus = { text: string; tone: "brand" | "neutral" | "warn" };

export function announcementStatus(check: AnnouncementCheck | null | undefined): AnnouncementStatus {
  if (!check || check.window_end < check.data_since) return { text: "沒有公告資料可對照", tone: "neutral" };
  const missing = check.missing_days ?? [];
  if (check.count > 0) {
    const clarified = check.items.some((a) => a.clarification);
    return { text: `${check.count} 則重大訊息${clarified ? "（含澄清）" : ""}`, tone: "brand" };
  }
  if (missing.length > 0) return { text: `${missing.join("、")} 公告漏收，無法確認`, tone: "warn" };
  return { text: "公司未發布重大訊息", tone: "neutral" };
}
