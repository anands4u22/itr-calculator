export function isDebugMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("debug") === "1";
}

export function formatErrorForDisplay(err: unknown, debug: boolean): string {
  if (err instanceof Error) {
    const base = err.message || err.name || "Unknown error";
    if (debug && err.stack) {
      return `${base}\n\n--- stack ---\n${err.stack}`;
    }
    return base;
  }
  if (typeof err === "string") return err;
  if (debug) {
    try {
      return JSON.stringify(err, null, 2);
    } catch {
      return String(err);
    }
  }
  return "Something went wrong.";
}
