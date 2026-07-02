"use client";

import { useState } from "react";
import { parseForm16Pdf, isPdfFile } from "@/lib/form16/pdf";
import {
  clearParseLogs,
  formatParseLogSummary,
  getParseLogs,
  parseLog,
} from "@/lib/form16/parseLog";
import type { Form16Data } from "@/lib/tax/types";
import { formatErrorForDisplay, isDebugMode } from "@/lib/utils/debug";

interface Form16UploadProps {
  onParsed: (
    partial: Partial<Form16Data>,
    fileName: string,
    meta: { matchedFields: string[]; lineCount: number; usedOcr?: boolean },
  ) => void;
  compact?: boolean;
}

export function Form16Upload({ onParsed, compact = false }: Form16UploadProps) {
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
    clearParseLogs();

    try {
      const merged: Partial<Form16Data> = {};
      const allMatched = new Set<string>();
      let totalLines = 0;
      let totalChars = 0;
      let usedOcr = false;
      const names: string[] = [];
      let textPreview = "";

      for (const file of Array.from(files)) {
        if (!isPdfFile(file)) {
          throw new Error(
            `"${file.name}" does not look like a PDF. On mobile, ensure the file ends with .pdf`,
          );
        }
        parseLog("upload", "File selected", {
          name: file.name,
          size: file.size,
          type: file.type,
        });
        const parsed = await parseForm16Pdf(file, setProgress);
        Object.assign(merged, parsed.data);
        parsed.matchedFields.forEach((f) => allMatched.add(f));
        totalLines += parsed.lineCount ?? 0;
        totalChars += parsed.charCount ?? 0;
        if (parsed.textPreview) textPreview = parsed.textPreview;
        if (parsed.usedOcr) usedOcr = true;
        names.push(file.name);
      }

      const matchedCount = allMatched.size;
      if (matchedCount === 0) {
        parseLog("upload-fail", "No fields matched after upload", {
          totalChars,
          matchedCount,
        });
        const logs = getParseLogs();
        const done = logs.find((e) => e.stage === "done");
        const charFromLogs =
          (done?.data as { charCount?: number } | undefined)?.charCount ?? totalChars;
        const preview =
          textPreview ||
          (logs.find((e) => e.stage === "post-ocr")?.data as { preview?: string })
            ?.preview ||
          (logs.find((e) => e.stage === "text-layer")?.data as { preview?: string })
            ?.preview ||
          "";
        const logSummary = debug
          ? `\n\n--- parse logs ---\n${JSON.stringify(logs, null, 2)}`
          : `\n\n--- parse summary ---\n${formatParseLogSummary()}`;
        const previewBlock = preview
          ? `\n\n--- text preview ---\n${preview.slice(0, 300)}…`
          : "";
        throw new Error(
          `Read ${Math.max(charFromLogs, totalChars, 0).toLocaleString("en-IN")} characters from PDF but couldn't match Form 16 fields. Enter your annual gross salary below (Part B has salary; Part A is TDS only).${previewBlock}${logSummary}`,
        );
      }

      if (matchedCount < 3) {
        setWarning(
          `Only ${matchedCount} field(s) detected (${[...allMatched].join(", ")}). Review values below.`,
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
    <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white p-5 shadow-sm sm:p-6">
      <div className={compact ? "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" : "mx-auto max-w-2xl text-center"}>
        <div className={compact ? "min-w-0 flex-1" : undefined}>
          <div className={`flex items-center gap-3 ${compact ? "" : "mx-auto mb-3 w-fit"}`}>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-xl">
              📄
            </div>
            <div className={compact ? "text-left" : "text-left sm:text-center"}>
              <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
                Step 1 — Upload Form 16
              </h3>
              <p className="mt-0.5 text-sm text-slate-600">
                Part A (TDS) and/or Part B (salary). Scanned PDFs use OCR automatically.
              </p>
            </div>
          </div>
        </div>

        <label
          className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 ${
            compact ? "" : "mt-4 w-full sm:w-auto"
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Processing…
            </span>
          ) : (
            "Choose PDF file(s)"
          )}
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
      </div>

      {progress ? (
        <p className={`mt-4 text-sm font-medium text-indigo-700 ${compact ? "" : "text-center"}`}>
          {progress}
        </p>
      ) : null}

      {fileNames.length > 0 ? (
        <div className={`mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ${compact ? "" : "text-left"}`}>
          <span className="font-medium">Parsed:</span> {fileNames.join(", ")}
        </div>
      ) : null}

      {warning ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {warning}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-800">
          <p className="font-semibold">Upload failed</p>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words font-sans text-xs">
            {error}
          </pre>
          <p className="mt-2 text-xs text-red-600">
            You can still enter salary manually in Step 2 below.
          </p>
        </div>
      ) : null}

      {debug ? (
        <p className="mt-3 break-all text-xs text-slate-400">
          Debug UA: {typeof navigator !== "undefined" ? navigator.userAgent : ""}
        </p>
      ) : null}
    </section>
  );
}
