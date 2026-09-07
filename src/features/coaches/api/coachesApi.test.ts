import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockQueryBuilder } from '../../../test/supabaseQueryBuilder';
import type { UUID } from '@/types';
import { fetchCoaches, removeCoachFromBatch, setHeadCoach } from './coachesApi';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabase/client';
const mockedSupabase = vi.mocked(supabase);

const ACADEMY_ID = '11111111-1111-1111-1111-111111111111' as UUID;
const BATCH_ID = '22222222-2222-2222-2222-222222222222' as UUID;
const COACH_USER_1 = '33333333-3333-3333-3333-333333333333' as UUID;
const COACH_USER_2 = '44444444-4444-4444-4444-444444444444' as UUID;
const MEMBER_1 = '55555555-5555-5555-5555-555555555555' as UUID;
const COACH_ROW_1 = '66666666-6666-6666-6666-666666666666' as UUID;

describe('fetchCoaches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists every active coach member, filling in their coaches-table profile when one exists', async () => {
    // Base list: academy_members (role=coach, active) -- the source of truth
    // for who shows up at all.
    const membersBuilder = createMockQueryBuilder({
      data: [
        {
          id: MEMBER_1,
          user_id: COACH_USER_1,
          profiles: { full_name: 'Coach One', email: 'one@test.com' },
        },
        {
          id: 'member-2',
          user_id: COACH_USER_2,
          profiles: { full_name: 'Coach Two', email: 'two@test.com' },
        },
      ],
      error: null,
    });

    // Profile rows: only COACH_USER_1 has a `coaches` row -- exercises the
    // defensive fallback for a coach whose row hasn't been created yet.
    const profilesBuilder = createMockQueryBuilder({
      data: [
        {
          id: COACH_ROW_1,
          user_id: COACH_USER_1,
          bio: 'Batting specialist',
          specialization: ['Batting'],
          certifications: ['Level 2'],
          experience_years: 6,
          is_active: true,
          profiles: { full_name: 'Coach One', email: 'one@test.com', avatar_url: null },
        },
      ],
      error: null,
    });

    mockedSupabase.from
      .mockReturnValueOnce(membersBuilder as never)
      .mockReturnValueOnce(profilesBuilder as never);

    const coaches = await fetchCoaches(ACADEMY_ID);

    expect(coaches).toHaveLength(2);
    const one = coaches.find((c) => c.userId === COACH_USER_1);
    expect(one?.coachId).toBe(COACH_ROW_1);
    expect(one?.academyMemberId).toBe(MEMBER_1);
    expect(one?.specialization).toEqual(['Batting']);
    expect(one?.experienceYears).toBe(6);

    // No `coaches` row yet -- still shows up, with empty/default profile
    // fields rather than being dropped or throwing. `coachId` must be null,
    // never a fallback to their `academy_members.id` (a different id space
    // that every caller of `coachId` -- profile links, batch-assignment
    // RPCs -- would silently misuse as a `coaches.id`).
    const two = coaches.find((c) => c.userId === COACH_USER_2);
    expect(two?.coachId).toBeNull();
    expect(two?.academyMemberId).toBe('member-2');
    expect(two?.fullName).toBe('Coach Two');
    expect(two?.specialization).toEqual([]);
    expect(two?.experienceYears).toBeNull();
  });
});

describe('setHeadCoach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls assign_coach_to_batch as primary, then syncs batches.coach_id to the new head coach', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: null } as never);
    const updateBuilder = createMockQueryBuilder({ data: [{ id: BATCH_ID }], error: null });
    mockedSupabase.from.mockReturnValueOnce(updateBuilder as never);

    await setHeadCoach(BATCH_ID, { coachId: COACH_ROW_1, academyMemberId: MEMBER_1 });

    expect(mockedSupabase.rpc).toHaveBeenCalledWith('assign_coach_to_batch', {
      p_batch: BATCH_ID,
      p_coach: COACH_ROW_1,
      p_is_primary: true,
    });
    expect(updateBuilder.update).toHaveBeenCalledWith({ coach_id: MEMBER_1 });
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', BATCH_ID);
  });
});

describe('removeCoachFromBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears batches.coach_id only when the removed coach was the head coach', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: null } as never);

    await removeCoachFromBatch(BATCH_ID, COACH_ROW_1, false);
    expect(mockedSupabase.from).not.toHaveBeenCalled();

    const updateBuilder = createMockQueryBuilder({ data: [{ id: BATCH_ID }], error: null });
    mockedSupabase.from.mockReturnValueOnce(updateBuilder as never);

    await removeCoachFromBatch(BATCH_ID, COACH_ROW_1, true);
    expect(updateBuilder.update).toHaveBeenCalledWith({ coach_id: null });
  });
});
