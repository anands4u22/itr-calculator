import type { Form16Data } from "./types";
import { calculateHraExemption } from "./hra";
import { MAX_80C, MAX_80CCD1B } from "./slabs";

export interface QuickInputs {
  annualGrossSalary: number;
  monthlyEmployerNps: number;
  monthlyHraReceived: number;
  monthlyRentPaid: number;
  monthlyBasic: number;
  isMetro: boolean;
  annual80C: number;
  annual80CCD1B: number;
  annual80G: number;
}

export const EMPTY_QUICK_INPUTS: QuickInputs = {
  annualGrossSalary: 0,
  monthlyEmployerNps: 0,
  monthlyHraReceived: 0,
  monthlyRentPaid: 0,
  monthlyBasic: 0,
  isMetro: true,
  annual80C: 0,
  annual80CCD1B: 0,
  annual80G: 0,
};

export function syncQuickInputsFromParse(
  quick: QuickInputs,
  parsed: Partial<Form16Data>,
): QuickInputs {
  const next = { ...quick };

  const salary17_1 = parsed.salary17_1 ?? 0;
  const perquisites = parsed.perquisites17_2 ?? 0;
  const profits = parsed.profitsInLieu17_3 ?? 0;
  const componentTotal = salary17_1 + perquisites + profits;

  if (salary17_1 > 0) {
    next.annualGrossSalary = salary17_1;
  } else if (componentTotal > 0) {
    next.annualGrossSalary = componentTotal;
  }

  if ((parsed.section80C ?? 0) > 0) next.annual80C = parsed.section80C!;
  if ((parsed.section80CCD1B ?? 0) > 0) {
    next.annual80CCD1B = parsed.section80CCD1B!;
  }
  if ((parsed.section80G ?? 0) > 0) next.annual80G = parsed.section80G!;
  if ((parsed.section80CCD2 ?? 0) > 0) {
    next.monthlyEmployerNps = Math.round(parsed.section80CCD2! / 12);
  }

  return next;
}

/** Quick input replaces Form 16 when filled (same field). */
function overrideField(base: number, quick: number): number {
  return quick > 0 ? quick : base;
}

/** Different sections — both apply, capped (80C + 80CCD(1B)). */
function mergeCappedField(base: number, quick: number, max: number): number {
  if (quick > 0) return Math.min(quick, max);
  return Math.min(base, max);
}

export function cap80CCD2(
  amount: number,
  annualBasic: number,
  isGovernmentEmployee = false,
): number {
  if (amount <= 0) return 0;
  if (annualBasic <= 0) return amount;
  const limitRate = isGovernmentEmployee ? 0.14 : 0.1;
  return Math.min(amount, Math.floor(annualBasic * limitRate));
}

export function applyQuickInputs(
  formData: Form16Data,
  quick: QuickInputs,
): Form16Data {
  const merged = { ...formData };

  if (quick.annualGrossSalary > 0) {
    merged.salary17_1 = quick.annualGrossSalary;
  }

  const quickEmployerNpsAnnual =
    quick.monthlyEmployerNps > 0 ? quick.monthlyEmployerNps * 12 : 0;

  merged.section80CCD2 = overrideField(
    formData.section80CCD2,
    quickEmployerNpsAnnual,
  );

  merged.section80G = overrideField(formData.section80G, quick.annual80G);

  merged.section80C = mergeCappedField(
    formData.section80C,
    quick.annual80C,
    MAX_80C,
  );

  merged.section80CCD1B = mergeCappedField(
    formData.section80CCD1B,
    quick.annual80CCD1B,
    MAX_80CCD1B,
  );

  const computedHra = calculateHraExemption({
    monthlyHraReceived: quick.monthlyHraReceived,
    monthlyRentPaid: quick.monthlyRentPaid,
    monthlyBasic: quick.monthlyBasic,
    isMetro: quick.isMetro,
  });

  merged.hraExemption = overrideField(formData.hraExemption, computedHra);

  const annualBasic =
    quick.monthlyBasic > 0 ? quick.monthlyBasic * 12 : formData.salary17_1;

  if (quick.monthlyBasic > 0) {
    merged.annualBasic = annualBasic;
  }

  merged.section80CCD2 = cap80CCD2(merged.section80CCD2, annualBasic);

  return merged;
}

export function getQuickInputSummary(quick: QuickInputs): string[] {
  const lines: string[] = [];

  if (quick.annualGrossSalary > 0) {
    lines.push(
      `Gross salary: ₹${quick.annualGrossSalary.toLocaleString("en-IN")}/yr`,
    );
  }

  if (quick.monthlyEmployerNps > 0) {
    lines.push(
      `Employer NPS 80CCD(2): ₹${(quick.monthlyEmployerNps * 12).toLocaleString("en-IN")}/yr — old + new regime`,
    );
  }

  const hra = calculateHraExemption({
    monthlyHraReceived: quick.monthlyHraReceived,
    monthlyRentPaid: quick.monthlyRentPaid,
    monthlyBasic: quick.monthlyBasic,
    isMetro: quick.isMetro,
  });

  if (hra > 0) {
    lines.push(
      `HRA exemption: ₹${hra.toLocaleString("en-IN")}/yr — old regime only`,
    );
  }

  if (quick.annual80C > 0) {
    lines.push(
      `Section 80C: ₹${Math.min(quick.annual80C, MAX_80C).toLocaleString("en-IN")}/yr — old regime only (max ₹1.5L)`,
    );
  }

  if (quick.annual80CCD1B > 0) {
    lines.push(
      `Section 80CCD(1B): ₹${Math.min(quick.annual80CCD1B, MAX_80CCD1B).toLocaleString("en-IN")}/yr — old regime only, extra on top of 80C (max ₹50k)`,
    );
  }

  if (quick.annual80C > 0 && quick.annual80CCD1B > 0) {
    const total =
      Math.min(quick.annual80C, MAX_80C) +
      Math.min(quick.annual80CCD1B, MAX_80CCD1B);
    lines.push(
      `Combined 80C + 80CCD(1B) deduction: ₹${total.toLocaleString("en-IN")}/yr in old regime`,
    );
  }

  if (quick.annual80G > 0) {
    lines.push(
      `80G donations: ₹${quick.annual80G.toLocaleString("en-IN")}/yr — old regime only`,
    );
  }

  return lines;
}
