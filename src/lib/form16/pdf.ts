import { parseForm16Text } from "@/lib/form16/parser";
import { ocrPdfDocument } from "@/lib/form16/ocr";
import type {
  PdfDocument,
  PdfJsLib,
  PdfPage,
  PdfTextItem,
} from "@/lib/form16/pdf-types";
import type { Form16Data } from "@/lib/tax/types";

export type { PdfDocument, PdfPage } from "@/lib/form16/pdf-types";

const PDFJS_VERSION = "4.8.69";
const PDFJS_CDN_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

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

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(
    navigator.userAgent,
  );
}

export function isPdfFile(file: File): boolean {
  if (file.type === "application/pdf") return true;
  return file.name.toLowerCase().endsWith(".pdf");
}

async function loadPdfJsFromCdn(): Promise<PdfJsLib> {
  if (window.pdfjsLib?.getDocument) return window.pdfjsLib;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${PDFJS_CDN_BASE}/pdf.min.js`;
    script.async = true;
    script.dataset.pdfjsCdn = "true";
    script.onload = () => {
      setTimeout(() => {
        if (window.pdfjsLib?.getDocument) resolve();
        else reject(new Error("PDF.js CDN loaded but library missing."));
      }, 50);
    };
    script.onerror = () =>
      reject(new Error("Could not load PDF library on this device."));
    document.head.appendChild(script);
  });

  const lib = window.pdfjsLib as PdfJsLib;
  lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_BASE}/pdf.worker.min.js`;
  return lib;
}

async function loadPdfJsFromBundle(): Promise<PdfJsLib> {
  const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const lib = ((mod as { default?: unknown }).default ?? mod) as PdfJsLib;
  if (!lib?.getDocument) throw new Error("Bundled PDF.js missing getDocument.");
  lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_BASE}/pdf.worker.min.js`;
  return lib;
}

async function getPdfJs(): Promise<PdfJsLib> {
  if (typeof window === "undefined") {
    throw new Error("PDF parsing is only available in the browser.");
  }
  if (isMobileBrowser()) {
    try {
      return await loadPdfJsFromCdn();
    } catch {
      return loadPdfJsFromBundle();
    }
  }
  try {
    return await loadPdfJsFromBundle();
  } catch {
    return loadPdfJsFromCdn();
  }
}

async function openPdfDocument(
  pdfjs: PdfJsLib,
  buffer: ArrayBuffer,
): Promise<PdfDocument> {
  const data = new Uint8Array(buffer);
  const tryOpen = (disableWorker: boolean) =>
    pdfjs.getDocument({
      data,
      disableWorker,
      useWorkerFetch: false,
      isEvalSupported: false,
      verbosity: 0,
    }).promise;

  if (isMobileBrowser()) {
    try {
      return await tryOpen(true);
    } catch {
      return tryOpen(false);
    }
  }
  try {
    return await tryOpen(false);
  } catch {
    return tryOpen(true);
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

  const needsOcr = !result.rawText.trim();
  if (needsOcr) {
    const ocrText = await ocrPdfDocument(pdf, onProgress);
    result = buildExtractResult(
      ocrText,
      splitFlatIntoLines(ocrText),
      pdf.numPages,
      1,
      true,
    );
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
}> {
  const extracted = await extractTextFromPdf(file, onProgress);
  const text = textFromRaw(extracted.rawText, extracted.lines);

  if (!text.trim()) {
    throw new Error(
      "Could not read text from this PDF. It may be a scanned image — use Manual entry, or open the PDF on desktop and re-save as PDF (not photo).",
    );
  }

  const result = parseForm16Text(text);
  return {
    data: result.data,
    matchedFields: result.matchedFields,
    lineCount: extracted.lines.length,
    charCount: text.length,
    pageCount: extracted.pageCount,
    usedOcr: extracted.usedOcr,
  };
}
