"use client";

import { useEffect, useState } from "react";
import type { Form16Data } from "@/lib/tax/types";

interface Form16UploadProps {
  onParsed: (
    partial: Partial<Form16Data>,
    fileName: string,
    meta: { matchedFields: string[]; lineCount: number },
  ) => void;
}

export function Form16Upload({ onParsed }: Form16UploadProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [warning, setWarning] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;

    setLoading(true);
    setError(null);
    setWarning(null);

    try {
      const merged: Partial<Form16Data> = {};
      const allMatched = new Set<string>();
      let totalLines = 0;
      const names: string[] = [];

      for (const file of Array.from(files)) {
        if (file.type !== "application/pdf") {
          throw new Error("Please upload PDF files only.");
        }
        const { parseForm16Pdf } = await import("@/lib/form16/pdf");
        const parsed = await parseForm16Pdf(file);
        Object.assign(merged, parsed.data);
        parsed.matchedFields.forEach((f) => allMatched.add(f));
        totalLines += parsed.lineCount;
        names.push(file.name);
      }

      const matchedCount = Object.values(merged).filter((v) => v !== 0).length;
      if (matchedCount === 0) {
        throw new Error(
          `Read ${totalLines} lines from PDF but couldn't match Form 16 fields. Please enter values manually — your employer's PDF layout may differ.`,
        );
      }

      if (matchedCount < 3) {
        setWarning(
          `Only ${matchedCount} field(s) detected (${[...allMatched].join(", ")}). Please review and fill in the rest manually.`,
        );
      }

      setFileNames(names);
      onParsed(merged, names.join(", "), {
        matchedFields: [...allMatched],
        lineCount: totalLines,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse PDF.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/40 p-6">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-2xl">
          📄
        </div>
        <h3 className="text-lg font-semibold text-slate-900">
          Upload Form 16 Part A &amp; Part B
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Upload one combined PDF or separate Part A and Part B files. We&apos;ll
          extract salary, deductions, and TDS automatically.
        </p>

        <label className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700">
          {loading ? "Parsing PDF..." : "Choose PDF file(s)"}
          <input
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            disabled={loading}
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {fileNames.length > 0 ? (
          <p className="mt-3 text-xs text-emerald-700">
            Parsed: {fileNames.join(", ")}
          </p>
        ) : null}

        {warning ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {warning}
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <p className="mt-4 text-xs text-slate-500">
          PDF parsing depends on your employer&apos;s format. Review extracted
          values in the form below and edit anything that looks off.
        </p>
      </div>
    </div>
  );
}
