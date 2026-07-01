import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  FORM16_FIXTURE_NAMES,
  resolveAllForm16Fixtures,
  resolveForm16Fixture,
} from "../fixtures";

const OUTPUT_DIR = path.join(process.cwd(), "tests", "output");

function safeReportName(project: string, label: string): string {
  const base = label.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  return `${project}-${base}.json`;
}

function writeReport(fileName: string, report: unknown): string {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const reportFile = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n--- Report: ${reportFile} ---\n`);
  return reportFile;
}

interface TestResult {
  ok: boolean;
  result?: {
    matchedFields: string[];
    charCount: number;
    usedOcr: boolean;
    data: Record<string, number>;
    textPreview?: string;
  };
  error?: string;
  logs?: unknown[];
}

/** Direct parse via /test-parse — bypasses file input (more reliable in Playwright) */
async function runDirectParseTest(
  page: import("@playwright/test").Page,
  pdfPath: string,
  label: string,
  testInfo: import("@playwright/test").TestInfo,
) {
  const consoleLogs: string[] = [];
  page.on("console", (msg) => {
    const line = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(line);
    if (line.includes("Form16Parse") || line.includes("progress")) {
      console.log(line);
    }
  });

  const pdfBase64 = fs.readFileSync(pdfPath).toString("base64");
  const fileName = path.basename(pdfPath);

  await page.addInitScript(
    ({ b64, name }) => {
      window.__TEST_PDF_B64__ = b64;
      window.__TEST_PDF_NAME__ = name;
      window.__TEST_RESULT__ = undefined;
      window.__form16ParseLogs = [];
    },
    { b64: pdfBase64, name: fileName },
  );

  const report: Record<string, unknown> = {
    mode: "direct",
    fixture: label,
    pdfPath,
    fileSize: fs.statSync(pdfPath).size,
    project: testInfo.project.name,
  };

  await page.goto("/test-parse?debug=1");

  await page.waitForFunction(
    () => (window as Window & { __TEST_RESULT__?: unknown }).__TEST_RESULT__ != null,
    { timeout: 540_000 },
  );

  const testResult = (await page.evaluate(
    () => (window as Window & { __TEST_RESULT__?: TestResult }).__TEST_RESULT__,
  )) as TestResult;

  const browserLogs = await page.evaluate(
    () => (window as Window & { __form16ParseLogs?: unknown[] }).__form16ParseLogs ?? [],
  );

  Object.assign(report, {
    testResult,
    parseLogs: browserLogs,
    consoleLogs: consoleLogs.filter((l) => l.includes("Form16Parse")),
  });

  const reportFile = writeReport(
    safeReportName(testInfo.project.name, label),
    report,
  );

  if (!testResult?.ok) {
    console.log("FAILED:", testResult?.error);
    console.log("Parse logs:", JSON.stringify(browserLogs, null, 2));
    expect.soft(testResult?.ok, `${label} failed: ${testResult?.error}\nSee ${reportFile}`).toBe(
      true,
    );
    return report;
  }

  const { result } = testResult;
  expect.soft(result?.charCount ?? 0, `No text read from ${label}`).toBeGreaterThan(0);

  const isPartA = /PART-A/i.test(label);
  const isPartB = /PART-B/i.test(label);
  const matched = result?.matchedFields?.length ?? 0;

  if (isPartA) {
    expect.soft(matched, `Part A should match TDS fields. See ${reportFile}`).toBeGreaterThan(
      0,
    );
  } else if (isPartB) {
    const salary = result?.data?.salary17_1 ?? 0;
    expect.soft(
      salary > 0 || matched > 0,
      `Part B should match salary. See ${reportFile}`,
    ).toBeTruthy();
  } else {
    expect.soft(matched).toBeGreaterThan(0);
  }

  console.log(
    `${label}: ${matched} fields, ${result?.charCount} chars, OCR=${result?.usedOcr}`,
  );
  return report;
}

test.describe("Form 16 PDF parse — mobile (direct)", () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    for (const name of FORM16_FIXTURE_NAMES) {
      resolveForm16Fixture(name);
    }
  });

  // Part B first — has salary (most important for calculator)
  test("Part B — salary fields", async ({ page }, testInfo) => {
    const name = FORM16_FIXTURE_NAMES.find((n) => /PART-B/i.test(n))!;
    await runDirectParseTest(page, resolveForm16Fixture(name), name, testInfo);
  });

  test("Part A — TDS certificate", async ({ page }, testInfo) => {
    const name = FORM16_FIXTURE_NAMES.find((n) => /PART-A/i.test(n))!;
    await runDirectParseTest(page, resolveForm16Fixture(name), name, testInfo);
  });

  test("Part A + Part B combined fields", async ({ page }, testInfo) => {
    const paths = resolveAllForm16Fixtures();
    const merged: Record<string, number> = {};
    const allFields: string[] = [];

    for (const pdfPath of paths) {
      const label = path.basename(pdfPath);
      await page.addInitScript(() => {
        window.__TEST_RESULT__ = undefined;
        window.__form16ParseLogs = [];
      });
      const report = await runDirectParseTest(page, pdfPath, label, testInfo);
      const tr = report.testResult as TestResult | undefined;
      if (tr?.result?.data) {
        Object.assign(merged, tr.result.data);
        allFields.push(...(tr.result.matchedFields ?? []));
      }
    }

    writeReport(
      safeReportName(testInfo.project.name, "combined-summary"),
      { merged, allFields },
    );

    expect(Object.keys(merged).length).toBeGreaterThan(0);
  });
});
