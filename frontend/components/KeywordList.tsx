/**
 * 熱門關鍵字：後端對計入指數的標題算好 TF-IDF 分數，這裡依分數排行、長條表示相對強弱（依序長出）。
 * 公司自己的名字後端已經排除；舊版靜態檔還沒排除，所以這裡用同一張別名表再濾一次。
 */

import type { KeywordScore } from "@/lib/api";
import { delay } from "@/lib/motion";
import { aliasesOf } from "@/lib/news-relevance";

const LIMIT = 10;
const MOBILE_LIMIT = 6; // 單欄時只列前 6 名，雙欄（sm 以上）列滿 10 名

export default function KeywordList({ keywords, ticker, aliases }: { keywords: KeywordScore[]; ticker?: string; aliases?: string[] }) {
  // 多字的名稱拆成單字（關鍵字都是單字）
  const selfWords = new Set<string>(ticker ? aliasesOf(ticker.toUpperCase(), aliases).flatMap((a) => a.toLowerCase().split(/\s+/)) : []);
  const filtered = keywords.filter((k) => !selfWords.has(k.word.toLowerCase()));
  // 全被濾掉（極少見）就退回原始清單，避免整塊空白
  const shown = (filtered.length > 0 ? filtered : keywords).slice(0, LIMIT);

  if (shown.length === 0) {
    return <p className="text-body text-ink-2">計入指數的新聞太少，還排不出關鍵字。</p>;
  }
  const max = Math.max(...shown.map((k) => k.score));

  return (
    <ol className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {shown.map((k, i) => (
        <li
          key={k.word}
          className={`${i >= MOBILE_LIMIT ? "hidden sm:grid" : "grid"} grid-cols-[1.5rem_7rem_minmax(0,1fr)] items-center gap-2`}
          title={`TF-IDF 分數 ${k.score.toFixed(3)}${k.count ? `，出現在 ${k.count} 則標題` : ""}`}
        >
          <span className="font-mono text-meta tabular-nums text-ink-3">{i + 1}</span>
          <span className="truncate text-body text-ink">{k.word}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <span
              className="block h-full origin-left animate-grow-x rounded-full bg-linear-to-r from-brand/60 to-brand"
              style={{ transform: `scaleX(${max > 0 ? k.score / max : 0})`, ...delay(i, 100) }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}
