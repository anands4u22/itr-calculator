export function calculateHraExemption(params: {
  monthlyHraReceived: number;
  monthlyRentPaid: number;
  monthlyBasic: number;
  isMetro: boolean;
  months?: number;
}): number {
  const months = params.months ?? 12;
  const annualHra = params.monthlyHraReceived * months;
  const annualRent = params.monthlyRentPaid * months;
  const annualBasic = params.monthlyBasic * months;

  if (annualHra <= 0 || annualRent <= 0 || annualBasic <= 0) {
    return 0;
  }

  const rentMinusTenPercent = annualRent - annualBasic * 0.1;
  const percentOfBasic = annualBasic * (params.isMetro ? 0.5 : 0.4);

  return Math.max(
    0,
    Math.floor(Math.min(annualHra, rentMinusTenPercent, percentOfBasic)),
  );
}
