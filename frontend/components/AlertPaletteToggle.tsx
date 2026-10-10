"use client";

/** 台股警示配色切換（設定頁）：琥珀關注度色階或紅色。選項旁附色票，切換立即生效並存在這台裝置。 */

import { motion } from "motion/react";
import { alertPaletteStore, setAlertPalette, type AlertPalette } from "@/lib/alert-palette";
import { snappy } from "@/lib/motion";

const OPTIONS: { value: AlertPalette; text: string; swatch: [string, string] }[] = [
  { value: "amber", text: "琥珀", swatch: ["#f59e42", "#e3c25b"] },
  { value: "red", text: "紅色", swatch: ["#f46268", "#e8a33d"] },
];

export default function AlertPaletteToggle() {
  const palette = alertPaletteStore.useValue();
  return (
    <div role="group" aria-label="台股警示配色" className="inline-grid grid-cols-2 gap-1 rounded-full border border-hairline bg-surface-2 p-1">
      {OPTIONS.map(({ value, text, swatch }) => {
        const active = palette === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setAlertPalette(value)}
            className={`relative flex min-h-10 min-w-24 items-center justify-center gap-2 rounded-full px-4 text-body transition-colors ${
              active ? "font-semibold text-ink" : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {active && (
              <motion.span layoutId="alert-palette-pill" transition={snappy} className="absolute inset-0 rounded-full bg-surface shadow-(--shadow-card)" />
            )}
            <span className="relative flex gap-0.5" aria-hidden="true">
              <span className="size-2.5 rounded-full" style={{ background: swatch[0] }} />
              <span className="size-2.5 rounded-full" style={{ background: swatch[1] }} />
            </span>
            <span className="relative">{text}</span>
          </button>
        );
      })}
    </div>
  );
}
