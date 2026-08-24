import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UUID } from '@/types';
import {
  createPlatformAcademy,
  deletePlatformAcademy,
  fetchPlatformAcademies,
  fetchPlatformAcademyDetails,
  fetchPlatformAnalytics,
  fetchPlatformUsers,
  regenerateOwnerInvitation,
  revokeOwnerInvitation,
  superAdminAddMember,
  superAdminSeedAcademyDemoData,
  type CreatePlatformAcademyPayload,
} from './adminApi';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabase/client';
const mockedSupabase = vi.mocked(supabase);

describe('adminApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchPlatformAnalytics', () => {
    it('calls get_platform_analytics RPC and returns metrics', async () => {
      const mockMetrics = {
        totalAcademies: 10,
        activeAcademies: 8,
        totalUsers: 250,
        totalPlayers: 200,
        totalCoaches: 20,
        totalOwners: 10,
        totalMatches: 85,
        totalSessions: 140,
      };

      mockedSupabase.rpc.mockResolvedValue({ data: mockMetrics, error: null } as never);

      const result = await fetchPlatformAnalytics();

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_platform_analytics');
      expect(result).toEqual(mockMetrics);
    });

    it('throws error when RPC returns an error', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Unauthorized' },
      } as never);

      await expect(fetchPlatformAnalytics()).rejects.toEqual({ message: 'Unauthorized' });
    });
  });

  describe('fetchPlatformAcademies', () => {
    it('calls get_platform_academies RPC and returns academy list', async () => {
      const mockAcademies = [
        {
          id: 'acad-1',
          name: 'Elite Cricket Academy',
          slug: 'elite-cricket',
          playerCount: 45,
          coachCount: 3,
        },
      ];

      mockedSupabase.rpc.mockResolvedValue({ data: mockAcademies, error: null } as never);

      const result = await fetchPlatformAcademies();

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_platform_academies');
      expect(result).toEqual(mockAcademies);
    });

    it('returns empty array when RPC data is null', async () => {
      mockedSupabase.rpc.mockResolvedValue({ data: null, error: null } as never);

      const result = await fetchPlatformAcademies();
      expect(result).toEqual([]);
    });

    it('throws error when RPC fails', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      } as never);

      await expect(fetchPlatformAcademies()).rejects.toEqual({
        message: 'Database connection failed',
      });
    });
  });

  describe('fetchPlatformUsers', () => {
    it('calls get_platform_users RPC and returns user list', async () => {
      const mockUsers = [
        {
          id: 'u-1',
          fullName: 'Coach John',
          email: 'john@cricket.app',
          isSuperAdmin: false,
          memberships: [{ academyId: 'acad-1', role: 'coach', status: 'active' }],
        },
      ];

      mockedSupabase.rpc.mockResolvedValue({ data: mockUsers, error: null } as never);

      const result = await fetchPlatformUsers();

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_platform_users');
      expect(result).toEqual(mockUsers);
    });

    it('returns empty array if data is null', async () => {
      mockedSupabase.rpc.mockResolvedValue({ data: null, error: null } as never);
      const result = await fetchPlatformUsers();
      expect(result).toEqual([]);
    });

    it('throws error on RPC error', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Access denied' },
      } as never);
      await expect(fetchPlatformUsers()).rejects.toEqual({ message: 'Access denied' });
    });
  });

  describe('fetchPlatformAcademyDetails', () => {
    it('calls get_platform_academy_details with academyId', async () => {
      const academyId = 'acad-123' as UUID;
      const mockDetails = {
        academy: { id: academyId, name: 'Apex Cricket', slug: 'apex' },
        members: [{ id: 'm-1', role: 'player' }],
        batches: [{ id: 'b-1', name: 'Morning' }],
        matches: [{ id: 'match-1', matchName: 'Derby' }],
      };

      mockedSupabase.rpc.mockResolvedValue({ data: mockDetails, error: null } as never);

      const result = await fetchPlatformAcademyDetails(academyId);

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_platform_academy_details', {
        p_academy_id: academyId,
      });
      expect(result).toEqual(mockDetails);
    });

    it('throws error when details RPC fails', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Academy not found' },
      } as never);
      await expect(fetchPlatformAcademyDetails('acad-invalid' as UUID)).rejects.toEqual({
        message: 'Academy not found',
      });
    });
  });

  describe('createPlatformAcademy', () => {
    it('calls super_admin_create_academy_with_invite RPC with payload', async () => {
      const payload: CreatePlatformAcademyPayload = {
        name: 'New Academy',
        city: 'Mumbai',
        contactEmail: 'contact@academy.com',
        contactPhone: '9876543210',
      };
      mockedSupabase.rpc.mockResolvedValue({
        data: {
          id: 'acad-new',
          name: 'New Academy',
          invitationToken: 'tok123',
          playerJoinCode: 'PLY123',
        },
        error: null,
      } as never);

      const result = await createPlatformAcademy(payload);

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('super_admin_create_academy_with_invite', {
        p_name: payload.name,
        p_city: payload.city,
        p_contact_email: payload.contactEmail,
        p_contact_phone: payload.contactPhone,
        p_timezone: 'Asia/Kolkata',
        p_fee_mode: 'player_pays',
      });
      expect(result).toEqual({
        id: 'acad-new',
        name: 'New Academy',
        invitationToken: 'tok123',
        playerJoinCode: 'PLY123',
      });
    });

    it('handles null optional fields', async () => {
      const payload: CreatePlatformAcademyPayload = {
        name: 'Minimal Academy',
      };
      mockedSupabase.rpc.mockResolvedValue({
        data: {
          id: 'acad-min',
          name: 'Minimal Academy',
          invitationToken: 'tok456',
          playerJoinCode: 'PLY456',
        },
        error: null,
      } as never);

      await createPlatformAcademy(payload);

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('super_admin_create_academy_with_invite', {
        p_name: payload.name,
        p_city: null,
        p_contact_email: null,
        p_contact_phone: null,
        p_timezone: 'Asia/Kolkata',
        p_fee_mode: 'player_pays',
      });
    });

    it('throws error when create fails', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Slug already taken' },
      } as never);
      await expect(createPlatformAcademy({ name: 'Duplicate' })).rejects.toThrow(
        'Slug already taken',
      );
    });
  });

  describe('regenerateOwnerInvitation', () => {
    it('calls regenerate_owner_invitation RPC with academy id', async () => {
      const academyId = 'acad-123' as UUID;
      mockedSupabase.rpc.mockResolvedValue({
        data: {
          invitationId: 'inv-1',
          invitationToken: 'new-tok-123',
          invitationExpiresAt: '2026-08-24T00:00:00Z',
          academyId: 'acad-123',
        },
        error: null,
      } as never);

      const result = await regenerateOwnerInvitation(academyId);

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('regenerate_owner_invitation', {
        p_academy_id: academyId,
      });
      expect(result.invitationToken).toBe('new-tok-123');
    });

    it('throws error when regenerate fails', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Unauthorized' },
      } as never);
      await expect(regenerateOwnerInvitation('acad-123' as UUID)).rejects.toThrow('Unauthorized');
    });
  });

  describe('revokeOwnerInvitation', () => {
    it('calls revoke_owner_invitation RPC with invitation id', async () => {
      const invitationId = 'inv-del' as UUID;
      mockedSupabase.rpc.mockResolvedValue({ data: null, error: null } as never);

      await revokeOwnerInvitation(invitationId);

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('revoke_owner_invitation', {
        p_invitation_id: invitationId,
      });
    });

    it('throws error when revoke fails', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      } as never);
      await expect(revokeOwnerInvitation('inv-del' as UUID)).rejects.toThrow('Not found');
    });
  });

  describe('deletePlatformAcademy', () => {
    it('calls delete_platform_academy RPC with academy id', async () => {
      const academyId = 'acad-del' as UUID;
      mockedSupabase.rpc.mockResolvedValue({ data: null, error: null } as never);

      await deletePlatformAcademy(academyId);

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('delete_platform_academy', {
        p_academy_id: academyId,
      });
    });

    it('throws error when deletion fails', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Cannot delete active academy' },
      } as never);
      await expect(deletePlatformAcademy('acad-del' as UUID)).rejects.toEqual({
        message: 'Cannot delete active academy',
      });
    });
  });

  describe('superAdminAddMember & throwRpcError handling', () => {
    it('successfully adds member via super_admin_add_member RPC', async () => {
      const payload = {
        academyId: 'acad-1' as UUID,
        fullName: 'New Trainee',
        role: 'player' as const,
        email: 'trainee@cricket.app',
        phone: '+919999999999',
        batchId: 'batch-1',
      };

      const mockResponse = {
        id: 'mem-new',
        academyId: payload.academyId,
        userId: 'u-trainee',
        role: payload.role,
        fullName: payload.fullName,
        email: payload.email,
      };

      mockedSupabase.rpc.mockResolvedValue({ data: mockResponse, error: null } as never);

      const result = await superAdminAddMember(payload);

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('super_admin_add_member', {
        p_academy_id: payload.academyId,
        p_full_name: payload.fullName,
        p_role: payload.role,
        p_email: payload.email,
        p_phone: payload.phone,
        p_batch_id: payload.batchId,
      });
      expect(result).toEqual(mockResponse);
    });

    it('formats error with details, hint, code when super_admin_add_member fails', async () => {
      const rpcError = {
        message: 'User already a member of this academy',
        details: 'Unique constraint violated on (academy_id, user_id)',
        hint: 'Remove or reactivate existing membership',
        code: '23505',
      };

      mockedSupabase.rpc.mockResolvedValue({ data: null, error: rpcError } as never);

      await expect(
        superAdminAddMember({
          academyId: 'acad-1' as UUID,
          fullName: 'Duplicate',
          role: 'player',
        }),
      ).rejects.toThrow('User already a member of this academy');
    });
  });

  describe('superAdminSeedAcademyDemoData & throwRpcError handling', () => {
    it('seeds academy demo data via super_admin_seed_academy_demo_data RPC', async () => {
      const academyId = 'acad-seed' as UUID;
      mockedSupabase.rpc.mockResolvedValue({
        data: { status: 'seeded', playersCount: 15 },
        error: null,
      } as never);

      const result = await superAdminSeedAcademyDemoData(academyId);

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('super_admin_seed_academy_demo_data', {
        p_academy_id: academyId,
      });
      expect(result).toEqual({ status: 'seeded', playersCount: 15 });
    });

    it('handles seeding error through throwRpcError', async () => {
      const rpcError = {
        message: 'Academy already seeded',
        code: 'P0001',
      };

      mockedSupabase.rpc.mockResolvedValue({ data: null, error: rpcError } as never);

      await expect(superAdminSeedAcademyDemoData('acad-seed' as UUID)).rejects.toThrow(
        'Academy already seeded',
      );
    });
  });
});
