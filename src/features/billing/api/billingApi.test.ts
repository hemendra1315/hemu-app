import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockQueryBuilder } from '../../../test/supabaseQueryBuilder';
import type { UUID } from '@/types';
import {
  fetchFeeSummaries,
  recordPayment,
  setPlayerFee,
  toLocalDate,
  toPeriodMonth,
} from './billingApi';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/features/members/api/membersApi', () => ({
  fetchAcademyMembers: vi.fn(),
  fetchAcademyMember: vi.fn(),
}));

import { supabase } from '@/lib/supabase/client';
import { fetchAcademyMembers } from '@/features/members/api/membersApi';
const mockedSupabase = vi.mocked(supabase);
const mockedFetchAcademyMembers = vi.mocked(fetchAcademyMembers);

const ACADEMY_ID = '11111111-1111-1111-1111-111111111111' as UUID;
const PLAYER_1 = '22222222-2222-2222-2222-222222222222' as UUID;
const PLAYER_2 = '33333333-3333-3333-3333-333333333333' as UUID;

describe('toPeriodMonth', () => {
  it('always resolves to the 1st of the month', () => {
    expect(toPeriodMonth(new Date(2026, 8, 17))).toBe('2026-09-01');
    expect(toPeriodMonth(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});

describe('toLocalDate', () => {
  it("uses the local calendar date, not toISOString()'s UTC date", () => {
    // A date constructed from local y/m/d components -- toISOString() on this
    // would report a different (UTC) day whenever the local offset is
    // non-zero and close to midnight; toLocalDate must not do that.
    expect(toLocalDate(new Date(2026, 8, 8))).toBe('2026-09-08');
    expect(toLocalDate(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});

describe('fetchFeeSummaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks a player paid only once payments for the month meet their fee, and unset-fee players as not paid', async () => {
    mockedFetchAcademyMembers.mockResolvedValue([
      { id: PLAYER_1, fullName: 'Player One', email: 'one@test.com' } as never,
      { id: PLAYER_2, fullName: 'Player Two', email: 'two@test.com' } as never,
    ]);

    const feesBuilder = createMockQueryBuilder({
      data: [{ player_id: PLAYER_1, monthly_fee_paise: 200000 }],
      error: null,
    });
    // Player 1 has two partial payments this month that together meet the fee;
    // Player 2 has none.
    const paymentsBuilder = createMockQueryBuilder({
      data: [
        { player_id: PLAYER_1, amount_paise: 150000 },
        { player_id: PLAYER_1, amount_paise: 50000 },
      ],
      error: null,
    });

    mockedSupabase.from
      .mockReturnValueOnce(feesBuilder as never)
      .mockReturnValueOnce(paymentsBuilder as never);

    const summaries = await fetchFeeSummaries(ACADEMY_ID, '2026-09-01');

    const one = summaries.find((s) => s.playerId === PLAYER_1);
    expect(one?.monthlyFeePaise).toBe(200000);
    expect(one?.paidPaiseThisMonth).toBe(200000);
    expect(one?.isPaid).toBe(true);

    // No `player_fees` row at all -- must show as "not paid", never fall back
    // to a default amount that could look satisfied by nothing.
    const two = summaries.find((s) => s.playerId === PLAYER_2);
    expect(two?.monthlyFeePaise).toBeNull();
    expect(two?.isPaid).toBe(false);
  });

  it('does not mark a player paid on a partial payment alone', async () => {
    mockedFetchAcademyMembers.mockResolvedValue([
      { id: PLAYER_1, fullName: 'Player One', email: 'one@test.com' } as never,
    ]);
    const feesBuilder = createMockQueryBuilder({
      data: [{ player_id: PLAYER_1, monthly_fee_paise: 200000 }],
      error: null,
    });
    const paymentsBuilder = createMockQueryBuilder({
      data: [{ player_id: PLAYER_1, amount_paise: 50000 }],
      error: null,
    });
    mockedSupabase.from
      .mockReturnValueOnce(feesBuilder as never)
      .mockReturnValueOnce(paymentsBuilder as never);

    const summaries = await fetchFeeSummaries(ACADEMY_ID, '2026-09-01');
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.isPaid).toBe(false);
  });
});

describe('setPlayerFee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts on player_id so re-setting a fee updates rather than duplicates', async () => {
    const builder = createMockQueryBuilder({ data: null, error: null });
    mockedSupabase.from.mockReturnValueOnce(builder as never);

    await setPlayerFee(ACADEMY_ID, PLAYER_1, 250000);

    expect(builder.upsert).toHaveBeenCalledWith(
      { academy_id: ACADEMY_ID, player_id: PLAYER_1, monthly_fee_paise: 250000 },
      { onConflict: 'player_id' },
    );
  });
});

describe('recordPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a ledger row scoped to the academy and player', async () => {
    const builder = createMockQueryBuilder({ data: null, error: null });
    mockedSupabase.from.mockReturnValueOnce(builder as never);

    await recordPayment(ACADEMY_ID, PLAYER_1, {
      amountPaise: 200000,
      periodMonth: '2026-09-01',
      paidOn: '2026-09-05',
      method: 'UPI',
      notes: null,
    });

    expect(builder.insert).toHaveBeenCalledWith({
      academy_id: ACADEMY_ID,
      player_id: PLAYER_1,
      amount_paise: 200000,
      period_month: '2026-09-01',
      paid_on: '2026-09-05',
      method: 'UPI',
      notes: null,
    });
  });
});
