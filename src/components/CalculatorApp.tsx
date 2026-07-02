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
      <div className="rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/40 p-6 text-center text-sm text-slate-600">
        Loading PDF upload...
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
      `Matched ${meta.matchedFields.length} field(s) from ${meta.lineCount} PDF lines: ${meta.matchedFields.join(", ")}.${partBHint}${
        salary > 0 ? ` Gross salary ₹${salary.toLocaleString("en-IN")} filled in below.` : ""
      }`,
    );
    setShowResults(false);
    if (salary > 0) setTab("upload");
  };

  if (!mounted) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
        Loading calculator...
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "upload"
              ? "bg-indigo-600 text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Upload PDF
        </button>
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "manual"
              ? "bg-indigo-600 text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Manual entry
        </button>
      </div>

      <div className="space-y-6">
        {isMobile && !hasSalary ? (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            <strong>On mobile:</strong> Upload Form 16 Part B or enter your{" "}
            <strong>annual gross salary</strong> below.
          </div>
        ) : null}

        <ExtraInputsPanel
          quick={quickInputs}
          onChange={setQuickInputs}
          prefilledFromPdf={parsedFile !== null && quickInputs.annualGrossSalary > 0}
        />

        {tab === "upload" ? <Form16Upload onParsed={handleParsed} /> : null}

        {parsedFile ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Values extracted from <strong>{parsedFile}</strong>.
            {parseSummary ? (
              <>
                <br />
                <span className="text-emerald-700">{parseSummary}</span>
              </>
            ) : null}{" "}
            Add NPS / HRA / 80G above if missing, then calculate.
          </div>
        ) : null}

        {quickSummary.length > 0 ? (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            <strong>Applied from quick inputs:</strong>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {quickSummary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <button
            type="button"
            onClick={() => setShowFullForm((v) => !v)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            {showFullForm ? "Hide" : "Show"} full Form 16 fields
          </button>
        </div>

        {showFullForm || tab === "manual" ? (
          <ManualForm data={formData} onChange={setFormData} />
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!hasSalary}
            onClick={() => setShowResults(true)}
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
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
            className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Reset
          </button>
        </div>

        {!hasSalary ? (
          <p className="text-sm text-slate-500">
            Upload Form 16 Part B or enter <strong>annual gross salary</strong>{" "}
            above to calculate tax for {FY_LABEL}.
          </p>
        ) : null}

        {result ? <TaxComparison result={result} /> : null}
      </div>
    </>
  );
}
