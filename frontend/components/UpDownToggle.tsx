"use client";

/**
 * 正負顏色切換（設定頁）：美股慣例（正綠負紅）或台股慣例（正紅負綠）。選項旁的色票依序是正面、負面的顏色，
 * 切換立即生效並存在這台裝置。窄螢幕放不下一行時，括號裡的規則換到第二行。
 */

import { motion } from "motion/react";
import { snappy } from "@/lib/motion";
import { setUpDown, upDownStore, type UpDown } from "@/lib/updown";

// 色票讀主題的綠、紅色票（globals.css），淺色主題下顯示的就是淺色主題的實際色值
const OPTIONS: { value: UpDown; text: string; rule: string; swatch: [string, string] }[] = [
  { value: "green-up", text: "美股慣例", rule: "正綠負紅", swatch: ["var(--green)", "var(--red)"] },
  { value: "red-up", text: "台股慣例", rule: "正紅負綠", swatch: ["var(--red)", "var(--green)"] },
];

export default function UpDownToggle() {
  const upDown = upDownStore.useValue();
  return (
    <div role="group" aria-label="正負顏色" className="inline-grid grid-cols-2 gap-1 rounded-full border border-hairline bg-surface-2 p-1">
      {OPTIONS.map(({ value, text, rule, swatch }) => {
        const active = upDown === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setUpDown(value)}
            className={`relative flex min-h-10 min-w-24 items-center justify-center rounded-full px-3 py-1 text-body leading-snug transition-colors ${
              active ? "font-semibold text-ink" : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {active && (
              <motion.span layoutId="updown-pill" transition={snappy} className="absolute inset-0 rounded-full bg-surface shadow-(--shadow-card)" />
            )}
            <span className="relative flex flex-wrap items-center justify-center">
              <span className="flex items-center gap-1.5">
                <span className="flex gap-0.5" aria-hidden="true">
                  <span className="size-2.5 rounded-full" style={{ background: swatch[0] }} />
                  <span className="size-2.5 rounded-full" style={{ background: swatch[1] }} />
                </span>
                {text}
              </span>
              <span className="whitespace-nowrap">（{rule}）</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
