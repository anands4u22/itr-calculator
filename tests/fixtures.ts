import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Form 16 PDFs in ~/Downloads used for local pre-deploy tests */
export const FORM16_FIXTURE_NAMES = [
  "BMTPA5412J Subramaniam Anand - Form-16 FY 2024-25 PART-A (1).pdf",
  "BMTPA5412J Subramaniam Anand - Form-16 FY 2024-25 PART-B (1).pdf",
] as const;

export function getDownloadsDir(): string {
  return path.join(os.homedir(), "Downloads");
}

/** Resolve a fixture by name — tries exact name and without .pdf extension variants */
export function resolveForm16Fixture(name: string): string {
  const downloads = getDownloadsDir();
  const candidates = [
    path.join(downloads, name),
    path.join(downloads, name.replace(/\.pdf$/i, "")),
    path.join(downloads, `${name.replace(/\.pdf$/i, "")}.PDF`),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(
    `Form 16 fixture not found: ${name}\nLooked in ${downloads}\n` +
      `Copy your PDFs to Downloads or set FORM16_PDF_DIR env var.`,
  );
}

export function resolveAllForm16Fixtures(): string[] {
  const dir = process.env.FORM16_PDF_DIR ?? getDownloadsDir();
  if (process.env.FORM16_PDF_DIR) {
    return FORM16_FIXTURE_NAMES.map((name) => {
      const p = path.join(dir, name);
      if (!fs.existsSync(p)) throw new Error(`Missing ${p}`);
      return p;
    });
  }
  return FORM16_FIXTURE_NAMES.map(resolveForm16Fixture);
}

export function fixtureExists(name: string): boolean {
  try {
    resolveForm16Fixture(name);
    return true;
  } catch {
    return false;
  }
}
