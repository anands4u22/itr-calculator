import type { PdfDocument, PdfPage } from "./pdf-types";

export type OcrProgress = (message: string) => void;

const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist";

const TESSERACT_OPTS = {
  workerPath: `${TESSERACT_CDN}/worker.min.js`,
  langPath: "https://tessdata.projectnaptha.com/4.0.0",
  corePath:
    "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js",
};

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

async function renderPageToCanvas(
  page: PdfPage,
  scale: number,
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas is not supported on this device.");

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  // pdf.js 4.x on mobile CDN: canvasContext + viewport (no canvas prop)
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

async function recognizeCanvas(
  canvas: HTMLCanvasElement,
  onProgress?: OcrProgress,
): Promise<string> {
  const { recognize } = await import("tesseract.js");
  const { data } = await recognize(canvas, "eng", {
    ...TESSERACT_OPTS,
    logger: (m) => {
      if (m.status === "loading tesseract core") {
        onProgress?.("Downloading OCR core…");
      } else if (m.status === "loading language traineddata") {
        onProgress?.("Downloading English language data…");
      } else if (m.status === "recognizing text" && m.progress) {
        onProgress?.(`Recognizing text… ${Math.round(m.progress * 100)}%`);
      }
    },
  });
  return data.text?.trim() ?? "";
}

/** OCR scanned/image PDF pages when the text layer is empty or useless. */
export async function ocrPdfDocument(
  pdf: PdfDocument,
  onProgress?: OcrProgress,
): Promise<string> {
  const maxPages = Math.min(pdf.numPages, 4);
  const scale = isMobileBrowser() ? 1.5 : 2.5;
  const parts: string[] = [];

  onProgress?.("Scanning PDF with OCR…");

  for (let i = 1; i <= maxPages; i++) {
    onProgress?.(`OCR page ${i} of ${maxPages}…`);
    const page = await pdf.getPage(i);
    const canvas = await renderPageToCanvas(page, scale);
    const text = await recognizeCanvas(canvas, onProgress);
    if (text) parts.push(text);
  }

  const combined = parts.join("\n").trim();
  if (!combined) {
    throw new Error(
      "OCR could not read text from this scanned PDF. Use Manual entry and enter your annual gross salary below.",
    );
  }
  return combined;
}
