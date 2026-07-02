import { isDebugMode } from "@/lib/utils/debug";

export interface ParseLogEntry {
  ts: number;
  stage: string;
  detail: string;
  data?: unknown;
}

declare global {
  interface Window {
    __form16ParseLogs?: ParseLogEntry[];
    __TEST_PDF_B64__?: string;
    __TEST_PDF_NAME__?: string;
    __TEST_RESULT__?: unknown;
  }
}

function store(): ParseLogEntry[] {
  if (typeof window === "undefined") return [];
  window.__form16ParseLogs ??= [];
  return window.__form16ParseLogs;
}

/** Structured parse pipeline logging — stored on window for tests + ?debug=1 console */
export function parseLog(stage: string, detail: string, data?: unknown): void {
  if (typeof window === "undefined") return;
  const entry: ParseLogEntry = { ts: Date.now(), stage, detail, data };
  store().push(entry);

  if (isDebugMode()) {
    if (data !== undefined) {
      console.log(`[Form16Parse:${stage}] ${detail}`, data);
    } else {
      console.log(`[Form16Parse:${stage}] ${detail}`);
    }
  }
}

export function clearParseLogs(): void {
  if (typeof window === "undefined") return;
  window.__form16ParseLogs = [];
}

export function getParseLogs(): ParseLogEntry[] {
  return [...store()];
}

export function formatParseLogSummary(maxEntries = 12): string {
  const logs = getParseLogs();
  if (logs.length === 0) return "no parse logs recorded";
  const tail = logs.slice(-maxEntries);
  return tail
    .map((e) => `${e.stage}: ${e.detail}${e.data ? ` ${JSON.stringify(e.data)}` : ""}`)
    .join("\n");
}
