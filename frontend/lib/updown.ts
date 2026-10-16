"use client";

import { createLocalStore } from "@/lib/local-store";

/**
 * 新聞情緒的正負顏色：green-up＝正面綠、負面紅（美股慣例，預設）；red-up＝正面紅、負面綠（台股慣例）。
 * 只對調情緒色（globals.css 的 --pos / --neg）；錯誤提示、台股警示配色與產業熱度圖不受影響。
 */
export type UpDown = "green-up" | "red-up";

export const upDownStore = createLocalStore<UpDown>(
  "updown",
  (raw) => (raw === "red-up" ? "red-up" : "green-up"),
  "green-up",
);

/** 存偏好並同步 <html data-updown>；globals.css 依此對調 --pos / --neg */
export function setUpDown(value: UpDown) {
  upDownStore.set(value);
  document.documentElement.setAttribute("data-updown", value);
}
