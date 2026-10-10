"use client";

import { createLocalStore } from "@/lib/local-store";

/**
 * 台股頁的警示配色：琥珀關注度色階（預設）或紅色。台灣讀者看到紅色會讀成「漲」，所以預設琥珀；
 * 習慣紅色表示警示的人可以在設定頁改回。美股頁的綠正紅負不受影響。
 */
export type AlertPalette = "amber" | "red";

export const alertPaletteStore = createLocalStore<AlertPalette>(
  "alert-palette",
  (raw) => (raw === "red" ? "red" : "amber"),
  "amber",
);

export function setAlertPalette(p: AlertPalette) {
  alertPaletteStore.set(p);
  document.documentElement.setAttribute("data-alert-palette", p);
}
