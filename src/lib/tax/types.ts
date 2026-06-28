export interface Form16Data {
  salary17_1: number;
  perquisites17_2: number;
  profitsInLieu17_3: number;
  hraExemption: number;
  ltaExemption: number;
  otherExemptions10: number;
  professionalTax: number;
  section80C: number;
  section80CCD1B: number;
  section80D: number;
  section80E: number;
  section80G: number;
  section80CCD2: number;
  otherIncome: number;
  housePropertyLoss: number;
  totalTds: number;
  /** Annual basic + DA — used to cap employer NPS (80CCD(2)). */
  annualBasic?: number;
}

export const EMPTY_FORM16: Form16Data = {
  salary17_1: 0,
  perquisites17_2: 0,
  profitsInLieu17_3: 0,
  hraExemption: 0,
  ltaExemption: 0,
  otherExemptions10: 0,
  professionalTax: 0,
  section80C: 0,
  section80CCD1B: 0,
  section80D: 0,
  section80E: 0,
  section80G: 0,
  section80CCD2: 0,
  otherIncome: 0,
  housePropertyLoss: 0,
  totalTds: 0,
};

export interface TaxSlab {
  upTo: number;
  rate: number;
}

export interface RegimeResult {
  regime: "new" | "old";
  grossSalary: number;
  exemptions: number;
  standardDeduction: number;
  professionalTax: number;
  incomeFromSalary: number;
  grossTotalIncome: number;
  chapter6ADeductions: number;
  chapter6ABreakdown?: {
    section80C: number;
    section80CCD1B: number;
    section80CCD2: number;
    other: number;
  };
  otherIncome: number;
  housePropertyAdjustment: number;
  taxableIncome: number;
  taxBeforeRebate: number;
  rebate87A: number;
  taxAfterRebate: number;
  cess: number;
  totalTax: number;
  tdsDeducted: number;
  balanceTax: number;
  refund: number;
  warnings?: string[];
}

export interface ComparisonResult {
  newRegime: RegimeResult;
  oldRegime: RegimeResult;
  recommended: "new" | "old" | "equal";
  savings: number;
  warnings?: string[];
}
