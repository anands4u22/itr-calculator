import type { Form16Data } from "../tax/types";
import { EMPTY_FORM16 } from "../tax/types";

export interface ParseResult {
  data: Partial<Form16Data>;
  lines: string[];
  matchedFields: string[];
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[,₹\s]/g, "").replace(/[^\d.-]/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === ".") return 0;
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}

const AMOUNT_AT_END =
  /(?:Rs\.?\s*)?(-?\d[\d,]*(?:\.\d+)?)\s*$/i;

const AMOUNT_ANYWHERE =
  /(?:Rs\.?\s*|₹\s*)?(-?\d[\d,]*(?:\.\d+)?)/g;

function amountsInLine(line: string): number[] {
  const found: number[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(AMOUNT_ANYWHERE.source, "g");
  while ((match = pattern.exec(line)) !== null) {
    if (match[1]) found.push(parseAmount(match[1]));
  }
  return found;
}

function trailingAmount(line: string): number {
  const match = line.match(AMOUNT_AT_END);
  return match?.[1] ? parseAmount(match[1]) : 0;
}

function lineMatches(line: string, patterns: RegExp[], exclude: RegExp[] = []): boolean {
  if (exclude.some((p) => p.test(line))) return false;
  return patterns.some((p) => p.test(line));
}

function extractFromLines(
  lines: string[],
  labelPatterns: RegExp[],
  options?: { pick?: "last" | "max"; exclude?: RegExp[] },
): number {
  const pick = options?.pick ?? "last";
  const exclude = options?.exclude ?? [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!lineMatches(line, labelPatterns, exclude)) continue;

    let amount = trailingAmount(line);
    if (amount === 0 && i + 1 < lines.length) {
      const nextAmounts = amountsInLine(lines[i + 1]);
      if (nextAmounts.length === 1) amount = nextAmounts[0];
      else if (nextAmounts.length > 1) amount = nextAmounts[nextAmounts.length - 1];
    }

    if (amount === 0) {
      const inline = amountsInLine(line);
      if (inline.length > 0) {
        amount = pick === "max" ? Math.max(...inline) : inline[inline.length - 1];
      }
    }

    if (amount !== 0) return amount;
  }

  return 0;
}

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function parseForm16Text(text: string): ParseResult {
  const lines = normalizeLines(text);
  const flat = lines.join(" ");
  const matchedFields: string[] = [];

  const record = (field: string, value: number, target: Partial<Form16Data>, key: keyof Form16Data) => {
    if (value !== 0) {
      target[key] = value as never;
      matchedFields.push(field);
    }
  };

  const parsed: Partial<Form16Data> = {};

  record(
    "salary17_1",
    extractFromLines(lines, [
      /17\s*\(\s*1\s*\)/i,
      /salary as per provisions contained in section 17\s*\(\s*1\s*\)/i,
      /salary as per provisions contained in sec\.?\s*17\s*\(\s*1\s*\)/i,
      /\(a\)\s*salary as per/i,
    ]),
    parsed,
    "salary17_1",
  );

  record(
    "perquisites17_2",
    extractFromLines(lines, [
      /17\s*\(\s*2\s*\)/i,
      /value of perquisites under section 17\s*\(\s*2\s*\)/i,
      /perquisites under section 17\s*\(\s*2\s*\)/i,
      /\(b\)\s*value of perquisites/i,
    ]),
    parsed,
    "perquisites17_2",
  );

  record(
    "profitsInLieu17_3",
    extractFromLines(lines, [
      /17\s*\(\s*3\s*\)/i,
      /profits in lieu of salary under section 17\s*\(\s*3\s*\)/i,
      /\(c\)\s*profits in lieu/i,
    ]),
    parsed,
    "profitsInLieu17_3",
  );

  if (!parsed.salary17_1) {
    const gross = extractFromLines(lines, [
      /^1\.?\s*gross salary/i,
      /gross salary\s*\(?1\)?/i,
      /total gross salary/i,
    ], { pick: "max" });
    if (gross) record("salary17_1 (gross fallback)", gross, parsed, "salary17_1");
  }

  record(
    "hraExemption",
    extractFromLines(lines, [
      /10\s*\(\s*13A\s*\)/i,
      /house rent allowance/i,
      /hra exemption/i,
      /allowance u\/s 10\s*\(\s*13A\s*\)/i,
    ]),
    parsed,
    "hraExemption",
  );

  record(
    "ltaExemption",
    extractFromLines(lines, [
      /10\s*\(\s*5\s*\)/i,
      /leave travel/i,
      /lta/i,
    ]),
    parsed,
    "ltaExemption",
  );

  record(
    "otherExemptions10",
    extractFromLines(lines, [
      /total amount of exemption claimed under section 10/i,
      /allowances to the extent exempt u\/s\s*10/i,
      /less:\s*allowances under section 10/i,
      /^2\.?\s*less:\s*allowances/i,
    ]),
    parsed,
    "otherExemptions10",
  );

  record(
    "professionalTax",
    extractFromLines(lines, [
      /16\s*\(\s*iii\s*\)/i,
      /tax on employment/i,
      /professional tax/i,
    ]),
    parsed,
    "professionalTax",
  );

  record(
    "section80C",
    extractFromLines(
      lines,
      [/80C/i, /80CCC/i, /deduction under chapter vi-a/i],
      { exclude: [/80CCD/i, /80D/i, /80E/i, /80G/i] },
    ),
    parsed,
    "section80C",
  );

  record(
    "section80CCD1B",
    extractFromLines(lines, [/80CCD\s*\(\s*1B\s*\)/i]),
    parsed,
    "section80CCD1B",
  );

  record(
    "section80D",
    extractFromLines(lines, [/80D/i], { exclude: [/80CCD/i] }),
    parsed,
    "section80D",
  );

  record(
    "section80E",
    extractFromLines(lines, [/80E/i]),
    parsed,
    "section80E",
  );

  record(
    "section80G",
    extractFromLines(lines, [/80G/i]),
    parsed,
    "section80G",
  );

  record(
    "section80CCD2",
    extractFromLines(lines, [/80CCD\s*\(\s*2\s*\)/i]),
    parsed,
    "section80CCD2",
  );

  record(
    "otherIncome",
    extractFromLines(lines, [
      /income from other sources/i,
      /any other income reported by employee/i,
      /add:\s*any other income/i,
    ]),
    parsed,
    "otherIncome",
  );

  const hpLoss = extractFromLines(lines, [
    /loss from house property/i,
    /interest payable on borrowed capital/i,
    /income \(or admissible loss\) from house property/i,
  ]);
  if (hpLoss !== 0) {
    parsed.housePropertyLoss = hpLoss > 0 ? -hpLoss : hpLoss;
    matchedFields.push("housePropertyLoss");
  }

  const tdsFromLines = extractFromLines(lines, [
    /total amount of tax deducted/i,
    /tax deducted and deposited/i,
    /total tax deducted/i,
    /aggregate amount of tax deducted/i,
  ], { pick: "max" });

  const tdsFromFlat = extractFromLines([flat], [
    /total amount of tax deducted/i,
    /tax deducted and deposited/i,
  ], { pick: "max" });

  const totalTds = Math.max(tdsFromLines, tdsFromFlat);
  if (totalTds) record("totalTds", totalTds, parsed, "totalTds");

  return { data: parsed, lines, matchedFields };
}

export function mergeForm16Data(
  base: Form16Data,
  partial: Partial<Form16Data>,
): Form16Data {
  const merged = { ...base };
  for (const [key, value] of Object.entries(partial) as [keyof Form16Data, number][]) {
    if (value !== 0) merged[key] = value;
  }
  return merged;
}

export function createEmptyForm16(): Form16Data {
  return { ...EMPTY_FORM16 };
}
