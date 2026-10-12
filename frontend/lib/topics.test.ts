import { describe, expect, it } from "vitest";
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

  it("漲跌動詞要和 stock、shares 這類字一起出現才是股價異動", () => {
    expect(labels("Global smartphone shipments drop 20% in third quarter")).not.toContain("股價異動");
    expect(labels("Apple stock drops after earnings")).toContain("股價異動");
    expect(labels("Why the AI rally has room to run in this bull market")).toContain("股價異動");
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
