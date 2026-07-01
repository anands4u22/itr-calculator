#!/usr/bin/env node
/** Copy pdf.js worker to public/ so it loads same-origin (works in Playwright + mobile). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(
  root,
  "node_modules",
  "pdfjs-dist",
  "legacy",
  "build",
  "pdf.worker.min.mjs",
);
const dest = path.join(root, "public", "pdf.worker.min.mjs");

if (!fs.existsSync(src)) {
  console.warn("copy-pdf-worker: pdfjs-dist not installed yet, skipping");
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log("Copied pdf.worker.min.mjs → public/");
