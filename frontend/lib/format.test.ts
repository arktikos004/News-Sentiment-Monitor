import { describe, expect, it } from "vitest";
import { hostname, relativeTime, shortTime, signed } from "@/lib/format";

describe("signed", () => {
  it("正數加 +，負數用真正的減號", () => {
    expect(signed(0.32)).toBe("+0.32");
    expect(signed(-0.18)).toBe("−0.18");
    expect(signed(-1.5, 1)).toBe("−1.5");
  });

  it("四捨五入成 0 時不帶正負號", () => {
    expect(signed(0.001)).toBe("0.00");
    expect(signed(-0.001)).toBe("0.00");
  });

  it("缺值顯示破折號", () => {
    expect(signed(null)).toBe("—");
    expect(signed(undefined)).toBe("—");
    expect(signed(Number.NaN)).toBe("—");
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-10-11T12:00:00Z");

  it("一分鐘內是「剛剛」", () => {
    expect(relativeTime("2026-10-11T11:59:40Z", now)).toBe("剛剛");
  });

  it("一小時內用分鐘、一天內用小時", () => {
    expect(relativeTime("2026-10-11T11:30:00Z", now)).toBe("30 分鐘前");
    expect(relativeTime("2026-10-11T09:00:00Z", now)).toBe("3 小時前");
  });

  it("超過一週改顯示日期時間；解析不了就原樣截短", () => {
    expect(relativeTime("2026-09-01T00:00:00Z", now)).toBe(shortTime("2026-09-01T00:00:00Z"));
    expect(relativeTime("not-a-date", now)).toBe("not-a-date");
  });
});

describe("hostname", () => {
  it("去掉 www.，網址無效時回空字串", () => {
    expect(hostname("https://www.reuters.com/markets/x")).toBe("reuters.com");
    expect(hostname("not a url")).toBe("");
  });
});
