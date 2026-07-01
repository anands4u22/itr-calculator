import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  FORM16_FIXTURE_NAMES,
  resolveAllForm16Fixtures,
  resolveForm16Fixture,
} from "../fixtures";

const OUTPUT_DIR = path.join(process.cwd(), "tests", "output");

function safeReportName(project: string, fixtureName: string): string {
  const base = fixtureName
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 80);
  return `${project}-${base}.json`;
}

function writeReport(fileName: string, report: unknown) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const reportFile = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n--- Report: ${reportFile} ---\n`);
  return reportFile;
}

async function runUploadTest(
  page: import("@playwright/test").Page,
  pdfPaths: string[],
  fixtureLabel: string,
  testInfo: import("@playwright/test").TestInfo,
) {
  const consoleLogs: string[] = [];
  page.on("console", (msg) => {
    const line = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(line);
    if (
      msg.text().includes("[Form16Parse:") ||
      msg.text().includes("[Form16Upload]")
    ) {
      console.log(line);
    }
  });

  let reportFile = "";
  const report: Record<string, unknown> = {
    fixture: fixtureLabel,
    pdfPaths,
    project: testInfo.project.name,
  };

  try {
    await page.goto("/?debug=1");
    await page.getByRole("button", { name: "Upload PDF" }).click();
    await expect(page.getByText("Upload Form 16 PDF")).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles(pdfPaths);

    const errorBox = page.locator("text=Upload failed");
    const parsedLine = page.locator("text=/^Parsed:/");
    const warningBox = page.locator(".text-amber-800");

    await Promise.race([
      parsedLine.waitFor({ state: "visible", timeout: 300_000 }),
      errorBox.waitFor({ state: "visible", timeout: 300_000 }),
    ]);

    const browserLogs = await page.evaluate(() => window.__form16ParseLogs ?? []);

    Object.assign(report, {
      userAgent: await page.evaluate(() => navigator.userAgent),
      parseLogs: browserLogs,
      consoleLogs: consoleLogs.filter(
        (l) =>
          l.includes("Form16Parse") ||
          l.includes("Form16Upload") ||
          l.includes("OCR"),
      ),
      uploadFailed: await errorBox.isVisible(),
      errorText: (await errorBox.isVisible())
        ? await errorBox.locator("pre").innerText().catch(() => "")
        : null,
      parsedText: (await parsedLine.isVisible())
        ? await parsedLine.innerText().catch(() => "")
        : null,
      warningText: (await warningBox.isVisible())
        ? await warningBox.first().innerText().catch(() => "")
        : null,
    });

    reportFile = writeReport(
      safeReportName(testInfo.project.name, fixtureLabel),
      report,
    );

    if (report.uploadFailed) {
      console.log("Parse logs:", JSON.stringify(browserLogs, null, 2));
      expect.soft(report.uploadFailed, String(report.errorText)).toBe(false);
      return report;
    }

    const doneLog = browserLogs.find(
      (e: { stage?: string }) => e.stage === "done",
    ) as { data?: { matchedFields?: string[]; charCount?: number } } | undefined;

    const matched = doneLog?.data?.matchedFields?.length ?? 0;
    const charCount = doneLog?.data?.charCount ?? 0;
    const isPartA = /PART-A/i.test(fixtureLabel);
    const isPartB = /PART-B/i.test(fixtureLabel);

    expect.soft(charCount, `No text read from ${fixtureLabel}`).toBeGreaterThan(0);

    if (isPartA) {
      const hasTds = doneLog?.data?.matchedFields?.some((f) =>
        /tds/i.test(f),
      );
      expect.soft(
        matched,
        `Part A should match TDS or other fields. See ${reportFile}`,
      ).toBeGreaterThan(0);
      expect.soft(hasTds || matched > 0).toBeTruthy();
    } else if (isPartB) {
      const hasSalary = (doneLog?.data as { data?: { salary17_1?: number } })
        ?.data?.salary17_1;
      expect.soft(
        hasSalary || matched > 0,
        `Part B should match salary. See ${reportFile}`,
      ).toBeTruthy();
    } else {
      expect.soft(matched).toBeGreaterThan(0);
    }

    return report;
  } catch (err) {
    report.crashError = err instanceof Error ? err.message : String(err);
    reportFile = writeReport(
      safeReportName(testInfo.project.name, `${fixtureLabel}-crash`),
      report,
    );
    throw err;
  }
}

test.describe("Form 16 PDF upload — mobile", () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    for (const name of FORM16_FIXTURE_NAMES) {
      resolveForm16Fixture(name);
    }
  });

  for (const fixtureName of FORM16_FIXTURE_NAMES) {
    test(`parse ${fixtureName} on mobile`, async ({ page }, testInfo) => {
      const pdfPath = resolveForm16Fixture(fixtureName);
      await runUploadTest(page, [pdfPath], fixtureName, testInfo);
    });
  }

  test("parse Part A + Part B together on mobile", async ({ page }, testInfo) => {
    const pdfPaths = resolveAllForm16Fixtures();
    await runUploadTest(page, pdfPaths, "combined-part-a-b", testInfo);
  });
});
