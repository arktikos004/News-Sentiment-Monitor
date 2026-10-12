import { Info, type LucideIcon } from "lucide-react";

/**
 * 資料限制與系統提醒（DESIGN.md 的 caveat-note）：鋼藍淡底或中性灰底，一定附圖示，不用琥珀或紅色——
 * 琥珀在台股頁只代表警示等級。字級 14px：限制說明不能比內文難讀。
 */
export default function CaveatNote({
  icon: Icon = Info,
  tone = "steel",
  className = "",
  children,
}: {
  icon?: LucideIcon;
  tone?: "steel" | "neutral";
  className?: string;
  children: React.ReactNode;
}) {
  const style = tone === "steel" ? "bg-brand-soft text-ink" : "border border-hairline bg-surface-2 text-ink-2";
  return (
    <div role="note" className={`flex items-start gap-2.5 rounded-2xl px-4 py-2.5 text-note ${style} ${className}`}>
      <Icon size={16} className="mt-[3px] shrink-0 text-brand" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </div>
  );
}
