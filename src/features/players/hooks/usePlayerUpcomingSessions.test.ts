import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { createMockQueryBuilder } from '../../../test/supabaseQueryBuilder';
import { usePlayerUpcomingSessions } from './usePlayers';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabase/client';
const mockedSupabase = vi.mocked(supabase);

const academyId = '11111111-1111-1111-1111-111111111111';
const playerId = '22222222-2222-2222-2222-222222222222';
const otherPlayersBatchId = '99999999-9999-9999-9999-999999999999';
const myBatchId = '33333333-3333-3333-3333-333333333333';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('usePlayerUpcomingSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('only queries training_sessions for batches the player actually belongs to', async () => {
    // Regression: this used to filter only by academy_id and date — a
    // player's profile showed every upcoming session in the whole academy,
    // not just their own batch's. `playerId` was accepted and never used.
    const batchMembersBuilder = createMockQueryBuilder({
      data: [{ batch_id: myBatchId }],
      error: null,
    });
    const sessionsBuilder = createMockQueryBuilder({ data: [], error: null });

    mockedSupabase.from.mockImplementation((table: string) =>
      table === 'batch_members' ? batchMembersBuilder : sessionsBuilder,
    );

    const { result } = renderHook(() => usePlayerUpcomingSessions(playerId, academyId), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(batchMembersBuilder.eq).toHaveBeenCalledWith('academy_member_id', playerId);
    expect(sessionsBuilder.in).toHaveBeenCalledWith('batch_id', [myBatchId]);
    // The old bug never restricted by batch at all — confirm it's not
    // silently querying every batch in the academy either.
    expect(sessionsBuilder.in).not.toHaveBeenCalledWith('batch_id', [otherPlayersBatchId]);
  });

  it('skips the sessions query entirely when the player has no batch', async () => {
    const batchMembersBuilder = createMockQueryBuilder({ data: [], error: null });
    mockedSupabase.from.mockReturnValue(batchMembersBuilder);

    const { result } = renderHook(() => usePlayerUpcomingSessions(playerId, academyId), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
    expect(mockedSupabase.from).toHaveBeenCalledTimes(1);
    expect(mockedSupabase.from).not.toHaveBeenCalledWith('training_sessions');
  });
});
