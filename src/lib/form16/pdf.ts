import { parseForm16Text } from "@/lib/form16/parser";
import type { Form16Data } from "@/lib/tax/types";

interface PositionedText {
  str: string;
  x: number;
  y: number;
}

async function getPdfJs() {
  if (typeof window === "undefined") {
    throw new Error("PDF parsing is only available in the browser.");
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
  return pdfjs;
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

  return [...rows.entries()]
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
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const allLines: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const positioned: PositionedText[] = [];

    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const transform = item.transform;
      positioned.push({
        str: item.str,
        x: transform[4],
        y: transform[5],
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
