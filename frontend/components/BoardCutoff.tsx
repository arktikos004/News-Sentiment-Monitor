import type { AlertsResponse } from "@/lib/api";
import { announcementsThrough, boardPhase, md } from "@/lib/board-phase";
import { taipeiTime } from "@/lib/format";

/**
 * 警示看板的資料截止時間：新聞標題與公司公告各自更新到什麼時候。
 * 新聞窗口在交易日 09:00 開盤時截止；還沒開盤時，標題收錄到最近一次更新（generatedAt，只有靜態站才有）。
 * 公司公告是證交所隔天清晨才出的開放資料，所以通常比新聞晚一天。
 */
export default function BoardCutoff({ board, generatedAt, className = "" }: { board: AlertsResponse; generatedAt?: string | null; className?: string }) {
  const through = announcementsThrough(board);
  const news =
    boardPhase(board) === "upcoming"
      ? `新聞標題${generatedAt ? `收錄到 ${taipeiTime(generatedAt)}，` : ""}${md(board.as_of)} 09:00 開盤時截止`
      : `新聞標題收錄到 ${md(board.as_of)} 09:00 開盤`;
  return (
    <p className={`text-note text-ink-2 ${className}`}>
      {news}
      {through && `；公司公告的資料到 ${md(through)}`}。
    </p>
  );
}
