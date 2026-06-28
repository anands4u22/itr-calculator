"use client";

import { useState } from "react";
import type { Form16Data } from "@/lib/tax/types";

interface Form16UploadProps {
  onParsed: (
    partial: Partial<Form16Data>,
    fileName: string,
    meta: { matchedFields: string[]; lineCount: number },
  ) => void;
}

function formatUploadError(err: unknown): string {
  if (err instanceof Error) {
    return err.message || err.name || "Unknown error";
  }
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Failed to parse PDF on this device.";
  }
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
      const { parseForm16Pdf, isPdfFile } = await import("@/lib/form16/pdf");
      const merged: Partial<Form16Data> = {};
      const allMatched = new Set<string>();
      let totalLines = 0;
      const names: string[] = [];

      for (const file of Array.from(files)) {
        if (!isPdfFile(file)) {
          throw new Error(
            `"${file.name}" does not look like a PDF. On mobile, ensure the file ends with .pdf`,
          );
        }
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
      console.error("[Form16Upload]", err);
      setError(formatUploadError(err));
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
            accept="application/pdf,.pdf"
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
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-left text-sm text-red-700">
            <p className="font-semibold">Upload failed</p>
            <p className="mt-1 break-words">{error}</p>
            <p className="mt-2 text-xs text-red-600">
              On mobile, if upload keeps failing, use Manual entry below — all
              fields work without PDF upload.
            </p>
          </div>
        ) : null}

        <p className="mt-4 text-xs text-slate-500">
          PDF parsing depends on your employer&apos;s format. Review extracted
          values in the form below and edit anything that looks off.
        </p>
      </div>
    </div>
  );
}
