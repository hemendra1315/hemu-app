/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createMockQueryBuilder } from '../../../test/supabaseQueryBuilder';

import {
  createTrainingSession,
  deleteTrainingSession,
  fetchAcademyTrainingSessions,
  fetchTrainingSession,
  updateTrainingSession,
} from './sessionsApi';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabase/client';
const mockedSupabase = vi.mocked(supabase);

// Shared with every other API test; see the note in that file for why this
// is centralised rather than redefined per suite.
const createMockBuilder = createMockQueryBuilder;

const academyId = '11111111-1111-1111-1111-111111111111';
const sessionId = '22222222-2222-2222-2222-222222222222';
const batchId = '33333333-3333-3333-3333-333333333333';
const coachId = '44444444-4444-4444-4444-444444444444';

describe('sessionsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchAcademyTrainingSessions', () => {
    it('scopes the query by academy_id', async () => {
      const mockBuilder = createMockBuilder({ data: [], error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await fetchAcademyTrainingSessions(academyId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('training_sessions');
      expect(mockBuilder.eq).toHaveBeenCalledWith('academy_id', academyId);
    });

    it('returns mapped sessions with batch and coach info', async () => {
      const mockBuilder = createMockBuilder({
        data: [
          {
            id: sessionId,
            academy_id: academyId,
            batch_id: batchId,
            title: 'Morning Practice',
            focus_area: 'Bowling',
            session_date: '2026-01-01',
            start_at: '09:00',
            end_at: '10:30',
            coach_id: coachId,
            status: 'scheduled',
            notes: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
            batch: { id: batchId, name: 'U16' },
            coach: {
              id: coachId,
              profiles: { full_name: 'Coach Smith', email: 'coach@test.com', avatar_url: null },
            },
          },
        ],
        error: null,
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await fetchAcademyTrainingSessions(academyId);

      expect(result).toHaveLength(1);
      expect(result[0]!.academyId).toBe(academyId);
      expect(result[0]!.batchId).toBe(batchId);
      expect(result[0]!.coachId).toBe(coachId);
      expect(result[0]!.batch.name).toBe('U16');
    });

    it('throws when the query returns an error', async () => {
      const mockBuilder = createMockBuilder({
        data: null,
        error: { message: 'RLS denied', code: '42501' },
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(fetchAcademyTrainingSessions(academyId)).rejects.toThrow();
    });
  });

  describe('fetchTrainingSession', () => {
    it('fetches by session id and maps the row', async () => {
      const mockBuilder = createMockBuilder({
        data: {
          id: sessionId,
          academy_id: academyId,
          batch_id: batchId,
          title: 'Practice',
          focus_area: 'Bowling',
          session_date: '2026-01-01',
          start_at: '09:00',
          end_at: '10:30',
          coach_id: coachId,
          status: 'scheduled',
          notes: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          batch: { id: batchId, name: 'U16' },
          coach: {
            id: coachId,
            profiles: { full_name: 'Coach', email: 'coach@test.com', avatar_url: null },
          },
        },
        error: null,
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await fetchTrainingSession(sessionId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('training_sessions');
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', sessionId);
      expect(result.id).toBe(sessionId);
      expect(result.academyId).toBe(academyId);
    });

    it('throws when the query returns an error', async () => {
      const mockBuilder = createMockBuilder({
        data: null,
        error: { message: 'Not found', code: 'P0002' },
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(fetchTrainingSession(sessionId)).rejects.toThrow();
    });
  });

  describe('createTrainingSession', () => {
    it('includes academy_id in the insert payload', async () => {
      const mockRow = {
        id: sessionId,
        academy_id: academyId,
        batch_id: batchId,
        title: 'Morning Practice',
        focus_area: 'Bowling',
        session_date: '2026-01-01',
        start_at: '09:00',
        end_at: '10:30',
        coach_id: coachId,
        status: 'scheduled',
        notes: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        batch: { id: batchId, name: 'U16' },
        coach: {
          id: coachId,
          profiles: { full_name: 'Coach Smith', email: 'coach@test.com', avatar_url: null },
        },
      };
      const mockBuilder = createMockBuilder({ data: mockRow, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await createTrainingSession({
        academyId,
        batchId,
        title: 'Morning Practice',
        focusArea: 'Bowling',
        sessionDate: '2026-01-01',
        startAt: '09:00',
        endAt: '10:30',
        coachId,
        status: 'scheduled',
        notes: null,
      });

      expect(result.academyId).toBe(academyId);
      expect(mockBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          academy_id: academyId,
          batch_id: batchId,
          title: 'Morning Practice',
          coach_id: coachId,
        }),
      );
    });

    it('throws when insert returns an error', async () => {
      const mockBuilder = createMockBuilder({
        data: null,
        error: { message: 'RLS denied', code: '42501' },
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(
        createTrainingSession({
          academyId,
          batchId,
          title: 'Test',
          focusArea: null,
          sessionDate: '2026-01-01',
          startAt: '09:00',
          endAt: '10:00',
          coachId,
          status: 'scheduled',
          notes: null,
        }),
      ).rejects.toThrow();
    });
  });

  describe('updateTrainingSession', () => {
    it('updates by session id with correct payload', async () => {
      const mockRow = {
        id: sessionId,
        academy_id: academyId,
        batch_id: batchId,
        title: 'Updated Practice',
        focus_area: 'Fielding',
        session_date: '2026-02-01',
        start_at: '10:00',
        end_at: '11:30',
        coach_id: coachId,
        status: 'scheduled',
        notes: 'Updated notes',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
        batch: { id: batchId, name: 'U16' },
        coach: {
          id: coachId,
          profiles: { full_name: 'Coach', email: 'coach@test.com', avatar_url: null },
        },
      };
      const mockBuilder = createMockBuilder({ data: mockRow, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await updateTrainingSession(sessionId, {
        batchId,
        title: 'Updated Practice',
        focusArea: 'Fielding',
        sessionDate: '2026-02-01',
        startAt: '10:00',
        endAt: '11:30',
        coachId,
        status: 'scheduled',
        notes: 'Updated notes',
      });

      expect(result.title).toBe('Updated Practice');
      expect(mockBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Updated Practice', focus_area: 'Fielding' }),
      );
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', sessionId);
    });

    it('throws when update returns an error', async () => {
      const mockBuilder = createMockBuilder({
        data: null,
        error: { message: 'RLS denied', code: '42501' },
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(
        updateTrainingSession(sessionId, {
          batchId,
          title: 'Test',
          focusArea: null,
          sessionDate: '2026-01-01',
          startAt: '09:00',
          endAt: '10:00',
          coachId,
          status: 'scheduled',
          notes: null,
        }),
      ).rejects.toThrow();
    });
  });

  describe('deleteTrainingSession', () => {
    it('deletes by session id', async () => {
      const mockBuilder = createMockBuilder({ data: null, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await deleteTrainingSession(sessionId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('training_sessions');
      expect(mockBuilder.delete).toHaveBeenCalled();
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', sessionId);
    });
  });
});
