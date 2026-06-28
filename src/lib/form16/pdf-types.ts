/** Minimal PDF.js shapes — avoids conflicting with pdfjs-dist internal types */

export interface PdfTextItem {
  str?: string;
  transform?: number[];
  hasEOL?: boolean;
}

export interface PdfJsLib {
  getDocument: (params: Record<string, unknown>) => {
    promise: Promise<PdfDocument>;
  };
  GlobalWorkerOptions: { workerSrc: string };
  version?: string;
}

export interface PdfDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
}

export interface PdfPage {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  getTextContent: (
    params?: Record<string, unknown>,
  ) => Promise<{ items: PdfTextItem[] }>;
  render: (params: Record<string, unknown>) => { promise: Promise<void> };
}
