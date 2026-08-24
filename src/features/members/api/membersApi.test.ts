import { beforeEach, describe, expect, it, vi } from 'vitest';
import { approveJoinRequest, rejectJoinRequest } from './membersApi';

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
