"use client";

import { calculateHraExemption } from "@/lib/tax/hra";
import type { QuickInputs } from "@/lib/tax/mergeInputs";
import { MAX_80C, MAX_80CCD1B } from "@/lib/tax/slabs";
import { CurrencyInput } from "@/components/ManualForm";
import { formatINR } from "@/lib/utils";

interface RegimeBadgeProps {
  regime: "old" | "both";
}

function RegimeBadge({ regime }: RegimeBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        regime === "both"
          ? "bg-indigo-100 text-indigo-700"
          : "bg-amber-100 text-amber-800"
      }`}
    >
      {regime === "both" ? "Old + New" : "Old only"}
    </span>
  );
}

interface ExtraInputsPanelProps {
  quick: QuickInputs;
  onChange: (quick: QuickInputs) => void;
}

export function ExtraInputsPanel({ quick, onChange }: ExtraInputsPanelProps) {
  const update = <K extends keyof QuickInputs>(key: K, value: QuickInputs[K]) => {
    onChange({ ...quick, [key]: value });
  };

  const computedHra = calculateHraExemption({
    monthlyHraReceived: quick.monthlyHraReceived,
    monthlyRentPaid: quick.monthlyRentPaid,
    monthlyBasic: quick.monthlyBasic,
    isMetro: quick.isMetro,
  });

  const annualEmployerNps = quick.monthlyEmployerNps * 12;
  const applied80C = Math.min(quick.annual80C, MAX_80C);
  const applied80CCD1B = Math.min(quick.annual80CCD1B, MAX_80CCD1B);
  const is80CCapped = quick.annual80C > MAX_80C;
  const is80CCD1BCapped = quick.annual80CCD1B > MAX_80CCD1B;
  const combined80CAndCCD =
    (quick.annual80C > 0 ? applied80C : 0) +
    (quick.annual80CCD1B > 0 ? applied80CCD1B : 0);

  return (
    <section className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">
          Additional exemptions &amp; deductions
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Add these alongside your Form 16 upload or manual entry. Quick inputs
          replace the same Form 16 field when both are filled (no double counting).
        </p>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800">
              Employer NPS — Section 80CCD(2)
            </h4>
            <RegimeBadge regime="both" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CurrencyInput
              label="Employer NPS contribution (per month)"
              hint="From payslip; multiplied by 12 for the year"
              value={quick.monthlyEmployerNps}
              onChange={(v) => update("monthlyEmployerNps", v)}
            />
            <div className="flex flex-col justify-end rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
              <span className="text-xs text-indigo-600">Annual 80CCD(2)</span>
              <span className="text-lg font-bold text-indigo-900">
                {formatINR(annualEmployerNps)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800">
              HRA exemption — Section 10(13A)
            </h4>
            <RegimeBadge regime="old" />
          </div>
          <p className="mb-4 text-xs text-slate-500">
            Enter monthly figures. Exemption = minimum of (annual HRA, rent − 10%
            of basic, 50%/40% of basic).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <CurrencyInput
              label="HRA received (per month)"
              value={quick.monthlyHraReceived}
              onChange={(v) => update("monthlyHraReceived", v)}
            />
            <CurrencyInput
              label="Rent paid (per month)"
              value={quick.monthlyRentPaid}
              onChange={(v) => update("monthlyRentPaid", v)}
            />
            <CurrencyInput
              label="Basic salary (per month)"
              hint="Basic + DA used for HRA calculation"
              value={quick.monthlyBasic}
              onChange={(v) => update("monthlyBasic", v)}
            />
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <input
                type="checkbox"
                checked={quick.isMetro}
                onChange={(e) => update("isMetro", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <span className="text-sm text-slate-700">
                Metro city (Mumbai, Delhi, Kolkata, Chennai)
              </span>
            </label>
          </div>
          {computedHra > 0 ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Computed annual HRA exemption:{" "}
              <strong>{formatINR(computedHra)}</strong>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800">
              Investments &amp; insurance — Section 80C
            </h4>
            <RegimeBadge regime="old" />
          </div>
          <p className="mb-4 text-xs leading-relaxed text-slate-500">
            <strong className="text-slate-700">Old regime only.</strong> Not
            available under the new tax regime. Combined limit of{" "}
            <strong>{formatINR(MAX_80C)}</strong> per year — covers PF (EPF),
            LIC premium, ELSS, PPF, NSC, home loan principal, tuition fees, and
            your own NPS under 80CCD(1).{" "}
            <strong>Both 80C and 80CCD(1B) are added together</strong> when you
            fill both fields below.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <CurrencyInput
              label="Total 80C investments (for the whole year)"
              hint="PF + LIC + ELSS + PPF + own NPS (80CCD(1)) combined"
              value={quick.annual80C}
              onChange={(v) => update("annual80C", v)}
            />
            <div className="flex flex-col justify-end rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
              <span className="text-xs text-amber-700">80C deduction applied</span>
              <span className="text-lg font-bold text-amber-900">
                {formatINR(applied80C)}
              </span>
              <span className="mt-1 text-xs text-amber-700">
                Max {formatINR(MAX_80C)}/yr
              </span>
            </div>
          </div>
          {is80CCapped ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              You entered {formatINR(quick.annual80C)} — only{" "}
              {formatINR(MAX_80C)} can be claimed under Section 80C in a year.
            </div>
          ) : null}

          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="mb-3 text-xs leading-relaxed text-slate-500">
              <strong className="text-slate-700">Section 80CCD(1B)</strong> —
              additional NPS contribution,{" "}
              <strong>on top of the ₹1.5L 80C limit</strong>. Old regime only.
              Max <strong>{formatINR(MAX_80CCD1B)}</strong>/yr.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <CurrencyInput
                label="Additional NPS — 80CCD(1B) (whole year)"
                hint="Extra NPS beyond the 80C bucket"
                value={quick.annual80CCD1B}
                onChange={(v) => update("annual80CCD1B", v)}
              />
              <div className="flex flex-col justify-end rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                <span className="text-xs text-amber-700">80CCD(1B) applied</span>
                <span className="text-lg font-bold text-amber-900">
                  {formatINR(applied80CCD1B)}
                </span>
                <span className="mt-1 text-xs text-amber-700">
                  Max {formatINR(MAX_80CCD1B)}/yr extra
                </span>
              </div>
            </div>
            {is80CCD1BCapped ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                You entered {formatINR(quick.annual80CCD1B)} — only{" "}
                {formatINR(MAX_80CCD1B)} can be claimed under 80CCD(1B).
              </div>
            ) : null}
          </div>

          {combined80CAndCCD > 0 ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {quick.annual80C > 0 && quick.annual80CCD1B > 0 ? (
                <>
                  Both 80C and 80CCD(1B) will be applied in old regime:{" "}
                  <strong>{formatINR(applied80C)}</strong> +{" "}
                  <strong>{formatINR(applied80CCD1B)}</strong> ={" "}
                  <strong>{formatINR(combined80CAndCCD)}</strong> total deduction
                </>
              ) : (
                <>
                  Old regime deduction from these fields:{" "}
                  <strong>{formatINR(combined80CAndCCD)}</strong>
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800">
              Donations — Section 80G
            </h4>
            <RegimeBadge regime="old" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CurrencyInput
              label="Total donations (for the whole year)"
              hint="Eligible donations under Section 80G"
              value={quick.annual80G}
              onChange={(v) => update("annual80G", v)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
