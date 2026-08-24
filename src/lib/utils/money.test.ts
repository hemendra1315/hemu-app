import { describe, expect, it } from 'vitest';

import { formatPaise, paiseToRupees, rupeesToPaise } from './money';

describe('money helpers', () => {
  it('converts between rupees and paise without float drift', () => {
    expect(rupeesToPaise(200)).toBe(20000);
    expect(rupeesToPaise(199.99)).toBe(19999);
    expect(paiseToRupees(20000)).toBe(200);
  });

  it('formats the ₹200 monthly fee without decimals', () => {
    expect(formatPaise(20000)).toBe('₹200');
  });

  it('keeps decimals when paise are not round', () => {
    expect(formatPaise(20050)).toBe('₹200.50');
  });
});
