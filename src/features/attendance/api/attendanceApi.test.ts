/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createMockQueryBuilder } from '../../../test/supabaseQueryBuilder';

import {
  fetchSessionAttendance,
  markAllPresent,
  markAttendance,
  fetchPlayerAttendance,
  fetchBatchAttendance,
} from './attendanceApi';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null }),
    },
  },
}));

import { supabase } from '@/lib/supabase/client';
const mockedSupabase = vi.mocked(supabase);

// Shared with every other API test; see the note in that file for why this
// is centralised rather than redefined per suite.
const createMockBuilder = createMockQueryBuilder;

const sessionId = '11111111-1111-1111-1111-111111111111';
const academyId = '22222222-2222-2222-2222-222222222222';
const playerId = '33333333-3333-3333-3333-333333333333';
const batchId = '44444444-4444-4444-4444-444444444444';

describe('attendanceApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchSessionAttendance', () => {
    it('scopes the query by session_id', async () => {
      const mockBuilder = createMockBuilder({ data: [], error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await fetchSessionAttendance(sessionId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('attendance');
      expect(mockBuilder.eq).toHaveBeenCalledWith('session_id', sessionId);
    });

    it('returns mapped attendance records', async () => {
      const mockBuilder = createMockBuilder({
        data: [
          {
            id: 'a1',
            academy_id: academyId,
            session_id: sessionId,
            player_id: playerId,
            status: 'present',
            marked_by: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        error: null,
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await fetchSessionAttendance(sessionId);

      expect(result).toHaveLength(1);
      expect(result[0]!.academyId).toBe(academyId);
      expect(result[0]!.status).toBe('present');
    });

    it('throws when the query returns an error', async () => {
      const mockBuilder = createMockBuilder({
        data: null,
        error: { message: 'RLS denied', code: '42501' },
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(fetchSessionAttendance(sessionId)).rejects.toThrow();
    });
  });

  describe('markAllPresent', () => {
    it('upserts one row per player with correct academy_id and status', async () => {
      const mockBuilder = createMockBuilder({ data: null, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await markAllPresent(sessionId, [playerId, '4444'], academyId);

      const upsertArg = mockBuilder.upsert.mock.calls[0][0];
      expect(upsertArg).toHaveLength(2);
      expect(upsertArg[0].academy_id).toBe(academyId);
      expect(upsertArg[0].session_id).toBe(sessionId);
      expect(upsertArg[0].status).toBe('present');
      expect(upsertArg[1].player_id).toBe('4444');
    });

    it('no-ops when playerIds is empty', async () => {
      const mockBuilder = createMockBuilder({ data: null, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await markAllPresent(sessionId, [], academyId);

      expect(mockBuilder.upsert).not.toHaveBeenCalled();
    });

    it('throws when upsert returns an error', async () => {
      const mockBuilder = createMockBuilder({
        data: null,
        error: { message: 'conflict', code: '23505' },
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(markAllPresent(sessionId, [playerId], academyId)).rejects.toThrow();
    });
  });

  describe('markAttendance', () => {
    it('upserts with correct academy_id, session_id, player_id and status', async () => {
      const mockRow = {
        id: 'r1',
        academy_id: academyId,
        session_id: sessionId,
        player_id: playerId,
        status: 'absent',
        marked_by: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      const mockBuilder = createMockBuilder({ data: mockRow, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await markAttendance(sessionId, playerId, 'absent', academyId);

      expect(result.academyId).toBe(academyId);
      expect(result.sessionId).toBe(sessionId);
      expect(result.playerId).toBe(playerId);
      expect(result.status).toBe('absent');
      expect(mockBuilder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          academy_id: academyId,
          session_id: sessionId,
          player_id: playerId,
          status: 'absent',
        }),
        // supabase-js takes a comma-separated column list here, not an array;
        // the array form silently fails to match the unique index.
        { onConflict: 'session_id,player_id' },
      );
    });

    it('throws when upsert returns an error', async () => {
      const mockBuilder = createMockBuilder({
        data: null,
        error: { message: 'RLS denied', code: '42501' },
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(markAttendance(sessionId, playerId, 'absent', academyId)).rejects.toThrow();
    });
  });

  describe('fetchPlayerAttendance', () => {
    it('scopes the query by player_id', async () => {
      const mockBuilder = createMockBuilder({
        data: [
          {
            id: 'a1',
            academy_id: academyId,
            session_id: sessionId,
            player_id: playerId,
            status: 'present',
            marked_by: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
            session: {
              id: sessionId,
              title: 'Morning Drill',
              session_date: '2026-01-01',
              start_at: '09:00',
              end_at: '10:00',
              status: 'completed',
            },
          },
        ],
        error: null,
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await fetchPlayerAttendance(playerId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('attendance');
      expect(mockBuilder.eq).toHaveBeenCalledWith('player_id', playerId);
      expect(result[0]!.session).toBeDefined();
      expect(result[0]!.session.title).toBe('Morning Drill');
    });

    it('throws when the query returns an error', async () => {
      const mockBuilder = createMockBuilder({
        data: null,
        error: { message: 'RLS denied', code: '42501' },
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(fetchPlayerAttendance(playerId)).rejects.toThrow();
    });
  });

  describe('fetchBatchAttendance', () => {
    it('scopes the query by batch_id on training_sessions', async () => {
      const mockBuilder = createMockBuilder({
        data: [
          {
            id: sessionId,
            title: 'Morning Drill',
            session_date: '2026-01-01',
            start_at: '09:00',
            end_at: '10:00',
            status: 'completed',
            attendance: [{ id: 'x', player_id: playerId, status: 'present' }],
          },
        ],
        error: null,
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await fetchBatchAttendance(batchId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('training_sessions');
      expect(mockBuilder.eq).toHaveBeenCalledWith('batch_id', batchId);
      expect(result[0]!.sessionId).toBe(sessionId);
      expect(result[0]!.attendance).toHaveLength(1);
    });

    it('throws when the query returns an error', async () => {
      const mockBuilder = createMockBuilder({
        data: null,
        error: { message: 'RLS denied', code: '42501' },
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(fetchBatchAttendance(batchId)).rejects.toThrow();
    });
  });
});
