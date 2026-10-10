"use client";

import { api, type AlertsResponse } from "@/lib/api";

/**
 * 最新交易日的台股警示看板（含全池 49 檔）。狀態列與總覽共用同一個請求，一次開啟只抓一次；失敗不快取。
 */
let pending: Promise<AlertsResponse> | null = null;

export function latestBoard(): Promise<AlertsResponse> {
  pending ??= api.alerts(undefined, true).catch((e) => {
    pending = null;
    throw e;
  });
  return pending;
}
