import type { PdfDocument, PdfPage } from "./pdf-types";

export type OcrProgress = (message: string) => void;

const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist";

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

async function createOcrWorker(onProgress?: OcrProgress) {
  const { createWorker } = await import("tesseract.js");

  onProgress?.("Loading OCR engine…");

  return createWorker("eng", 1, {
    workerPath: `${TESSERACT_CDN}/worker.min.js`,
    langPath: "https://tessdata.projectnaptha.com/4.0.0",
    corePath:
      "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js",
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

  await page.render({ canvasContext: context, viewport, canvas }).promise;
  return canvas;
}

/** OCR scanned/image PDF pages when the text layer is empty. */
export async function ocrPdfDocument(
  pdf: PdfDocument,
  onProgress?: OcrProgress,
): Promise<string> {
  const maxPages = Math.min(pdf.numPages, 4);
  const scale = isMobileBrowser() ? 1.75 : 2.5;
  const parts: string[] = [];

  onProgress?.("No text layer — scanning PDF with OCR…");
  const worker = await createOcrWorker(onProgress);

  try {
    for (let i = 1; i <= maxPages; i++) {
      onProgress?.(`Scanning page ${i} of ${maxPages}…`);
      const page = await pdf.getPage(i);
      const canvas = await renderPageToCanvas(page, scale);
      const { data } = await worker.recognize(canvas);
      if (data.text?.trim()) parts.push(data.text);
    }
  } finally {
    await worker.terminate();
  }

  const combined = parts.join("\n").trim();
  if (!combined) {
    throw new Error(
      "OCR could not read text from this scanned PDF. Use Manual entry and enter your annual gross salary below.",
    );
  }
  return combined;
}
