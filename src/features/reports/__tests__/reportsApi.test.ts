import { describe, it, expect } from 'vitest';
import { getDaysInMonth } from '../api/reportsApi';

describe('Reports API Helpers', () => {
  describe('getDaysInMonth', () => {
    it('accurately calculates days in February for leap and non-leap years', () => {
      expect(getDaysInMonth(2024, 2)).toBe(29); // leap year
      expect(getDaysInMonth(2025, 2)).toBe(28); // non-leap year
      expect(getDaysInMonth(2026, 2)).toBe(28);
    });

    it('accurately calculates days for 30 and 31 day months', () => {
      expect(getDaysInMonth(2026, 1)).toBe(31); // Jan
      expect(getDaysInMonth(2026, 4)).toBe(30); // Apr
      expect(getDaysInMonth(2026, 7)).toBe(31); // Jul
      expect(getDaysInMonth(2026, 8)).toBe(31); // Aug
      expect(getDaysInMonth(2026, 9)).toBe(30); // Sep
      expect(getDaysInMonth(2026, 12)).toBe(31); // Dec
    });
  });
});
