"use client";

import { useEffect, useState } from "react";
import { clearParseLogs, getParseLogs } from "@/lib/form16/parseLog";

/** Dev/test-only page — Playwright injects PDF via window.__TEST_PDF_B64__ */
export default function TestParsePage() {
  const [status, setStatus] = useState("Waiting for PDF…");

  useEffect(() => {
    const run = async () => {
      const b64 = window.__TEST_PDF_B64__;
      const name = window.__TEST_PDF_NAME__ ?? "test.pdf";

      if (!b64) {
        window.__TEST_RESULT__ = { ok: false, error: "No __TEST_PDF_B64__ set" };
        setStatus("No PDF injected");
        return;
      }

      clearParseLogs();
      setStatus(`Parsing ${name}…`);

      try {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const file = new File([bytes], name, { type: "application/pdf" });

        const { parseForm16Pdf } = await import("@/lib/form16/pdf");
        const result = await parseForm16Pdf(file, (msg) => {
          setStatus(msg);
        });

        window.__TEST_RESULT__ = {
          ok: true,
          result,
          logs: getParseLogs(),
        };
        setStatus(
          `Done — matched ${result.matchedFields.length} field(s): ${result.matchedFields.join(", ")}`,
        );
      } catch (err) {
        window.__TEST_RESULT__ = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          logs: getParseLogs(),
        };
        setStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    void run();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-6 font-mono text-sm">
      <h1 className="mb-4 text-lg font-bold">Form 16 parse test</h1>
      <p id="parse-status">{status}</p>
    </main>
  );
}
