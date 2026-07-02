"use client";

import { useState } from "react";
import { FY_LABEL } from "@/lib/tax/slabs";

export function UsageGuide() {
  const [open, setOpen] = useState(false);

  return (
    <section className="mb-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-900">How to use this calculator</span>
        <span className="text-xs font-medium text-indigo-600">
          {open ? "Hide" : "Show guide"}
        </span>
      </button>

      {open ? (
        <div className="space-y-5 border-t border-slate-100 px-5 pb-5 pt-4 text-sm text-slate-600">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Open{" "}
              <a
                href="https://itr-calculator.vercel.app/"
                className="font-medium text-indigo-600 hover:underline"
              >
                itr-calculator.vercel.app
              </a>{" "}
              on desktop or mobile.
            </li>
            <li>
              <strong className="text-slate-800">Step 1 — Upload</strong> your Form 16 PDF
              (Part B for salary; Part A optional for TDS). You can upload both together.
            </li>
            <li>
              <strong className="text-slate-800">Step 2 — Review</strong> auto-filled salary
              and deductions. Edit any field if needed, or enter values manually without a PDF.
            </li>
            <li>
              Add optional inputs — employer NPS, HRA, 80C, 80G — if they apply to you.
            </li>
            <li>
              Tap <strong className="text-slate-800">Compare tax regimes</strong> to see new vs
              old regime tax, TDS match, and which regime saves more for {FY_LABEL}.
            </li>
          </ol>

          <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
            <p className="font-semibold text-slate-800">Tips</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Part B has your gross salary; Part A is mainly TDS.</li>
              <li>Scanned PDFs work — the app reads them with OCR.</li>
              <li>Use &quot;Full manual form&quot; if you prefer entering every Form 16 line.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-xs leading-relaxed text-indigo-900">
            <p className="font-semibold">Privacy</p>
            <p className="mt-1">
              This app does <strong>not store, upload, or share</strong> any of your data. PDFs
              and numbers are processed entirely in your browser and are never sent to a server.
            </p>
          </div>

          <p className="text-xs text-slate-500">
            Estimates only — not tax advice. Surcharge, capital gains, and complex cases are not
            covered. Consult a CA for filing decisions.
          </p>
        </div>
      ) : null}
    </section>
  );
}
