# ITR Calculator

**Live app:** [https://itr-calculator.vercel.app/](https://itr-calculator.vercel.app/)

Compare income tax under the **new** and **old** tax regimes using Form 16 Part A and Part B for **FY 2025-26 (AY 2026-27)**.

## How to use

1. Open [itr-calculator.vercel.app](https://itr-calculator.vercel.app/) on desktop or mobile.
2. **Upload** Form 16 Part B (salary) and optionally Part A (TDS).
3. **Review** auto-filled salary and deductions; edit or enter manually if needed.
4. Add optional NPS, HRA, 80C, or 80G if applicable.
5. Click **Compare tax regimes** to see new vs old tax and the recommended regime.

**Tip:** Part B has gross salary; Part A is mainly TDS. Scanned PDFs are supported via OCR.

## Privacy

This app **does not store, upload, or share** any user data. PDFs and numbers are processed entirely in the browser and never sent to a server.

## Disclaimer

Estimates only — not tax advice. Surcharge, special incomes, and complex cases are not covered.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
