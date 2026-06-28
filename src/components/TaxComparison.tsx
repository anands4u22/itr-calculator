"use client";

import type { ComparisonResult, RegimeResult } from "@/lib/tax/types";
import { formatINR, cn } from "@/lib/utils";

interface TaxComparisonProps {
  result: ComparisonResult;
}

function Row({
  label,
  value,
  highlight = false,
  subtle = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  subtle?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 text-sm",
        highlight && "font-semibold text-slate-900",
        subtle && "text-slate-500",
      )}
    >
      <span className={subtle ? "text-slate-500" : "text-slate-600"}>{label}</span>
      <span
        className={cn(
          "tabular-nums",
          highlight ? "text-slate-900" : subtle ? "text-slate-600" : "text-slate-800",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function RegimeCard({
  data,
  recommended,
}: {
  data: RegimeResult;
  recommended: boolean;
}) {
  const title = data.regime === "new" ? "New Tax Regime" : "Old Tax Regime";
  const hasChapter6Breakdown =
    data.chapter6ABreakdown &&
    (data.chapter6ABreakdown.section80C > 0 ||
      data.chapter6ABreakdown.section80CCD1B > 0 ||
      data.chapter6ABreakdown.section80CCD2 > 0 ||
      data.chapter6ABreakdown.other > 0);

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-5 shadow-sm",
        recommended
          ? "border-emerald-400 ring-2 ring-emerald-100"
          : "border-slate-200",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">
            {data.regime === "new"
              ? "Lower slabs, ₹75k standard deduction, limited deductions"
              : "Exemptions + Chapter VI-A deductions, ₹50k standard deduction"}
          </p>
        </div>
        {recommended ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            Recommended
          </span>
        ) : null}
      </div>

      <Row label="Gross salary" value={formatINR(data.grossSalary)} />
      {data.exemptions > 0 ? (
        <Row label="Exemptions u/s 10" value={`- ${formatINR(data.exemptions)}`} />
      ) : null}
      <Row
        label="Standard deduction"
        value={`- ${formatINR(data.standardDeduction)}`}
      />
      {data.professionalTax > 0 ? (
        <Row
          label="Professional tax"
          value={`- ${formatINR(data.professionalTax)}`}
        />
      ) : null}
      <Row
        label="Income from salary"
        value={formatINR(data.incomeFromSalary)}
        highlight
      />
      {data.otherIncome !== 0 ? (
        <Row label="Other income" value={formatINR(data.otherIncome)} />
      ) : null}
      {data.housePropertyAdjustment < 0 ? (
        <Row
          label="House property loss"
          value={formatINR(data.housePropertyAdjustment)}
        />
      ) : null}
      <Row
        label="Gross total income"
        value={formatINR(data.grossTotalIncome)}
        highlight
      />

      {data.chapter6ADeductions > 0 && hasChapter6Breakdown ? (
        <>
          {data.chapter6ABreakdown!.section80C > 0 ? (
            <Row
              label="Less: Section 80C"
              value={`- ${formatINR(data.chapter6ABreakdown!.section80C)}`}
            />
          ) : null}
          {data.chapter6ABreakdown!.section80CCD1B > 0 ? (
            <Row
              label="Less: Section 80CCD(1B)"
              value={`- ${formatINR(data.chapter6ABreakdown!.section80CCD1B)}`}
            />
          ) : null}
          {data.chapter6ABreakdown!.section80CCD2 > 0 ? (
            <Row
              label="Less: Section 80CCD(2) employer NPS"
              value={`- ${formatINR(data.chapter6ABreakdown!.section80CCD2)}`}
            />
          ) : null}
          {data.chapter6ABreakdown!.other > 0 ? (
            <Row
              label="Less: Other VI-A (80D, 80G…)"
              value={`- ${formatINR(data.chapter6ABreakdown!.other)}`}
            />
          ) : null}
        </>
      ) : data.chapter6ADeductions > 0 ? (
        <Row
          label="Less: Chapter VI-A deductions"
          value={`- ${formatINR(data.chapter6ADeductions)}`}
        />
      ) : null}

      <Row label="Taxable income" value={formatINR(data.taxableIncome)} highlight />
      <Row label="Tax on taxable income" value={formatINR(data.taxBeforeRebate)} />
      {data.rebate87A > 0 ? (
        <Row label="Less: Rebate u/s 87A" value={`- ${formatINR(data.rebate87A)}`} />
      ) : null}
      <Row label="Tax after rebate" value={formatINR(data.taxAfterRebate)} />
      <Row label="Add: Health & education cess (4%)" value={formatINR(data.cess)} />
      <Row label="Total tax payable" value={formatINR(data.totalTax)} highlight />
      <Row label="TDS already deducted" value={formatINR(data.tdsDeducted)} />
      {data.refund > 0 ? (
        <Row label="Estimated refund" value={formatINR(data.refund)} highlight />
      ) : (
        <Row label="Balance tax payable" value={formatINR(data.balanceTax)} highlight />
      )}
    </div>
  );
}

export function TaxComparison({ result }: TaxComparisonProps) {
  const { newRegime, oldRegime, recommended, savings, warnings } = result;

  return (
    <div className="space-y-5">
      {warnings && warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Adjustments applied:</strong>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-indigo-950 p-5 text-white">
        <h2 className="text-xl font-semibold">Tax comparison</h2>
        <p className="mt-1 text-sm text-indigo-100">
          {recommended === "equal"
            ? "Both regimes result in the same tax liability."
            : `You save ${formatINR(savings)} with the ${recommended} regime.`}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white/10 p-4">
            <p className="text-xs uppercase tracking-wide text-indigo-200">New regime</p>
            <p className="mt-1 text-2xl font-bold">{formatINR(newRegime.totalTax)}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-4">
            <p className="text-xs uppercase tracking-wide text-indigo-200">Old regime</p>
            <p className="mt-1 text-2xl font-bold">{formatINR(oldRegime.totalTax)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <RegimeCard data={newRegime} recommended={recommended === "new"} />
        <RegimeCard data={oldRegime} recommended={recommended === "old"} />
      </div>
    </div>
  );
}
