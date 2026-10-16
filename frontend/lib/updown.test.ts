/**
 * 正負顏色的偏好（localStorage "updown"）：預設正綠負紅，存值認不得時當成預設；
 * localStorage 不能用（無痕模式、封鎖網站資料）時不丟例外。首次繪製前的開機腳本必須和 store 讀出同一個值。
 */

import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-constants";

/** 假的 localStorage */
function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, String(value));
    },
  };
}

/** 封鎖網站資料時，一讀寫就丟例外 */
const blockedStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("SecurityError");
  },
};

/** 只記屬性的 <html> */
function fakeDocument() {
  const attrs = new Map<string, string>();
  return {
    documentElement: {
      setAttribute: (name: string, value: string) => {
        attrs.set(name, value);
      },
      getAttribute: (name: string) => attrs.get(name) ?? null,
    },
  };
}

/** 每次重新載入模組：store 在模組層快取讀到的值 */
async function load(storage: object) {
  vi.resetModules();
  vi.stubGlobal("localStorage", storage);
  const doc = fakeDocument();
  vi.stubGlobal("document", doc);
  return { ...(await import("@/lib/updown")), html: doc.documentElement };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("upDownStore", () => {
  it("沒選過時是正綠負紅", async () => {
    const { upDownStore } = await load(memoryStorage());
    expect(upDownStore.get()).toBe("green-up");
  });

  it("存了 red-up 就是正紅負綠", async () => {
    const { upDownStore } = await load(memoryStorage({ updown: "red-up" }));
    expect(upDownStore.get()).toBe("red-up");
  });

  it.each(["", "red", "RED-UP", " red-up", "green", "null"])("存值 %j 認不得，當成正綠負紅", async (raw) => {
    const { upDownStore } = await load(memoryStorage({ updown: raw }));
    expect(upDownStore.get()).toBe("green-up");
  });

  it("setUpDown 存進 localStorage，並同步 <html data-updown>", async () => {
    const storage = memoryStorage();
    const { upDownStore, setUpDown, html } = await load(storage);

    setUpDown("red-up");
    expect(upDownStore.get()).toBe("red-up");
    expect(storage.items.get("updown")).toBe("red-up");
    expect(html.getAttribute("data-updown")).toBe("red-up");

    setUpDown("green-up");
    expect(upDownStore.get()).toBe("green-up");
    expect(storage.items.get("updown")).toBe("green-up");
    expect(html.getAttribute("data-updown")).toBe("green-up");
  });

  it("localStorage 不能用時不丟例外，選擇只在這次開啟有效", async () => {
    const { upDownStore, setUpDown, html } = await load(blockedStorage);
    expect(upDownStore.get()).toBe("green-up");
    expect(() => setUpDown("red-up")).not.toThrow();
    expect(upDownStore.get()).toBe("red-up");
    expect(html.getAttribute("data-updown")).toBe("red-up");
  });
});

describe("首次繪製前的開機腳本", () => {
  function boot(storage: object) {
    const doc = fakeDocument();
    runInNewContext(THEME_BOOT_SCRIPT, { localStorage: storage, document: doc });
    return doc.documentElement;
  }

  it("沒選過或存值認不得時標 green-up", () => {
    expect(boot(memoryStorage()).getAttribute("data-updown")).toBe("green-up");
    expect(boot(memoryStorage({ updown: "red" })).getAttribute("data-updown")).toBe("green-up");
  });

  it("存了 red-up 就標 red-up，主題與警示配色照舊", () => {
    const html = boot(memoryStorage({ updown: "red-up", theme: "light", "alert-palette": "red" }));
    expect(html.getAttribute("data-updown")).toBe("red-up");
    expect(html.getAttribute("data-theme")).toBe("light");
    expect(html.getAttribute("data-alert-palette")).toBe("red");
  });

  it("localStorage 不能用時不丟例外，全部用預設值", () => {
    const html = boot(blockedStorage);
    expect(html.getAttribute("data-updown")).toBe("green-up");
    expect(html.getAttribute("data-theme")).toBe("dark");
    expect(html.getAttribute("data-alert-palette")).toBe("amber");
  });
});
