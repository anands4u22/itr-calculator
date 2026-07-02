"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { ExtraInputsPanel } from "@/components/ExtraInputsPanel";
import { ManualForm } from "@/components/ManualForm";
import { TaxComparison } from "@/components/TaxComparison";
import { mergeForm16Data, createEmptyForm16 } from "@/lib/form16/parser";
import { calculateTaxComparison } from "@/lib/tax/calculator";
import {
  applyQuickInputs,
  EMPTY_QUICK_INPUTS,
  getQuickInputSummary,
  syncQuickInputsFromParse,
} from "@/lib/tax/mergeInputs";
import { FY_LABEL } from "@/lib/tax/slabs";
import { isMobileDevice } from "@/lib/utils/device";
import type { Form16Data } from "@/lib/tax/types";
import type { QuickInputs } from "@/lib/tax/mergeInputs";

const Form16Upload = dynamic(
  () =>
    import("@/components/Form16Upload").then((mod) => ({
      default: mod.Form16Upload,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-6 text-center text-sm text-slate-600">
        Loading PDF upload…
      </div>
    ),
  },
);

type Tab = "upload" | "manual";

export function CalculatorApp() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("upload");
  const [formData, setFormData] = useState<Form16Data>(createEmptyForm16());
  const [quickInputs, setQuickInputs] = useState<QuickInputs>(EMPTY_QUICK_INPUTS);
  const [parsedFile, setParsedFile] = useState<string | null>(null);
  const [parseSummary, setParseSummary] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showFullForm, setShowFullForm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsMobile(isMobileDevice());
  }, []);

  const effectiveFormData = useMemo(
    () => applyQuickInputs(formData, quickInputs),
    [formData, quickInputs],
  );

  const quickSummary = useMemo(
    () => getQuickInputSummary(quickInputs),
    [quickInputs],
  );

  const result = useMemo(
    () => (showResults ? calculateTaxComparison(effectiveFormData) : null),
    [effectiveFormData, showResults],
  );

  const hasSalary =
    quickInputs.annualGrossSalary > 0 ||
    effectiveFormData.salary17_1 > 0 ||
    effectiveFormData.perquisites17_2 > 0 ||
    effectiveFormData.profitsInLieu17_3 > 0;

  const handleParsed = (
    partial: Partial<Form16Data>,
    fileName: string,
    meta: { matchedFields: string[]; lineCount: number; usedOcr?: boolean },
  ) => {
    setFormData((prev) => mergeForm16Data(prev, partial));
    setQuickInputs((prev) => syncQuickInputsFromParse(prev, partial));
    setParsedFile(fileName);
    const salary = partial.salary17_1 ?? 0;
    const partBHint =
      salary <= 0 && partial.totalTds
        ? " Upload Part B for salary — Part A has TDS only."
        : "";
    setParseSummary(
      `Matched ${meta.matchedFields.length} field(s): ${meta.matchedFields.join(", ")}.${partBHint}${
        salary > 0 ? ` Gross salary ₹${salary.toLocaleString("en-IN")} filled in Step 2.` : ""
      }`,
    );
    setShowResults(false);
    setTab("upload");
  };

  if (!mounted) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
        Loading calculator…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mode switcher */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "upload"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Upload + Quick entry
          </button>
          <button
            type="button"
            onClick={() => setTab("manual")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "manual"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Full manual form
          </button>
        </div>
        {isMobile && !hasSalary ? (
          <p className="text-sm text-slate-500">
            Upload Part B or enter salary in Step 2.
          </p>
        ) : null}
      </div>

      {/* Step 1 — Upload (always first) */}
      {tab === "upload" ? <Form16Upload onParsed={handleParsed} compact /> : null}

      {/* Parse success banner */}
      {parsedFile ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span className="font-semibold">Extracted from PDF:</span> {parsedFile}
          {parseSummary ? (
            <p className="mt-1 text-emerald-700">{parseSummary}</p>
          ) : null}
        </div>
      ) : null}

      {/* Step 2 — Salary & deductions (upload mode) */}
      {tab === "upload" ? (
        <ExtraInputsPanel
          quick={quickInputs}
          onChange={setQuickInputs}
          prefilledFromPdf={parsedFile !== null && quickInputs.annualGrossSalary > 0}
        />
      ) : null}

      {/* Full manual form */}
      {tab === "manual" ? (
        <>
          <Form16Upload onParsed={handleParsed} compact />
          <ManualForm data={formData} onChange={setFormData} />
        </>
      ) : null}

      {tab === "upload" && showFullForm ? (
        <ManualForm data={formData} onChange={setFormData} />
      ) : null}

      {tab === "upload" ? (
        <div>
          <button
            type="button"
            onClick={() => setShowFullForm((v) => !v)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            {showFullForm ? "Hide" : "Show"} all Form 16 fields
          </button>
        </div>
      ) : null}

      {quickSummary.length > 0 && tab === "upload" ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <span className="font-medium text-slate-900">Applied inputs:</span>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {quickSummary.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Step 3 — Compare */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200/80 bg-[#f8fafc]/95 px-4 py-4 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!hasSalary}
            onClick={() => setShowResults(true)}
            className="min-h-[44px] flex-1 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:flex-none"
          >
            Compare tax regimes
          </button>
          <button
            type="button"
            onClick={() => {
              setFormData(createEmptyForm16());
              setQuickInputs(EMPTY_QUICK_INPUTS);
              setParsedFile(null);
              setParseSummary(null);
              setShowResults(false);
              setShowFullForm(false);
            }}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
        {!hasSalary ? (
          <p className="mt-2 text-center text-sm text-slate-500 sm:text-left">
            Upload Part B or enter <strong>annual gross salary</strong> to calculate for{" "}
            {FY_LABEL}.
          </p>
        ) : null}
      </div>

      {result ? <TaxComparison result={result} /> : null}
    </div>
  );
}
