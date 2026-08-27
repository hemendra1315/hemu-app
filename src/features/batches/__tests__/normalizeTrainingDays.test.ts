import { describe, expect, it } from 'vitest';

import { normalizeTrainingDays } from '../api/batchesApi';

/**
 * Regression cover for `trainingDays.split is not a function`, which crashed the
 * Batch detail page. `batches.training_days` is declared `text` in migration
 * 0005, but the demo-data seeder inserts `ARRAY['Mon','Wed','Fri']` and a
 * database whose column is `text[]` returns a real JS array. The Batch type
 * promises `string | null`, so the mapper has to make that true.
 */
describe('normalizeTrainingDays', () => {
  it('passes a comma-separated string through', () => {
    expect(normalizeTrainingDays('Mon, Wed, Fri')).toBe('Mon, Wed, Fri');
  });

  it('joins a Postgres text[] returned as a JS array', () => {
    expect(normalizeTrainingDays(['Mon', 'Wed', 'Fri'])).toBe('Mon, Wed, Fri');
  });

  it('unwraps the literal a text[] leaves when stored in a text column', () => {
    expect(normalizeTrainingDays('{Mon,Wed,Fri}')).toBe('Mon, Wed, Fri');
  });

  it('strips the quotes Postgres adds around array members', () => {
    expect(normalizeTrainingDays('{"Mon","Wed"}')).toBe('Mon, Wed');
  });

  it('treats null, undefined and empty values as no schedule', () => {
    expect(normalizeTrainingDays(null)).toBeNull();
    expect(normalizeTrainingDays(undefined)).toBeNull();
    expect(normalizeTrainingDays('')).toBeNull();
    expect(normalizeTrainingDays('   ')).toBeNull();
    expect(normalizeTrainingDays([])).toBeNull();
    expect(normalizeTrainingDays('{}')).toBeNull();
  });

  it('drops blank members rather than emitting stray separators', () => {
    expect(normalizeTrainingDays(['Mon', '', '  ', 'Fri'])).toBe('Mon, Fri');
  });

  it('always returns something .split() can be called on', () => {
    for (const input of [['Mon', 'Wed'], '{Mon,Wed}', 'Mon, Wed']) {
      const result = normalizeTrainingDays(input);
      expect(typeof result).toBe('string');
      expect((result as string).split(',')).toHaveLength(2);
    }
  });
});
