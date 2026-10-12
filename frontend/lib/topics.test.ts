import { describe, expect, it } from "vitest";
import { mentionedTickers, mentionsTicker } from "@/lib/relevance";
import { titleTopics, twTitleTopics } from "@/lib/topics";

const labels = (title: string) => titleTopics(title).map((t) => t.label);
const twLabels = (title: string) => twTitleTopics(title).map((t) => t.label);

describe("美股標題的主題標籤", () => {
  it("庫藏股註銷是庫藏股與股本，不因為 Treasury 被標成債券與利率", () => {
    const tsmc = labels("Taiwan Semiconductor announces treasury share cancellation");
    expect(tsmc).toContain("庫藏股與股本");
    expect(tsmc).not.toContain("債券與利率");
    expect(labels("Board approves cancellation of treasury shares")).toEqual(["庫藏股與股本"]);
    expect(labels("Apple unveils $110 billion stock buyback")).toEqual(["庫藏股與股本"]);
  });

  it("美債殖利率與聯準會是債券與利率", () => {
    const yields = labels("Treasury yields climb as traders weigh Fed path");
    expect(yields).toContain("債券與利率");
    expect(yields).not.toContain("庫藏股與股本");
    expect(labels("10-year yield hits 4.5% after CPI report")).toEqual(["債券與利率"]);
    expect(labels("Federal Reserve holds interest rates steady")).toEqual(["債券與利率"]);
  });

  it("股利殖利率不是債券與利率", () => {
    expect(labels("3 high dividend yield stocks to buy now")).toEqual(["股利"]);
  });

  it("比對不到詞表就不加標籤，不從標題取字", () => {
    expect(labels("Forget the Hype: Here's What Matters")).toEqual([]);
    expect(labels("Chasing Returns? Read This First")).toEqual([]);
  });

  it("單獨的 cancellation 意思不明，不算庫藏股", () => {
    expect(labels("Netflix subscription cancellations ease")).toEqual([]);
  });
});

describe("台股證據標題的主題標籤", () => {
  it("高殖利率是股利，不是利率", () => {
    expect(twLabels("高殖利率股受青睞")).toEqual(["除權息"]);
    expect(twLabels("殖利率題材發酵")).toEqual([]);
  });

  it("美債殖利率與升息是債券與利率", () => {
    expect(twLabels("美債殖利率創新高")).toContain("債券與利率");
    expect(twLabels("聯準會升息壓力")).toEqual(["債券與利率"]);
  });

  it("比對不到詞表就不加標籤", () => {
    expect(twLabels("董監改選前夕的觀察")).toEqual([]);
  });
});

describe("標題提到哪些追蹤標的", () => {
  it("公司名稱整詞比對：Intelligence 不是 Intel", () => {
    expect(mentionedTickers("Artificial Intelligence spending keeps rising")).toEqual([]);
    expect(mentionsTicker("INTC", "Artificial Intelligence spending keeps rising")).toBe(false);
    expect(mentionedTickers("Intel's foundry wins a new customer")).toEqual(["INTC"]);
  });

  it("代號要是全大寫的獨立字", () => {
    expect(mentionedTickers("Arm yourself with these picks")).toEqual([]);
    expect(mentionedTickers("ARM rallies after earnings")).toEqual(["ARM"]);
  });
});
