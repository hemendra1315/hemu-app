/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createMockQueryBuilder } from '../../../test/supabaseQueryBuilder';

import {
  addPlayerToBatch,
  createBatch,
  deleteBatch,
  fetchAcademyBatches,
  fetchBatchAvailablePlayers,
  fetchBatchPlayers,
  removePlayerFromBatch,
  updateBatch,
} from './batchesApi';

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
const batchId = '22222222-2222-2222-2222-222222222222';

describe('batchesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchAcademyBatches', () => {
    it('scopes the query by academy_id', async () => {
      const mockBuilder = createMockBuilder({ data: [], error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await fetchAcademyBatches(academyId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('batches');
      expect(mockBuilder.eq).toHaveBeenCalledWith('academy_id', academyId);
    });

    it('returns an empty array when no batches exist', async () => {
      const mockBuilder = createMockBuilder({ data: [], error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await fetchAcademyBatches(academyId);
      expect(result).toEqual([]);
    });

    it('throws when the Supabase call returns an error', async () => {
      const mockBuilder = createMockBuilder({
        data: null,
        error: { message: 'RLS denied', code: '42501' },
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(fetchAcademyBatches(academyId)).rejects.toThrow();
      expect(mockBuilder.select).toHaveBeenCalled();
    });
  });

  describe('fetchBatchPlayers', () => {
    it('scopes the query by batch_id', async () => {
      const mockBuilder = createMockBuilder({ data: [], error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await fetchBatchPlayers(batchId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('batch_members');
      expect(mockBuilder.eq).toHaveBeenCalledWith('batch_id', batchId);
    });
  });

  describe('createBatch', () => {
    const mockRow = {
      id: batchId,
      academy_id: academyId,
      name: 'U16',
      age_group: 'U16',
      description: null,
      training_days: null,
      training_time: null,
      coach_id: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      batch_members: [{ count: 0 }],
    };

    it('includes academy_id in the insert payload', async () => {
      const mockBuilder = createMockBuilder({ data: mockRow, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await createBatch({ academyId, name: 'U16', ageGroup: 'U16' });

      expect(result.academyId).toBe(academyId);
      expect(mockedSupabase.from).toHaveBeenCalledWith('batches');
      expect(mockBuilder.insert).toHaveBeenCalled();
    });

    it('throws when insert returns an error', async () => {
      const mockBuilder = createMockBuilder({
        data: null,
        error: { message: 'conflict', code: '23505' },
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(createBatch({ academyId, name: 'U16', ageGroup: 'U16' })).rejects.toThrow();
    });

    it('converts empty strings to null for optional fields', async () => {
      const mockBuilder = createMockBuilder({ data: mockRow, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await createBatch({
        academyId,
        name: 'U16',
        ageGroup: 'U16',
        description: '',
        trainingDays: '',
        trainingTime: '',
        coachId: '',
      });

      expect(mockBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          academy_id: academyId,
          description: null,
          training_days: null,
          training_time: null,
          coach_id: null,
        }),
      );
    });

    it('sends training_days as an array, not the display string (text[] column)', async () => {
      const mockBuilder = createMockBuilder({ data: mockRow, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await createBatch({
        academyId,
        name: 'U16',
        ageGroup: 'U16',
        trainingDays: 'Mon, Wed, Fri',
      });

      expect(mockBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ training_days: ['Mon', 'Wed', 'Fri'] }),
      );
    });
  });

  describe('updateBatch', () => {
    it('scopes the update by batch id and includes changed fields', async () => {
      const mockRow = {
        id: batchId,
        academy_id: academyId,
        name: 'U16 Updated',
        age_group: 'U16',
        description: null,
        training_days: null,
        training_time: null,
        coach_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      const mockBuilder = createMockBuilder({ data: mockRow, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await updateBatch(batchId, { name: 'U16 Updated', ageGroup: 'U16' });

      expect(mockedSupabase.from).toHaveBeenCalledWith('batches');
      expect(mockBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'U16 Updated' }),
      );
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', batchId);
    });

    it('sends training_days as an array, not the display string (text[] column)', async () => {
      const mockRow = {
        id: batchId,
        academy_id: academyId,
        name: 'U16 Updated',
        age_group: 'U16',
        description: null,
        training_days: ['Mon', 'Wed', 'Fri'],
        training_time: null,
        coach_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      const mockBuilder = createMockBuilder({ data: mockRow, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await updateBatch(batchId, {
        name: 'U16 Updated',
        ageGroup: 'U16',
        trainingDays: 'Mon, Wed, Fri',
      });

      expect(mockBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ training_days: ['Mon', 'Wed', 'Fri'] }),
      );
    });

    it('throws when update returns an error', async () => {
      const mockBuilder = createMockBuilder({
        data: null,
        error: { message: 'RLS denied', code: '42501' },
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(updateBatch(batchId, { name: 'U16', ageGroup: 'U16' })).rejects.toThrow();
    });
  });

  describe('deleteBatch', () => {
    it('deletes by batch id', async () => {
      const mockBuilder = createMockBuilder({ data: null, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await deleteBatch(batchId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('batches');
      expect(mockBuilder.delete).toHaveBeenCalled();
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', batchId);
    });
  });

  describe('fetchBatchAvailablePlayers', () => {
    it('scopes the query by academy_id and status=active', async () => {
      const mockBuilder = createMockBuilder({ data: [], error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await fetchBatchAvailablePlayers(academyId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('academy_members');
      expect(mockBuilder.eq).toHaveBeenCalledWith('academy_id', academyId);
      expect(mockBuilder.eq).toHaveBeenCalledWith('status', 'active');
    });
  });

  describe('addPlayerToBatch', () => {
    it('inserts with correct batch_id and academy_member_id', async () => {
      const memberId = '33333333-3333-3333-3333-333333333333';
      const mockBuilder = createMockBuilder({ data: { id: 'x' }, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await addPlayerToBatch(batchId, memberId);

      expect(mockBuilder.insert).toHaveBeenCalledWith({
        batch_id: batchId,
        academy_member_id: memberId,
      });
    });

    it('throws when insert returns an error', async () => {
      const mockBuilder = createMockBuilder({
        data: null,
        error: { message: 'duplicate', code: '23505' },
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(addPlayerToBatch(batchId, 'member-id')).rejects.toThrow();
    });
  });

  describe('removePlayerFromBatch', () => {
    it('deletes by batch_members.id', async () => {
      const mockBuilder = createMockBuilder({ data: null, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await removePlayerFromBatch(batchId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('batch_members');
      expect(mockBuilder.delete).toHaveBeenCalled();
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', batchId);
    });
  });
});
