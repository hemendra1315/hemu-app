/**
 * All money is stored as integer paise (see schema). Never do arithmetic on
 * formatted strings; convert at the boundary only.
 */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function formatPaise(paise: number, locale = 'en-IN', currency = 'INR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paiseToRupees(paise));
}
