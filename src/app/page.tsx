import { CalculatorApp } from "@/components/CalculatorApp";
import { FY_LABEL } from "@/lib/tax/slabs";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef2ff,_#f8fafc_45%)]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-wider text-indigo-600">
            ITR Calculator
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Form 16 Tax Regime Comparison
          </h1>
          <p className="mt-3 max-w-3xl text-base text-slate-600">
            Upload your Form 16 Part A &amp; Part B or enter details manually to
            compare tax payable under the <strong>new</strong> and{" "}
            <strong>old</strong> tax regimes for {FY_LABEL}.
          </p>
        </header>

        <CalculatorApp />

        <footer className="mt-10 border-t border-slate-200 pt-6 text-sm text-slate-500">
          <p>
            This tool provides an estimate for salaried individuals based on Form
            16 data. It does not replace professional tax advice. Surcharge,
            special incomes, and complex cases are not covered.
          </p>
        </footer>
      </div>
    </main>
  );
}
