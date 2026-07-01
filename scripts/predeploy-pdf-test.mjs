#!/usr/bin/env node
/**
 * Pre-deploy check: verify Form 16 PDF fixtures exist, then run Playwright mobile tests.
 * Usage: npm run test:pdf
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FORM16_FIXTURE_NAMES = [
  "BMTPA5412J Subramaniam Anand - Form-16 FY 2024-25 PART-A (1).pdf",
  "BMTPA5412J Subramaniam Anand - Form-16 FY 2024-25 PART-B (1).pdf",
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const downloads = process.env.FORM16_PDF_DIR ?? path.join(os.homedir(), "Downloads");

function resolveFixture(name) {
  const candidates = [
    path.join(downloads, name),
    path.join(downloads, name.replace(/\.pdf$/i, "")),
    path.join(downloads, `${name.replace(/\.pdf$/i, "")}.PDF`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`Not found: ${name} in ${downloads}`);
}

console.log("Form 16 pre-deploy PDF tests");
console.log("PDF folder:", downloads);
console.log("");

let missing = false;
for (const name of FORM16_FIXTURE_NAMES) {
  try {
    const p = resolveFixture(name);
    const stat = fs.statSync(p);
    console.log(`  OK  ${name} (${(stat.size / 1024).toFixed(0)} KB)`);
  } catch {
    console.error(`  MISSING  ${name}`);
    missing = true;
  }
}

if (missing) {
  console.error(
    "\nPlace the two Form 16 PDFs in Downloads, or set FORM16_PDF_DIR to their folder.",
  );
  process.exit(1);
}

console.log("\nCopying PDF.js worker to public/…");
spawnSync("node", ["scripts/copy-pdf-worker.mjs"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

console.log("\nRunning Playwright (mobile Chrome — Pixel 7)…\n");

const result = spawnSync(
  "npx",
  ["playwright", "test", "tests/e2e/form16-direct.spec.ts", "--project=mobile-chrome"],
  {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, NEXT_PUBLIC_PARSE_DEBUG: "1" },
  },
);

if (result.status !== 0) {
  console.error("\nTests failed. Open tests/output/*.json for parse logs.");
  process.exit(result.status ?? 1);
}

console.log("\nAll PDF tests passed. Reports saved to tests/output/");
