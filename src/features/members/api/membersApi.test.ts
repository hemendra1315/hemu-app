import { beforeEach, describe, expect, it, vi } from 'vitest';
import { approveJoinRequest, fetchPendingJoinRequests, rejectJoinRequest } from './membersApi';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabase/client';
const mockedSupabase = vi.mocked(supabase);

describe('membersApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('approveJoinRequest', () => {
    it('calls approve_join_request RPC with null batch_ids when none provided', async () => {
      mockedSupabase.rpc.mockResolvedValue({ data: null, error: null } as never);

      await approveJoinRequest('req-1');

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('approve_join_request', {
        p_request_id: 'req-1',
        p_batch_ids: null,
      });
    });

    it('calls approve_join_request RPC with provided batch_ids', async () => {
      mockedSupabase.rpc.mockResolvedValue({ data: null, error: null } as never);

      await approveJoinRequest('req-1', ['batch-1', 'batch-2']);

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('approve_join_request', {
        p_request_id: 'req-1',
        p_batch_ids: ['batch-1', 'batch-2'],
      });
    });
  });

  describe('rejectJoinRequest', () => {
    it('calls reject_join_request RPC with p_request_id and null reason', async () => {
      mockedSupabase.rpc.mockResolvedValue({ data: null, error: null } as never);

      await rejectJoinRequest('req-2');

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('reject_join_request', {
        p_request_id: 'req-2',
        p_reason: null,
      });
    });
  });
});

/**
 * Regression guard for round 17.
 *
 * The pending-requests list read `join_requests` and embedded the requester's
 * `profiles` row. RLS never permits that embed for a person who has not joined
 * yet — they have no `academy_members` row — so it returned null and the owner
 * was shown blank names and blank emails to approve. A blocked embed is null,
 * not an error, which is why nothing ever surfaced.
 *
 * The fix routes through `academy_join_requests`, a SECURITY DEFINER function
 * that does the join itself. These tests pin that, because reverting to a
 * direct table read would look perfectly reasonable and silently blank the
 * list again.
 */
describe('fetchPendingJoinRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads through the academy_join_requests RPC, never the table directly', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: [], error: null } as never);

    await fetchPendingJoinRequests('acad-1');

    expect(mockedSupabase.rpc).toHaveBeenCalledWith('academy_join_requests', {
      p_academy: 'acad-1',
      p_status: 'pending',
    });
    // A direct `from('join_requests')` read is what produced the blank rows.
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });

  it('carries the requester name and email through to the UI shape', async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: [
        {
          request_id: 'req-1',
          user_id: 'user-1',
          full_name: 'Asha Rao',
          email: 'asha@example.com',
          avatar_url: null,
          requested_role: 'player',
          status: 'pending',
          message: 'Please add me',
          created_at: '2026-08-29T06:00:00Z',
        },
      ],
      error: null,
    } as never);

    const [request] = await fetchPendingJoinRequests('acad-1');

    expect(request?.fullName).toBe('Asha Rao');
    expect(request?.email).toBe('asha@example.com');
    expect(request?.id).toBe('req-1');
    expect(request?.academyId).toBe('acad-1');
  });

  it('returns an empty list when the function returns nothing at all', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: null } as never);
    await expect(fetchPendingJoinRequests('acad-1')).resolves.toEqual([]);
  });
});
