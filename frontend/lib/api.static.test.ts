/**
 * 靜態站（news.sekinv.com）的 API：讀每日匯出的 /data/*.json，在瀏覽器端重做後端的篩選規則。
 * 這些規則必須與 backend/newssent/api/routers/alerts.py 一致，否則公開站和本機 API 會給出不同的看板。
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { AlertLevel } from "@/lib/api";

const BOARD_DAY = "2026-10-06";
const OPENS_AT = "2026-10-06T01:00:00+00:00"; // 台北 09:00 開盤

function alert(ticker: string, level: AlertLevel) {
  return {
    ticker,
    name: ticker,
    level,
    reason: null,
    z_score: null,
    score_today: null,
    baseline_mean: null,
    baseline_std: null,
    score_change: null,
    article_count: 3,
    baseline_days: 20,
    recent_score: null,
    recent: [],
    evidence: [],
  };
}

const BOARD = {
  as_of: BOARD_DAY,
  window_closed: false, // 匯出當下凍結的值
  scorer: "llm-test",
  params: {},
  universe_size: 4,
  summary: { high: 1, watch: 1, normal: 1, insufficient: 1 },
  alerts: [alert("A", "high"), alert("B", "watch"), alert("C", "normal"), alert("D", "insufficient")],
  opens_at: OPENS_AT,
};

/** 假的靜態檔：routes 以外的路徑一律 404 */
function serve(routes: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url in routes
        ? new Response(JSON.stringify(routes[url]), { status: 200, headers: { "content-type": "application/json" } })
        : new Response("not found", { status: 404 }),
    ),
  );
}

/** 每次重新載入模組：STATIC_DATA 在載入時讀環境變數，siteMeta 也有模組層快取 */
async function loadStaticApi() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_STATIC_DATA", "1");
  return (await import("@/lib/api")).staticApi;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("staticApi.alerts", () => {
  it("預設只列 high／watch，include_all 時全部列出", async () => {
    serve({ [`/data/alerts/${BOARD_DAY}.json`]: BOARD });
    const api = await loadStaticApi();
    expect((await api.alerts(BOARD_DAY)).alerts.map((a) => a.ticker)).toEqual(["A", "B"]);
    expect((await api.alerts(BOARD_DAY, true)).alerts.map((a) => a.ticker)).toEqual(["A", "B", "C", "D"]);
  });

  it("window_closed 依 opens_at 與現在時間重算，回傳值不帶 opens_at", async () => {
    serve({ [`/data/alerts/${BOARD_DAY}.json`]: BOARD });
    const api = await loadStaticApi();
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2026-10-06T00:59:00Z"));
    const before = await api.alerts(BOARD_DAY);
    expect(before.window_closed).toBe(false);
    expect(before).not.toHaveProperty("opens_at");

    vi.setSystemTime(new Date("2026-10-06T01:00:00Z"));
    expect((await api.alerts(BOARD_DAY)).window_closed).toBe(true);
  });

  it("沒指定日期時用日曆的最新交易日", async () => {
    serve({
      "/data/alerts/sessions.json": { sessions: ["2026-10-05", BOARD_DAY], latest: BOARD_DAY },
      [`/data/alerts/${BOARD_DAY}.json`]: BOARD,
    });
    const api = await loadStaticApi();
    expect((await api.alerts()).as_of).toBe(BOARD_DAY);
  });

  it("沒有那一天的看板時回 422 INVALID_SESSION（同後端）", async () => {
    serve({});
    const api = await loadStaticApi();
    await expect(api.alerts("2026-10-04")).rejects.toMatchObject({ status: 422, code: "INVALID_SESSION" });
  });
});

describe("staticApi.alertSessions", () => {
  it("日曆是空的時候回 503 ALERT_DATA_UNAVAILABLE", async () => {
    serve({ "/data/alerts/sessions.json": { sessions: [], latest: null } });
    const api = await loadStaticApi();
    await expect(api.alertSessions()).rejects.toMatchObject({ status: 503, code: "ALERT_DATA_UNAVAILABLE" });
  });
});
