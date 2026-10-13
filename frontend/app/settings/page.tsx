"use client";

/**
 * 設定：外觀、模型資訊、研究說明、免責聲明。iOS 式分組卡片。
 * 測試集的分數不加「已驗證」之類的標記；細節在「方法與限制」頁。
 */

import { CalendarDays, ChevronRight, Cpu, FlaskConical, Newspaper, Palette, Scale, ShieldAlert, Siren } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import AlertPaletteToggle from "@/components/AlertPaletteToggle";
import Skeleton from "@/components/Skeleton";
import ThemeToggle from "@/components/ThemeToggle";
import { PageTitle, TopBar } from "@/components/TopBar";
import DataFreshness from "@/components/DataFreshness";
import { STATIC_DATA } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { METHOD_PATH, TW_BACKTEST } from "@/lib/method";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-4 text-meta text-ink-3">{title}</h2>
      <div className="card divide-y divide-hairline overflow-hidden">{children}</div>
    </section>
  );
}

/** stack：值是較長的文字（例如模型版本）時，窄螢幕改成值在標籤下方，不在字中間斷行 */
function Row({
  icon: Icon,
  tint,
  label,
  stack = false,
  children,
}: {
  icon: LucideIcon;
  tint: string;
  label: string;
  stack?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tint}`}>
        <Icon size={16} />
      </span>
      <div
        className={`flex min-w-0 flex-1 ${stack ? "flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3" : "items-center justify-between gap-3"}`}
      >
        <span className="whitespace-nowrap text-body text-ink">{label}</span>
        <span className={`min-w-0 break-words ${stack ? "sm:text-right" : "text-right"}`}>{children}</span>
      </div>
    </div>
  );
}

function Note({ icon: Icon, tint, children }: { icon: LucideIcon; tint: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-3.5">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tint}`}>
        <Icon size={16} />
      </span>
      <p className="flex-1 text-body text-ink-2">{children}</p>
    </div>
  );
}

export default function SettingsPage() {
  const { modelInfo, ensureModelInfo } = useAppState();

  useEffect(() => ensureModelInfo(), [ensureModelInfo]);

  const value = (v: React.ReactNode) => <span className="font-mono text-body tabular-nums text-ink-2">{v}</span>;

  return (
    <>
      <TopBar title={<PageTitle>設定</PageTitle>} />
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-4 lg:px-8 lg:pt-6">
        <Group title="外觀">
          <Row icon={Palette} tint="bg-brand-soft text-brand" label="主題">
            <ThemeToggle />
          </Row>
          <Row icon={Siren} tint="bg-alert-high-soft text-alert-high" label="台股警示配色">
            <AlertPaletteToggle />
          </Row>
          <p className="px-4 py-3 text-note text-ink-2">
            台股慣例紅色代表「漲」，所以警示等級與產業熱度圖的負值預設用琥珀；習慣用紅色表示警示的話可以改回。美股頁一律是綠色正面、紅色負面。
          </p>
        </Group>

        <Group title="情緒模型">
          {modelInfo === null ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : modelInfo === "error" ? (
            <Note icon={ShieldAlert} tint="bg-neg-soft text-neg">
              {STATIC_DATA ? "讀不到模型資訊，請稍後再試。" : "讀不到模型資訊：後端沒有回應，確認 API 已在 :8001 啟動。"}
            </Note>
          ) : modelInfo.is_mock ? (
            <Note icon={FlaskConical} tint="bg-surface-3 text-ink-2">
              模型尚未載入，各頁顯示的是示意資料。
            </Note>
          ) : (
            <>
              <Row icon={Cpu} tint="bg-brand-soft text-brand" label="模型版本" stack>
                {value(modelInfo.model_version)}
              </Row>
              <Row icon={FlaskConical} tint="bg-surface-3 text-ink-2" label="同來源測試集 Macro F1" stack>
                {value(modelInfo.test_macro_f1?.toFixed(3) ?? "—")}
              </Row>
              <Row icon={CalendarDays} tint="bg-surface-3 text-ink-2" label="訓練日期" stack>
                {value(modelInfo.trained_at?.slice(0, 10) ?? "—")}
              </Row>
            </>
          )}
        </Group>

        {STATIC_DATA && (
          <Group title="資料">
            <DataFreshness />
          </Group>
        )}

        <Group title="研究說明">
          <Link href={METHOD_PATH} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-ink-2">
              <ShieldAlert size={16} />
            </span>
            <span className="flex-1 text-body text-ink-2">
              美股標題分類只讀標題，同來源測試集的分數會高估線上表現；台股查證清單的回測與隨機響鈴無法區分（p = {TW_BACKTEST.p}），現行評分器尚未重新回測。
              <span className="mt-0.5 block font-semibold text-brand">看方法與限制</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-ink-3" aria-hidden="true" />
          </Link>
        </Group>

        <Group title="關於">
          <Note icon={Scale} tint="bg-surface-3 text-ink-2">
            情緒指數是機器學習模型的統計輸出，僅供學術研究與參考，不構成任何投資建議。
          </Note>
          <Note icon={Newspaper} tint="bg-surface-3 text-ink-2">
            資料來源：美股標題取自 Yahoo Finance，台股標題經 FinMind 彙整各媒體。本站只顯示標題、媒體名稱與原文連結，不轉載內文，每檔最多 20 則；著作權屬原媒體。
          </Note>
        </Group>
      </main>
    </>
  );
}
