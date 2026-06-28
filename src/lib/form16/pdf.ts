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
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
}

interface PdfTextItem {
  str?: string;
  transform?: number[];
}

declare global {
  interface Window {
    pdfjsLib?: PdfJsLib;
  }
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
    const existing = document.querySelector(`script[data-pdfjs-cdn]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("PDF.js CDN script failed")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = `${PDFJS_CDN_BASE}/pdf.min.js`;
    script.async = true;
    script.dataset.pdfjsCdn = "true";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Could not load PDF library on this device."));
    document.head.appendChild(script);
  });

  const lib = window.pdfjsLib;
  if (!lib?.getDocument) {
    throw new Error("PDF.js loaded but getDocument is unavailable.");
  }

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

  // Mobile Safari handles the CDN script + .js worker more reliably than bundled .mjs
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
    }).promise;

  try {
    return await tryOpen(false);
  } catch (workerError) {
    try {
      return await tryOpen(true);
    } catch {
      const msg =
        workerError instanceof Error ? workerError.message : "Unknown error";
      throw new Error(`Could not read PDF (${msg}). Try manual entry.`);
    }
  }
}

function groupIntoLines(items: PositionedText[]): string[] {
  if (items.length === 0) return [];

  const rowTolerance = 3;
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

export async function extractLinesFromPdf(file: File): Promise<string[]> {
  const pdfjs = await getPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await openPdfDocument(pdfjs, buffer);
  const allLines: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const positioned: PositionedText[] = [];

    for (const item of content.items) {
      const str = item.str ?? "";
      if (!str.trim()) continue;
      const transform = item.transform;
      if (!transform || transform.length < 6) continue;
      positioned.push({
        str,
        x: transform[4] ?? 0,
        y: transform[5] ?? 0,
      });
    }

    allLines.push(...groupIntoLines(positioned));
  }

  return allLines;
}

export async function parseForm16Pdf(file: File): Promise<{
  data: Partial<Form16Data>;
  matchedFields: string[];
  lineCount: number;
}> {
  const lines = await extractLinesFromPdf(file);
  const text = lines.join("\n");

  if (!text.trim()) {
    throw new Error(
      "This PDF has no readable text. It may be a scanned image — use manual entry instead.",
    );
  }

  const result = parseForm16Text(text);
  return {
    data: result.data,
    matchedFields: result.matchedFields,
    lineCount: lines.length,
  };
}

export function isPdfFile(file: File): boolean {
  if (file.type === "application/pdf") return true;
  return file.name.toLowerCase().endsWith(".pdf");
}
