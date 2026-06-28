import { parseForm16Text } from "@/lib/form16/parser";
import type { Form16Data } from "@/lib/tax/types";

/** Pinned — keep in sync with package.json pdfjs-dist version */
const PDFJS_VERSION = "4.8.69";
const PDFJS_CDN_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

interface PositionedText {
  str: string;
  x: number;
  y: number;
}

interface PdfJsLib {
  getDocument: (params: Record<string, unknown>) => { promise: Promise<PdfDocument> };
  GlobalWorkerOptions: { workerSrc: string };
  version?: string;
}

interface PdfDocument {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
}

interface PdfPage {
  getTextContent: (params?: Record<string, unknown>) => Promise<{ items: PdfTextItem[] }>;
}

interface PdfTextItem {
  str?: string;
  transform?: number[];
  hasEOL?: boolean;
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
}

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(
    navigator.userAgent,
  );
}

async function loadPdfJsFromCdn(): Promise<PdfJsLib> {
  if (window.pdfjsLib?.getDocument) {
    return window.pdfjsLib;
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector("script[data-pdfjs-cdn]");
    if (existing) {
      const check = () =>
        window.pdfjsLib?.getDocument ? resolve() : reject(new Error("PDF.js CDN unavailable"));
      existing.addEventListener("load", () => setTimeout(check, 50));
      if (window.pdfjsLib?.getDocument) resolve();
      return;
    }

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

  const lib = window.pdfjsLib!;
  lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_BASE}/pdf.worker.min.js`;
  return lib;
}

async function loadPdfJsFromBundle(): Promise<PdfJsLib> {
  const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const lib = (mod as { default?: PdfJsLib }).default ?? (mod as PdfJsLib);

  if (!lib?.getDocument) {
    throw new Error("Bundled PDF.js missing getDocument export.");
  }

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

  // Mobile: main-thread parsing often extracts text more reliably
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
  if (typeof item.str === "string") return item.str;
  return "";
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

/** Split one long mobile PDF string into pseudo-lines for the parser */
function splitFlatIntoLines(flat: string): string[] {
  const markers = [
    "17(1)",
    "17 (1)",
    "17(2)",
    "17 (2)",
    "17(3)",
    "Gross Salary",
    "Section 10",
    "Section 16",
    "Chapter VI",
    "80C",
    "80CCD",
    "80D",
    "80G",
    "Professional Tax",
    "House Rent",
    "tax deducted",
    "TDS",
    "Form 16",
  ];

  let text = flat;
  for (const marker of markers) {
    text = text.replace(new RegExp(`(${marker})`, "gi"), "\n$1");
  }

  return text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function extractPageContent(pdf: PdfDocument, pageNum: number) {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent({
    normalizeWhitespace: true,
    disableCombineTextItems: false,
  });
  return content.items;
}

export async function extractTextFromPdf(file: File): Promise<PdfExtractResult> {
  const pdfjs = await getPdfJs();
  const buffer = await file.arrayBuffer();

  if (buffer.byteLength === 0) {
    throw new Error("The selected file is empty.");
  }

  const pdf = await openPdfDocument(pdfjs, buffer);
  const positionedLines: string[] = [];
  const flatParts: string[] = [];
  let textItemCount = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    const items = await extractPageContent(pdf, i);
    textItemCount += items.length;

    const flatPage = joinItemsFlat(items);
    if (flatPage) flatParts.push(flatPage);

    const positioned: PositionedText[] = [];
    for (const item of items) {
      const str = getItemText(item);
      if (!str.trim()) continue;
      const transform = item.transform;
      positioned.push({
        str,
        x: transform && transform.length >= 5 ? (transform[4] ?? 0) : 0,
        y: transform && transform.length >= 6 ? (transform[5] ?? 0) : 0,
      });
    }

    positionedLines.push(...groupIntoLines(positioned));
  }

  const rawText = flatParts.join("\n");
  let lines = positionedLines.filter(Boolean);

  if (lines.length === 0 && rawText) {
    lines = splitFlatIntoLines(rawText);
  }

  if (lines.length === 0 && rawText) {
    lines = [rawText];
  }

  return {
    lines,
    rawText,
    pageCount: pdf.numPages,
    textItemCount,
  };
}

export async function extractLinesFromPdf(file: File): Promise<string[]> {
  const result = await extractTextFromPdf(file);
  return result.lines;
}

export async function parseForm16Pdf(file: File): Promise<{
  data: Partial<Form16Data>;
  matchedFields: string[];
  lineCount: number;
  charCount: number;
  pageCount: number;
}> {
  const extracted = await extractTextFromPdf(file);
  const text = extracted.lines.join("\n") || extracted.rawText;

  if (!text.trim()) {
    if (extracted.pageCount > 0 && extracted.textItemCount === 0) {
      throw new Error(
        "This PDF appears to be a scanned image with no readable text. Please use Manual entry, or ask your employer for a text-based Form 16 PDF.",
      );
    }
    throw new Error(
      "Could not read any text from this PDF on your device. Please use Manual entry below.",
    );
  }

  const result = parseForm16Text(text);

  return {
    data: result.data,
    matchedFields: result.matchedFields,
    lineCount: extracted.lines.length,
    charCount: text.length,
    pageCount: extracted.pageCount,
  };
}

export function isPdfFile(file: File): boolean {
  if (file.type === "application/pdf") return true;
  return file.name.toLowerCase().endsWith(".pdf");
}
