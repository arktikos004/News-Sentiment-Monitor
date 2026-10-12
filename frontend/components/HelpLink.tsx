import Link from "next/link";
import type { ReactNode } from "react";
import { METHOD_PATH } from "@/lib/method";

/** 「方法與限制」頁的段落：各頁只放一個短連結，定義與但書集中寫在那一頁 */
export type MethodSection = "us-model" | "index" | "relevance" | "score" | "tags" | "tw-checklist" | "tw-model";

export default function HelpLink({ to, children = "說明", className = "" }: { to: MethodSection; children?: ReactNode; className?: string }) {
  return (
    <Link href={`${METHOD_PATH}#${to}`} className={`whitespace-nowrap text-brand underline-offset-2 hover:underline ${className}`}>
      {children}
    </Link>
  );
}
