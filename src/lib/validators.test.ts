import { describe, expect, it } from 'vitest';

import { createAcademyFormSchema, joinAcademyFormSchema, joinCodeSchema } from './validators';

describe('joinCodeSchema', () => {
  it('normalises casing and surrounding whitespace', () => {
    expect(joinCodeSchema.parse('  abc123 ')).toBe('ABC123');
  });

  it('rejects letters excluded from the Crockford alphabet', () => {
    for (const code of ['MUM001', 'ILO123', 'AOB123']) {
      expect(joinCodeSchema.safeParse(code).success).toBe(false);
    }
  });

  it('rejects codes outside the 6–8 character range', () => {
    expect(joinCodeSchema.safeParse('ABC12').success).toBe(false);
    expect(joinCodeSchema.safeParse('ABC123456').success).toBe(false);
  });
});

describe('joinAcademyFormSchema', () => {
  it('accepts a code without a message', () => {
    expect(joinAcademyFormSchema.parse({ code: 'chE001', message: '' }).code).toBe('CHE001');
  });
});

describe('createAcademyFormSchema', () => {
  it('requires a usable name and a known fee mode', () => {
    expect(
      createAcademyFormSchema.safeParse({
        name: 'A',
        timezone: 'Asia/Kolkata',
        feeMode: 'player_pays',
      }).success,
    ).toBe(false);

    expect(
      createAcademyFormSchema.safeParse({
        name: 'Chennai Academy',
        timezone: 'Asia/Kolkata',
        feeMode: 'someone_else_pays',
      }).success,
    ).toBe(false);

    expect(
      createAcademyFormSchema.parse({
        name: '  Chennai Academy ',
        city: 'Chennai',
        timezone: 'Asia/Kolkata',
        feeMode: 'academy_pays',
      }).name,
    ).toBe('Chennai Academy');
  });
});
