"use client";

import { useState } from "react";
import type { Form16Data } from "@/lib/tax/types";
import { formatErrorForDisplay, isDebugMode } from "@/lib/utils/debug";

interface Form16UploadProps {
  onParsed: (
    partial: Partial<Form16Data>,
    fileName: string,
    meta: { matchedFields: string[]; lineCount: number; usedOcr?: boolean },
  ) => void;
}

export function Form16Upload({ onParsed }: Form16UploadProps) {
  const debug = isDebugMode();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [warning, setWarning] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;

    setLoading(true);
    setProgress("Starting…");
    setError(null);
    setWarning(null);

    try {
      const { parseForm16Pdf, isPdfFile } = await import("@/lib/form16/pdf");
      const merged: Partial<Form16Data> = {};
      const allMatched = new Set<string>();
      let totalLines = 0;
      let totalChars = 0;
      let usedOcr = false;
      const names: string[] = [];

      for (const file of Array.from(files)) {
        if (!isPdfFile(file)) {
          throw new Error(
            `"${file.name}" does not look like a PDF. On mobile, ensure the file ends with .pdf`,
          );
        }
        const parsed = await parseForm16Pdf(file, setProgress);
        Object.assign(merged, parsed.data);
        parsed.matchedFields.forEach((f) => allMatched.add(f));
        totalLines += parsed.lineCount;
        totalChars += parsed.charCount;
        if (parsed.usedOcr) usedOcr = true;
        names.push(file.name);
      }

      const matchedCount = allMatched.size;
      if (matchedCount === 0) {
        throw new Error(
          totalChars > 0
            ? `Read ${totalChars.toLocaleString("en-IN")} characters from PDF but couldn't match Form 16 fields. Enter your annual gross salary in Manual entry below.`
            : "Couldn't match any Form 16 fields. Enter your annual gross salary in Manual entry below.",
        );
      }

      if (matchedCount < 3) {
        setWarning(
          `Only ${matchedCount} field(s) detected (${[...allMatched].join(", ")}). Review and fill the rest below.`,
        );
      }

      if (usedOcr) {
        setWarning(
          (w) =>
            `${w ? `${w} ` : ""}(Used OCR — please verify all numbers.)`,
        );
      }

      setFileNames(names);
      onParsed(merged, names.join(", "), {
        matchedFields: [...allMatched],
        lineCount: totalLines,
        usedOcr,
      });
    } catch (err) {
      console.error("[Form16Upload]", err);
      setError(formatErrorForDisplay(err, debug));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return (
    <div className="rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/40 p-6">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-2xl">
          📄
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Upload Form 16 PDF</h3>
        <p className="mt-2 text-sm text-slate-600">
          Upload Part A and/or Part B (PDF). Scanned PDFs are read with OCR
          automatically.
        </p>

        <label className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
          {loading ? "Processing…" : "Choose PDF file(s)"}
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

        {progress ? (
          <p className="mt-3 text-sm font-medium text-indigo-700">{progress}</p>
        ) : null}

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
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans text-xs">
              {error}
            </pre>
            <p className="mt-2 text-xs text-red-600">
              On mobile, if upload keeps failing, use Manual entry below — all
              fields work without PDF upload.
            </p>
          </div>
        ) : null}

        {debug ? (
          <p className="mt-2 break-all text-xs text-slate-500">
            Debug: {typeof navigator !== "undefined" ? navigator.userAgent : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
