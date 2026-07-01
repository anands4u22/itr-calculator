import { isDebugMode } from "@/lib/utils/debug";

export interface ParseLogEntry {
  ts: number;
  stage: string;
  detail: string;
  data?: unknown;
}

/** SSR-only fallback when window is unavailable */
const ssrLogs: ParseLogEntry[] = [];

declare global {
  interface Window {
    __form16ParseLogs?: ParseLogEntry[];
    __TEST_PDF_B64__?: string;
    __TEST_PDF_NAME__?: string;
    __TEST_RESULT__?: unknown;
  }
}

function getStore(): ParseLogEntry[] {
  if (typeof window === "undefined") return ssrLogs;
  window.__form16ParseLogs ??= [];
  return window.__form16ParseLogs;
}

/** Structured parse pipeline logging — stored on window for tests + ?debug=1 console */
export function parseLog(stage: string, detail: string, data?: unknown): void {
  const entry: ParseLogEntry = { ts: Date.now(), stage, detail, data };
  getStore().push(entry);

  if (isDebugMode()) {
    if (data !== undefined) {
      console.log(`[Form16Parse:${stage}] ${detail}`, data);
    } else {
      console.log(`[Form16Parse:${stage}] ${detail}`);
    }
  }
}

export function clearParseLogs(): void {
  getStore().length = 0;
}

export function getParseLogs(): ParseLogEntry[] {
  return [...getStore()];
}
