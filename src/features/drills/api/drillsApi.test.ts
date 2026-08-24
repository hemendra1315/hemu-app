/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  assignDrill,
  createDrill,
  deleteDrill,
  deleteDrillAssignment,
  fetchAcademyDrills,
  fetchDrillAssignments,
  fetchPlayerDrillAssignments,
  updateDrill,
  updateDrillAssignment,
} from './drillsApi';

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

type SupabaseQueryBuilder = any;

function createMockBuilder(response: { data: any; error: any }): SupabaseQueryBuilder {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(response),
    then: (onfulfilled?: (val: any) => any, onrejected?: (reason: any) => any) =>
      Promise.resolve(response).then(onfulfilled, onrejected),
  };
  return builder;
}

const academyId = '11111111-1111-1111-1111-111111111111';
const drillId = '22222222-2222-2222-2222-222222222222';
const assignmentId = '33333333-3333-3333-3333-333333333333';
const playerId = '44444444-4444-4444-4444-444444444444';
const batchId = '55555555-5555-5555-5555-555555555555';

describe('drillsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchAcademyDrills', () => {
    it('scopes the query by academy_id', async () => {
      const mockBuilder = createMockBuilder({ data: [], error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await fetchAcademyDrills(academyId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('drills');
      expect(mockBuilder.eq).toHaveBeenCalledWith('academy_id', academyId);
    });

    it('throws when the query returns an error', async () => {
      const mockBuilder = createMockBuilder({
        data: null,
        error: { message: 'RLS denied', code: '42501' },
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(fetchAcademyDrills(academyId)).rejects.toThrow();
    });
  });

  describe('createDrill', () => {
    it('includes academy_id in the insert payload', async () => {
      const mockRow = {
        id: drillId,
        academy_id: academyId,
        name: 'Bowling Drill',
        category: 'bowling',
        description: 'Test',
        duration_minutes: 30,
        difficulty: 'intermediate',
        created_by: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      const mockBuilder = createMockBuilder({ data: mockRow, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await createDrill({
        academyId,
        name: 'Bowling Drill',
        category: 'bowling',
        description: 'Test',
        durationMinutes: 30,
        difficulty: 'intermediate',
      });

      expect(result.academyId).toBe(academyId);
      expect(mockBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          academy_id: academyId,
          name: 'Bowling Drill',
          category: 'bowling',
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
        createDrill({
          academyId,
          name: 'Test',
          category: 'batting',
          description: null,
          durationMinutes: 20,
          difficulty: 'beginner',
        }),
      ).rejects.toThrow();
    });
  });

  describe('updateDrill', () => {
    it('updates by drill id', async () => {
      const mockRow = {
        id: drillId,
        academy_id: academyId,
        name: 'Updated Drill',
        category: 'fielding',
        description: 'Updated',
        duration_minutes: 45,
        difficulty: 'advanced',
        created_by: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      const mockBuilder = createMockBuilder({ data: mockRow, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await updateDrill(drillId, {
        name: 'Updated Drill',
        category: 'fielding',
        description: 'Updated',
        durationMinutes: 45,
        difficulty: 'advanced',
      });

      expect(result.name).toBe('Updated Drill');
      expect(mockBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated Drill', category: 'fielding' }),
      );
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', drillId);
    });

    it('throws when update returns an error', async () => {
      const mockBuilder = createMockBuilder({
        data: null,
        error: { message: 'RLS denied', code: '42501' },
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(
        updateDrill(drillId, {
          name: 'Test',
          category: 'batting',
          description: null,
          durationMinutes: 20,
          difficulty: 'beginner',
        }),
      ).rejects.toThrow();
    });
  });

  describe('deleteDrill', () => {
    it('deletes by drill id', async () => {
      const mockBuilder = createMockBuilder({ data: null, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await deleteDrill(drillId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('drills');
      expect(mockBuilder.delete).toHaveBeenCalled();
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', drillId);
    });
  });

  describe('fetchDrillAssignments', () => {
    it('scopes the query by academy_id', async () => {
      const mockBuilder = createMockBuilder({ data: [], error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await fetchDrillAssignments(academyId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('drill_assignments');
      expect(mockBuilder.eq).toHaveBeenCalledWith('academy_id', academyId);
    });
  });

  describe('fetchPlayerDrillAssignments', () => {
    it('scopes by both academy_id and player_id', async () => {
      const mockBuilder = createMockBuilder({ data: [], error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await fetchPlayerDrillAssignments(playerId, academyId);

      expect(mockBuilder.eq).toHaveBeenCalledWith('academy_id', academyId);
      expect(mockBuilder.eq).toHaveBeenCalledWith('player_id', playerId);
    });
  });

  describe('assignDrill', () => {
    it('inserts with academy_id', async () => {
      const mockRow = {
        id: assignmentId,
        academy_id: academyId,
        drill_id: drillId,
        academy_member_id: playerId,
        batch_id: batchId,
        status: 'assigned',
        assigned_at: '2026-01-01T00:00:00Z',
        due_date: null,
        created_by: null,
        updated_at: '2026-01-01T00:00:00Z',
        drill: {
          id: drillId,
          name: 'Test',
          category: 'batting',
          description: null,
          duration_minutes: null,
          difficulty: 'beginner',
        },
        batch: { id: batchId, name: 'U16' },
        player: {
          id: playerId,
          profiles: { full_name: null, email: 'p@test.com', avatar_url: null },
        },
      };
      const mockBuilder = createMockBuilder({ data: mockRow, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await assignDrill({
        academyId,
        drillId,
        playerId,
        batchId,
        dueDate: null,
        status: 'assigned',
      });

      expect(result.academyId).toBe(academyId);
      expect(mockBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ academy_id: academyId }),
      );
    });
  });

  describe('updateDrillAssignment', () => {
    it('updates by assignment id', async () => {
      const mockRow = {
        id: assignmentId,
        academy_id: academyId,
        drill_id: drillId,
        academy_member_id: playerId,
        batch_id: batchId,
        status: 'completed',
        assigned_at: '2026-01-01T00:00:00Z',
        due_date: null,
        created_by: null,
        updated_at: '2026-01-01T00:00:00Z',
        drill: {
          id: drillId,
          name: 'Test',
          category: 'batting',
          description: null,
          duration_minutes: null,
          difficulty: 'beginner',
        },
        batch: { id: batchId, name: 'U16' },
        player: {
          id: playerId,
          profiles: { full_name: null, email: 'p@test.com', avatar_url: null },
        },
      };
      const mockBuilder = createMockBuilder({ data: mockRow, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await updateDrillAssignment(assignmentId, { status: 'completed', dueDate: null });

      expect(mockBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' }),
      );
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', assignmentId);
    });
  });

  describe('deleteDrillAssignment', () => {
    it('deletes by assignment id', async () => {
      const mockBuilder = createMockBuilder({ data: null, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await deleteDrillAssignment(assignmentId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('drill_assignments');
      expect(mockBuilder.delete).toHaveBeenCalled();
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', assignmentId);
    });
  });
});
