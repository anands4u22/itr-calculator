# ITR Calculator

Compare income tax under the **new** and **old** tax regimes using Form 16 Part A and Part B for **FY 2025-26 (AY 2026-27)**.

## Features

- Upload Form 16 PDF (Part A + Part B)
- Manual entry fallback
- Side-by-side tax comparison
- Shows taxable income, rebate, cess, TDS, refund / balance tax
- Recommends the cheaper regime

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Notes

- PDF parsing depends on employer-specific Form 16 formats — always review extracted values.
- Old regime uses Section 10 exemptions and Chapter VI-A deductions.
- New regime uses ₹75,000 standard deduction and allows employer NPS (80CCD(2)).
- This is an estimate tool, not tax advice.
