"use client";

import { CurrencyInput } from "@/components/CurrencyInput";
import type { Form16Data } from "@/lib/tax/types";

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

interface ManualFormProps {
  data: Form16Data;
  onChange: (data: Form16Data) => void;
}

export function ManualForm({ data, onChange }: ManualFormProps) {
  const update = (field: keyof Form16Data, value: number) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-5">
      <FormSection
        title="Part B — Salary (Section 17)"
        description="Enter values from your Form 16 Part B annexure."
      >
        <CurrencyInput
          label="Salary u/s 17(1)"
          hint="Basic, DA, bonus, commission"
          value={data.salary17_1}
          onChange={(v) => update("salary17_1", v)}
        />
        <CurrencyInput
          label="Perquisites u/s 17(2)"
          value={data.perquisites17_2}
          onChange={(v) => update("perquisites17_2", v)}
        />
        <CurrencyInput
          label="Profits in lieu u/s 17(3)"
          value={data.profitsInLieu17_3}
          onChange={(v) => update("profitsInLieu17_3", v)}
        />
      </FormSection>

      <FormSection
        title="Exemptions u/s 10 (Old regime only)"
        description="HRA, LTA and other exempt allowances."
      >
        <CurrencyInput
          label="HRA exemption"
          value={data.hraExemption}
          onChange={(v) => update("hraExemption", v)}
        />
        <CurrencyInput
          label="LTA exemption"
          value={data.ltaExemption}
          onChange={(v) => update("ltaExemption", v)}
        />
        <CurrencyInput
          label="Other exemptions u/s 10"
          value={data.otherExemptions10}
          onChange={(v) => update("otherExemptions10", v)}
        />
        <CurrencyInput
          label="Professional tax u/s 16(iii)"
          value={data.professionalTax}
          onChange={(v) => update("professionalTax", v)}
        />
      </FormSection>

      <FormSection
        title="Chapter VI-A Deductions"
        description="Used in old regime; only 80CCD(2) applies in new regime."
      >
        <CurrencyInput
          label="Section 80C"
          hint="Max ₹1.5 lakh"
          value={data.section80C}
          onChange={(v) => update("section80C", v)}
        />
        <CurrencyInput
          label="Section 80CCD(1B)"
          hint="Additional NPS, max ₹50k"
          value={data.section80CCD1B}
          onChange={(v) => update("section80CCD1B", v)}
        />
        <CurrencyInput
          label="Section 80D"
          value={data.section80D}
          onChange={(v) => update("section80D", v)}
        />
        <CurrencyInput
          label="Section 80E"
          value={data.section80E}
          onChange={(v) => update("section80E", v)}
        />
        <CurrencyInput
          label="Section 80G"
          value={data.section80G}
          onChange={(v) => update("section80G", v)}
        />
        <CurrencyInput
          label="Section 80CCD(2)"
          hint="Employer NPS — allowed in both regimes"
          value={data.section80CCD2}
          onChange={(v) => update("section80CCD2", v)}
        />
      </FormSection>

      <FormSection
        title="Other income & TDS"
        description="Part A TDS and any other income declared to employer."
      >
        <CurrencyInput
          label="Other income"
          value={data.otherIncome}
          onChange={(v) => update("otherIncome", v)}
        />
        <CurrencyInput
          label="House property loss"
          hint="Home loan interest (enter as negative, e.g. -200000)"
          value={data.housePropertyLoss}
          allowNegative
          onChange={(v) => update("housePropertyLoss", v)}
        />
        <CurrencyInput
          label="Total TDS deducted (Part A)"
          value={data.totalTds}
          onChange={(v) => update("totalTds", v)}
        />
      </FormSection>
    </div>
  );
}
