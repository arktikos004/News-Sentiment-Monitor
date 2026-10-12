import type { AlertsResponse } from "@/lib/api";

/**
 * 台股警示看板的時間狀態，決定標題怎麼寫（新聞窗口在交易日 09:00 開盤時截止）：
 * - upcoming：這個交易日還沒開盤，標題仍在累積 →「下一交易日警示：10/13，尚未開盤」
 * - today：今天的交易日已經開盤（盤中或盤後）→「今日警示」
 * - past：過去的交易日 →「歷史：10/08」
 */
export type BoardPhase = "upcoming" | "today" | "past";

type Board = Pick<AlertsResponse, "as_of" | "window_closed">;

/** 2026-10-13 → 10/13 */
export const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

/** 台北的今天 YYYY-MM-DD */
export function taipeiToday(now = Date.now()): string {
  return new Date(now).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

export function boardPhase(board: Board, now = Date.now()): BoardPhase {
  if (!board.window_closed) return "upcoming";
  return board.as_of === taipeiToday(now) ? "today" : "past";
}

export function boardTitle(board: Board, now = Date.now()): string {
  const phase = boardPhase(board, now);
  if (phase === "upcoming") return `下一交易日警示：${md(board.as_of)}，尚未開盤`;
  if (phase === "today") return "今日警示";
  return `歷史：${md(board.as_of)}`;
}

/** 看板裡公告資料的最新發言日（各檔的公告對照共用同一份資料）；沒有公告資料時為 null */
export function announcementsThrough(board: Pick<AlertsResponse, "alerts">): string | null {
  const days = board.alerts.flatMap((a) => (a.announcements ? [a.announcements.data_through] : []));
  return days.length ? days.reduce((a, b) => (a > b ? a : b)) : null;
}

/** 可判讀（正常、留意、高度異常）與資料不足的檔數 */
export function coverage(board: Pick<AlertsResponse, "summary" | "universe_size">) {
  const { high, watch, normal, insufficient } = board.summary;
  return { judged: high + watch + normal, insufficient, triggered: high + watch, universe: board.universe_size };
}
