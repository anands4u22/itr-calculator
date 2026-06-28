import {
  CESS_RATE,
  MAX_80C,
  MAX_80CCD1B,
  MAX_PROFESSIONAL_TAX,
  NEW_REGIME_SLABS,
  NEW_STANDARD_DEDUCTION,
  OLD_REGIME_SLABS,
  OLD_STANDARD_DEDUCTION,
  computeSlabTax,
} from "./slabs";
import { cap80CCD2 } from "./mergeInputs";
import type { ComparisonResult, Form16Data, RegimeResult } from "./types";

function capDeductions(data: Form16Data) {
  const professionalTax = Math.min(
    Math.max(0, data.professionalTax),
    MAX_PROFESSIONAL_TAX,
  );

  const annualBasic = data.annualBasic ?? data.salary17_1;

  return {
    professionalTax,
    section80C: Math.min(data.section80C, MAX_80C),
    section80CCD1B: Math.min(data.section80CCD1B, MAX_80CCD1B),
    section80D: Math.max(0, data.section80D),
    section80E: Math.max(0, data.section80E),
    section80G: Math.max(0, data.section80G),
    section80CCD2: cap80CCD2(Math.max(0, data.section80CCD2), annualBasic),
  };
}

function buildResult(
  regime: "new" | "old",
  data: Form16Data,
  taxableIncome: number,
  exemptions: number,
  standardDeduction: number,
  professionalTax: number,
  incomeFromSalary: number,
  grossTotalIncome: number,
  chapter6A: number,
  housePropertyAdjustment: number,
  chapter6ABreakdown?: RegimeResult["chapter6ABreakdown"],
  warnings: string[] = [],
): RegimeResult {
  const grossSalary =
    data.salary17_1 + data.perquisites17_2 + data.profitsInLieu17_3;

  const taxBeforeRebate = computeSlabTax(
    taxableIncome,
    regime === "new" ? NEW_REGIME_SLABS : OLD_REGIME_SLABS,
  );

  let rebate87A = 0;
  if (regime === "new" && taxableIncome <= 1_200_000) {
    rebate87A = Math.min(taxBeforeRebate, 60_000);
  } else if (regime === "old" && taxableIncome <= 500_000) {
    rebate87A = Math.min(taxBeforeRebate, 12_500);
  }

  const taxAfterRebate = Math.max(0, taxBeforeRebate - rebate87A);
  const cess = Math.round(taxAfterRebate * CESS_RATE);
  const totalTax = taxAfterRebate + cess;
  const tdsDeducted = Math.max(0, data.totalTds);
  const balanceTax = Math.max(0, totalTax - tdsDeducted);
  const refund = Math.max(0, tdsDeducted - totalTax);

  return {
    regime,
    grossSalary,
    exemptions,
    standardDeduction,
    professionalTax,
    incomeFromSalary,
    grossTotalIncome,
    chapter6ADeductions: chapter6A,
    chapter6ABreakdown,
    otherIncome: data.otherIncome,
    housePropertyAdjustment,
    taxableIncome: Math.max(0, taxableIncome),
    taxBeforeRebate,
    rebate87A,
    taxAfterRebate,
    cess,
    totalTax,
    tdsDeducted,
    balanceTax,
    refund,
    warnings,
  };
}

export function calculateTaxComparison(data: Form16Data): ComparisonResult {
  const grossSalary =
    data.salary17_1 + data.perquisites17_2 + data.profitsInLieu17_3;
  const deductions = capDeductions(data);
  const warnings: string[] = [];

  if (data.professionalTax > MAX_PROFESSIONAL_TAX) {
    warnings.push(
      `Professional tax capped at ₹${MAX_PROFESSIONAL_TAX.toLocaleString("en-IN")}/yr (entered ₹${data.professionalTax.toLocaleString("en-IN")}).`,
    );
  }

  if (
    data.section80CCD2 > deductions.section80CCD2 &&
    deductions.section80CCD2 > 0
  ) {
    warnings.push(
      `Employer NPS 80CCD(2) capped at 10% of basic salary (₹${deductions.section80CCD2.toLocaleString("en-IN")}). Enter monthly basic in HRA section for accurate cap.`,
    );
  }

  const oldExemptions =
    data.hraExemption + data.ltaExemption + data.otherExemptions10;
  const oldOtherChapter6A =
    deductions.section80D + deductions.section80E + deductions.section80G;

  const oldChapter6A =
    deductions.section80C +
    deductions.section80CCD1B +
    oldOtherChapter6A +
    deductions.section80CCD2;

  const oldChapter6ABreakdown = {
    section80C: deductions.section80C,
    section80CCD1B: deductions.section80CCD1B,
    section80CCD2: deductions.section80CCD2,
    other: oldOtherChapter6A,
  };

  const oldIncomeFromSalary =
    grossSalary -
    oldExemptions -
    OLD_STANDARD_DEDUCTION -
    deductions.professionalTax;
  const oldGrossTotalIncome =
    oldIncomeFromSalary + data.otherIncome + data.housePropertyLoss;
  const oldTaxableIncome = oldGrossTotalIncome - oldChapter6A;

  const newIncomeFromSalary =
    grossSalary - NEW_STANDARD_DEDUCTION - deductions.professionalTax;
  const newGrossTotalIncome = newIncomeFromSalary + data.otherIncome;
  const newChapter6A = deductions.section80CCD2;
  const newTaxableIncome = newGrossTotalIncome - newChapter6A;

  const newRegime = buildResult(
    "new",
    data,
    newTaxableIncome,
    0,
    NEW_STANDARD_DEDUCTION,
    deductions.professionalTax,
    newIncomeFromSalary,
    newGrossTotalIncome,
    newChapter6A,
    0,
    {
      section80C: 0,
      section80CCD1B: 0,
      section80CCD2: deductions.section80CCD2,
      other: 0,
    },
    warnings,
  );

  const oldRegime = buildResult(
    "old",
    data,
    oldTaxableIncome,
    oldExemptions,
    OLD_STANDARD_DEDUCTION,
    deductions.professionalTax,
    oldIncomeFromSalary,
    oldGrossTotalIncome,
    oldChapter6A,
    data.housePropertyLoss,
    oldChapter6ABreakdown,
    warnings,
  );

  let recommended: ComparisonResult["recommended"] = "equal";
  let savings = 0;

  if (newRegime.totalTax < oldRegime.totalTax) {
    recommended = "new";
    savings = oldRegime.totalTax - newRegime.totalTax;
  } else if (oldRegime.totalTax < newRegime.totalTax) {
    recommended = "old";
    savings = newRegime.totalTax - oldRegime.totalTax;
  }

  return { newRegime, oldRegime, recommended, savings, warnings };
}
