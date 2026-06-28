import type { TaxSlab } from "./types";

export const FY_LABEL = "FY 2025-26 (AY 2026-27)";

export const NEW_REGIME_SLABS: TaxSlab[] = [
  { upTo: 400_000, rate: 0 },
  { upTo: 800_000, rate: 0.05 },
  { upTo: 1_200_000, rate: 0.1 },
  { upTo: 1_600_000, rate: 0.15 },
  { upTo: 2_000_000, rate: 0.2 },
  { upTo: 2_400_000, rate: 0.25 },
  { upTo: Infinity, rate: 0.3 },
];

export const OLD_REGIME_SLABS: TaxSlab[] = [
  { upTo: 250_000, rate: 0 },
  { upTo: 500_000, rate: 0.05 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 },
];

export const NEW_STANDARD_DEDUCTION = 75_000;
export const OLD_STANDARD_DEDUCTION = 50_000;
export const CESS_RATE = 0.04;
export const MAX_80C = 150_000;
export const MAX_80CCD1B = 50_000;
export const MAX_PROFESSIONAL_TAX = 2_500;

export function computeSlabTax(income: number, slabs: TaxSlab[]): number {
  if (income <= 0) return 0;

  let tax = 0;
  let previousLimit = 0;

  for (const slab of slabs) {
    if (income <= previousLimit) break;
    const taxableInSlab = Math.min(income, slab.upTo) - previousLimit;
    if (taxableInSlab > 0) tax += taxableInSlab * slab.rate;
    previousLimit = slab.upTo;
  }

  return Math.round(tax);
}
