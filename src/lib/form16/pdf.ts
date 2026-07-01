import { parseForm16Text } from "@/lib/form16/parser";
import { parseLog } from "@/lib/form16/parseLog";
import type {
  PdfDocument,
  PdfJsLib,
  PdfPage,
  PdfTextItem,
} from "@/lib/form16/pdf-types";
import type { Form16Data } from "@/lib/tax/types";

export type { PdfDocument, PdfPage } from "@/lib/form16/pdf-types";

const PDFJS_VERSION = "4.8.69";
/** Same-origin worker — copied to public/ by scripts/copy-pdf-worker.mjs */
const PDFJS_WORKER_SRC = "/pdf.worker.min.mjs";

interface PositionedText {
  str: string;
  x: number;
  y: number;
}

declare global {
  interface Window {
    pdfjsLib?: PdfJsLib;
  }
}

export interface PdfExtractResult {
  lines: string[];
  rawText: string;
  pageCount: number;
  textItemCount: number;
  usedOcr: boolean;
}

export type PdfProgressCallback = (message: string) => void;

export function isPdfFile(file: File): boolean {
  if (file.type === "application/pdf") return true;
  return file.name.toLowerCase().endsWith(".pdf");
}

async function loadPdfJsFromBundle(): Promise<PdfJsLib> {
  const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const lib = ((mod as { default?: unknown }).default ?? mod) as PdfJsLib;
  if (!lib?.getDocument) throw new Error("Bundled PDF.js missing getDocument.");
  lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
  return lib;
}

async function getPdfJs(): Promise<PdfJsLib> {
  if (typeof window === "undefined") {
    throw new Error("PDF parsing is only available in the browser.");
  }
  parseLog("pdfjs", "Loading bundled PDF.js", { worker: PDFJS_WORKER_SRC });
  return loadPdfJsFromBundle();
}

async function openPdfDocument(
  pdfjs: PdfJsLib,
  buffer: ArrayBuffer,
): Promise<PdfDocument> {
  const data = new Uint8Array(buffer);
  /** Main-thread parsing — avoids CDN worker fetch (broken on mobile / Playwright) */
  parseLog("pdf-open", "Opening PDF (disableWorker=true)");
  try {
    return await pdfjs.getDocument({
      data,
      disableWorker: true,
      useWorkerFetch: false,
      isEvalSupported: false,
      verbosity: 0,
    }).promise;
  } catch (err) {
    parseLog("pdf-open", "Main-thread open failed, retrying with worker", {
      error: err instanceof Error ? err.message : String(err),
    });
    return pdfjs.getDocument({
      data,
      disableWorker: false,
      useWorkerFetch: false,
      isEvalSupported: false,
      verbosity: 0,
    }).promise;
  }
}

function getItemText(item: PdfTextItem): string {
  return typeof item.str === "string" ? item.str : "";
}

function groupIntoLines(items: PositionedText[]): string[] {
  if (items.length === 0) return [];
  const rowTolerance = 4;
  const rows = new Map<number, PositionedText[]>();

  for (const item of items) {
    if (!item.str.trim()) continue;
    const rowKey = Math.round(item.y / rowTolerance) * rowTolerance;
    const row = rows.get(rowKey) ?? [];
    row.push(item);
    rows.set(rowKey, row);
  }

  return Array.from(rows.entries())
    .sort(([a], [b]) => b - a)
    .map(([, rowItems]) =>
      rowItems
        .sort((a, b) => a.x - b.x)
        .map((item) => item.str.trim())
        .filter(Boolean)
        .join("  "),
    )
    .filter(Boolean);
}

function joinItemsFlat(items: PdfTextItem[]): string {
  const parts: string[] = [];
  for (const item of items) {
    const str = getItemText(item);
    if (!str) continue;
    parts.push(str);
    if (item.hasEOL) parts.push("\n");
    else parts.push(" ");
  }
  return parts.join("").replace(/\s+/g, " ").trim();
}

function splitFlatIntoLines(flat: string): string[] {
  const markers = [
    "17(1)", "17 (1)", "17(2)", "Gross Salary", "80C", "80CCD",
    "80D", "80G", "Professional Tax", "House Rent", "tax deducted", "Form 16",
  ];
  let text = flat;
  for (const marker of markers) {
    text = text.replace(new RegExp(`(${marker})`, "gi"), "\n$1");
  }
  return text.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function textFromRaw(rawText: string, lines: string[]): string {
  return lines.join("\n") || rawText;
}

/** Scanned PDFs often have a junk metadata text layer — treat as empty. */
function hasMeaningfulForm16Text(rawText: string, lines: string[]): boolean {
  const text = textFromRaw(rawText, lines).trim();
  if (text.length < 50) return false;
  const digits = text.replace(/\D/g, "");
  if (digits.length < 10) return false;
  return /form\s*16|17\s*[\(\[]?\s*1|gross\s*salary|80\s*c|chapter\s*vi|assessment\s*year|tax\s*deduct|part\s*[ab]/i.test(
    text,
  );
}

async function tryOcrExtract(
  pdf: PdfDocument,
  onProgress?: PdfProgressCallback,
): Promise<PdfExtractResult> {
  onProgress?.("Scanning PDF with OCR…");
  parseLog("ocr", "Starting OCR", { pages: pdf.numPages });
  const { ocrPdfDocument } = await import("@/lib/form16/ocr");
  const ocrText = await ocrPdfDocument(pdf, onProgress);
  parseLog("ocr", "OCR complete", {
    charCount: ocrText.length,
    preview: ocrText.slice(0, 200),
  });
  return buildExtractResult(
    ocrText,
    splitFlatIntoLines(ocrText),
    pdf.numPages,
    1,
    true,
  );
}

function buildExtractResult(
  rawText: string,
  lines: string[],
  pageCount: number,
  textItemCount: number,
  usedOcr: boolean,
): PdfExtractResult {
  let finalLines = lines.filter(Boolean);
  if (finalLines.length === 0 && rawText.trim()) {
    finalLines = splitFlatIntoLines(rawText);
  }
  if (finalLines.length === 0 && rawText.trim()) {
    finalLines = [rawText];
  }
  return {
    lines: finalLines,
    rawText,
    pageCount,
    textItemCount,
    usedOcr,
  };
}

async function extractTextFromPdfPages(
  pdf: PdfDocument,
  onProgress?: PdfProgressCallback,
): Promise<Omit<PdfExtractResult, "usedOcr">> {
  const positionedLines: string[] = [];
  const flatParts: string[] = [];
  let textItemCount = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(`Reading page ${i} of ${pdf.numPages}…`);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent({ normalizeWhitespace: true });
    const items = content.items;
    textItemCount += items.length;

    const flatPage = joinItemsFlat(items);
    if (flatPage) flatParts.push(flatPage);

    const positioned: PositionedText[] = [];
    for (const item of items) {
      const str = getItemText(item);
      if (!str.trim()) continue;
      const t = item.transform;
      positioned.push({
        str,
        x: t && t.length >= 5 ? (t[4] ?? 0) : 0,
        y: t && t.length >= 6 ? (t[5] ?? 0) : 0,
      });
    }
    positionedLines.push(...groupIntoLines(positioned));
  }

  const rawText = flatParts.join("\n");
  return buildExtractResult(
    rawText,
    positionedLines,
    pdf.numPages,
    textItemCount,
    false,
  );
}

export async function extractTextFromPdf(
  file: File,
  onProgress?: PdfProgressCallback,
): Promise<PdfExtractResult> {
  const pdfjs = await getPdfJs();
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength === 0) throw new Error("The selected file is empty.");

  onProgress?.("Opening PDF…");
  const pdf = await openPdfDocument(pdfjs, buffer);
  let result = await extractTextFromPdfPages(pdf, onProgress);

  const needsOcr = !hasMeaningfulForm16Text(result.rawText, result.lines);
  if (needsOcr) {
    try {
      result = await tryOcrExtract(pdf, onProgress);
    } catch (ocrErr) {
      const detail =
        ocrErr instanceof Error ? ocrErr.message : "OCR failed on this device.";
      throw new Error(
        `Could not read this PDF (scanned image). ${detail} Use Manual entry and enter your annual gross salary below.`,
      );
    }
  }

  return { ...result, usedOcr: needsOcr };
}

export async function parseForm16Pdf(
  file: File,
  onProgress?: PdfProgressCallback,
): Promise<{
  data: Partial<Form16Data>;
  matchedFields: string[];
  lineCount: number;
  charCount: number;
  pageCount: number;
  usedOcr: boolean;
  textPreview?: string;
}> {
  parseLog("start", `Parsing ${file.name}`, {
    size: file.size,
    type: file.type,
  });

  const pdfjs = await getPdfJs();
  const buffer = await file.arrayBuffer();
  parseLog("file", "Read file buffer", {
    fileName: file.name,
    fileSize: file.size,
    byteLength: buffer.byteLength,
  });
  if (buffer.byteLength === 0) {
    throw new Error(
      `File "${file.name}" is empty (0 bytes). Re-download the PDF and try again.`,
    );
  }

  onProgress?.("Opening PDF…");
  const pdf = await openPdfDocument(pdfjs, buffer);
  parseLog("pdf-open", "PDF opened", { numPages: pdf.numPages });
  let extracted = await extractTextFromPdfPages(pdf, onProgress);
  let usedOcr = false;

  let text = textFromRaw(extracted.rawText, extracted.lines);
  let parsed = parseForm16Text(text, file.name);

  parseLog("text-layer", "Extracted text layer", {
    charCount: text.length,
    lineCount: extracted.lines.length,
    textItemCount: extracted.textItemCount,
    meaningful: hasMeaningfulForm16Text(extracted.rawText, extracted.lines),
    matchedFields: parsed.matchedFields,
    preview: text.slice(0, 200),
  });

  const needsOcr =
    !text.trim() ||
    parsed.matchedFields.length === 0 ||
    !hasMeaningfulForm16Text(extracted.rawText, extracted.lines);

  if (needsOcr) {
    parseLog("decision", "OCR required", {
      emptyText: !text.trim(),
      zeroMatches: parsed.matchedFields.length === 0,
    });
    try {
      extracted = await tryOcrExtract(pdf, onProgress);
      usedOcr = true;
      text = textFromRaw(extracted.rawText, extracted.lines);
      parsed = parseForm16Text(text, file.name);
      parseLog("post-ocr", "Parsed after OCR", {
        charCount: text.length,
        matchedFields: parsed.matchedFields,
        data: parsed.data,
        preview: text.slice(0, 200),
      });
    } catch (ocrErr) {
      parseLog("ocr-error", "OCR failed", {
        error: ocrErr instanceof Error ? ocrErr.message : String(ocrErr),
      });
      if (!text.trim()) {
        const detail =
          ocrErr instanceof Error ? ocrErr.message : "OCR failed on this device.";
        throw new Error(
          `Could not read this PDF (scanned image). ${detail} Use Manual entry and enter your annual gross salary below.`,
        );
      }
    }
  }

  if (!text.trim()) {
    throw new Error(
      "Could not read text from this PDF on your phone. It may be a scanned image — use Manual entry, or open the PDF on desktop and re-save as PDF (not photo).",
    );
  }

  parseLog("done", "Parse complete", {
    matchedFields: parsed.matchedFields,
    data: parsed.data,
    usedOcr,
    charCount: text.length,
  });

  return {
    data: parsed.data,
    matchedFields: parsed.matchedFields,
    lineCount: extracted.lines.length,
    charCount: Math.max(text.length, extracted.rawText.length),
    pageCount: extracted.pageCount,
    usedOcr,
    textPreview: text.slice(0, 400) || extracted.rawText.slice(0, 400),
  };
}
