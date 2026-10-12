import { describe, expect, it } from "vitest";
import type { NewsItem } from "@/lib/api";
import { aliasesOf, displayName, hasRelevance, inIndex, mentionedTickers, mentionsTicker, mentionText, pendingReason } from "@/lib/news-relevance";

const item = (extra: Partial<NewsItem> = {}): NewsItem => ({
  title: "Stocks rally as Fed holds rates",
  url: "https://example.com/1",
  published_at: "2026-10-12T00:00:00Z",
  sentiment: "positive",
  confidence: 0.9,
  ...extra,
});

describe("標題有沒有提到所選標的", () => {
  it("公司名稱整詞比對：Intelligence 不是 Intel", () => {
    expect(mentionsTicker("INTC", "Artificial Intelligence spending keeps rising")).toBe(false);
    expect(mentionedTickers("Artificial Intelligence spending keeps rising")).toEqual([]);
    expect(mentionedTickers("Intel's foundry wins a new customer")).toEqual(["INTC"]);
  });

  it("分大小寫的別名與代號：小寫的 arm、meta 不算", () => {
    expect(mentionedTickers("Investors arm themselves with meta trends")).toEqual([]);
    expect(mentionedTickers("ARM rallies after earnings")).toEqual(["ARM"]);
    expect(mentionsTicker("META", "Meta cuts jobs")).toBe(true);
  });

  it("ETF 是市場綜合，一律算提到", () => {
    expect(mentionsTicker("QQQ", "Stocks rally as Fed holds rates")).toBe(true);
  });

  it("「標題提到 X」的 X 是標題裡實際出現的字詞", () => {
    expect(mentionText("AAPL", "iPhones are selling out in China")).toBe("iPhone");
    expect(mentionText("AAPL", "Is $AAPL a buy?")).toBe("AAPL");
    expect(mentionText("AAPL", "Stocks rally")).toBeNull();
  });
});

describe("分組與理由", () => {
  it("舊版資料沒有相關性欄位：不分組，全部視為計入", () => {
    expect(hasRelevance([item()])).toBe(false);
    expect(inIndex(item())).toBe(true);
  });

  it("以後端的 in_index 為準", () => {
    expect(hasRelevance([item({ direct: false, in_index: false })])).toBe(true);
    expect(inIndex(item({ direct: false, in_index: false }))).toBe(false);
    expect(inIndex(item({ direct: true, in_index: true }))).toBe(true);
  });

  it("稱呼用第一個不是代號的別名；後端有給就用後端的", () => {
    expect(displayName("AAPL")).toBe("Apple");
    expect(displayName("ASML")).toBe("ASML");
    expect(displayName("TSM", ["TSMC", "Taiwan Semiconductor", "TSM"])).toBe("TSMC");
    expect(aliasesOf("META")).toEqual(["Meta Platforms", "Facebook", "Instagram", "Meta", "META"]);
  });

  it("關聯待確認的理由只寫新聞源的關聯與標題的字面", () => {
    expect(pendingReason(item({ related_tickers: ["AAPL", "MSFT", "AVGO"] }), "AAPL", "Apple")).toBe(
      "Yahoo 財經把這則關聯到 AAPL（也關聯 MSFT、AVGO），標題沒提到 Apple，不計入指數。",
    );
    expect(pendingReason(item({ related_tickers: ["AAPL"] }), "AAPL", "Apple")).toBe("Yahoo 財經把這則關聯到 AAPL，標題沒提到 Apple，不計入指數。");
    expect(pendingReason(item(), "AAPL", "Apple")).toBe("新聞源把這則收在 AAPL 的新聞裡，標題沒提到 Apple，不計入指數。");
  });
});
