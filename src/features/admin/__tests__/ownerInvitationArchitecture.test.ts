import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getOwnerInvitationDetails,
  acceptOwnerInvitation,
  createAcademy,
  requestJoinByCode,
} from '@/features/academies/api/academiesApi';
import {
  createPlatformAcademy,
  regenerateOwnerInvitation,
  revokeOwnerInvitation,
} from '@/features/admin/api/adminApi';
import type { UUID } from '@/types';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabase/client';
const mockedSupabase = vi.mocked(supabase);

describe('Owner Invitation Architecture & Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Academy Creation Authorization', () => {
    it('allows Super Admin to create academy and receive owner invitation token', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: {
          id: 'acad-super-1',
          name: 'Elite Super Academy',
          slug: 'elite-super-academy',
          city: 'London',
          playerJoinCode: 'ELITE1',
          invitationId: 'inv-uuid-1',
          invitationToken: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
          invitationExpiresAt: '2026-08-24T12:00:00Z',
          createdAt: '2026-08-17T12:00:00Z',
        },
        error: null,
      } as never);

      const result = await createPlatformAcademy({
        name: 'Elite Super Academy',
        city: 'London',
        timezone: 'Asia/Kolkata',
        feeMode: 'player_pays',
      });

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('super_admin_create_academy_with_invite', {
        p_name: 'Elite Super Academy',
        p_city: 'London',
        p_contact_email: null,
        p_contact_phone: null,
        p_timezone: 'Asia/Kolkata',
        p_fee_mode: 'player_pays',
      });
      expect(result.id).toBe('acad-super-1');
      expect(result.invitationToken).toHaveLength(64);
      expect(result.playerJoinCode).toBe('ELITE1');
    });

    it('rejects normal user / coach / player attempting create_academy RPC directly', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'E_FORBIDDEN: Access restricted to platform super admins',
          code: '42501',
        },
      } as never);

      await expect(
        createAcademy({
          name: 'Unauthorized Academy',
          city: 'Mumbai',
        }),
      ).rejects.toThrow('E_FORBIDDEN: Access restricted to platform super admins');
    });

    it('rejects non-super-admin attempting super_admin_create_academy_with_invite directly', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'E_FORBIDDEN: Access restricted to platform super admins',
          code: '42501',
        },
      } as never);

      await expect(
        createPlatformAcademy({
          name: 'Unauthorized Academy',
        }),
      ).rejects.toThrow('E_FORBIDDEN: Access restricted to platform super admins');
    });
  });

  describe('Owner Invitation Lifecycle & Acceptance', () => {
    const rawToken = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

    it('retrieves public invitation details safely without exposing secrets', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: {
          isValid: true,
          status: 'pending',
          academyId: 'acad-super-1',
          academyName: 'Elite Super Academy',
          expiresAt: '2026-08-24T12:00:00Z',
          targetRole: 'academy_owner',
        },
        error: null,
      } as never);

      const details = await getOwnerInvitationDetails(rawToken);

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_owner_invitation_details', {
        p_token: rawToken,
      });
      expect(details.isValid).toBe(true);
      expect(details.status).toBe('pending');
      expect(details.academyName).toBe('Elite Super Academy');
      expect(details.targetRole).toBe('academy_owner');
      // Must not leak internal token hashes
      expect((details as unknown as Record<string, unknown>).tokenHash).toBeUndefined();
    });

    it('accepts valid invitation and atomically creates owner membership', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: {
          academyId: 'acad-super-1',
          academyName: 'Elite Super Academy',
          role: 'academy_owner',
          alreadyAccepted: false,
        },
        error: null,
      } as never);

      const res = await acceptOwnerInvitation(rawToken);

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('accept_owner_invitation', {
        p_token: rawToken,
      });
      expect(res.role).toBe('academy_owner');
      expect(res.academyId).toBe('acad-super-1');
      expect(res.academyName).toBe('Elite Super Academy');
    });

    it('rejects expired invitation', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'E_VALIDATION: This invitation has expired',
          code: '22023',
        },
      } as never);

      await expect(acceptOwnerInvitation(rawToken)).rejects.toThrow(
        'E_VALIDATION: This invitation has expired',
      );
    });

    it('rejects revoked invitation', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'E_VALIDATION: This invitation is no longer valid',
          code: '22023',
        },
      } as never);

      await expect(acceptOwnerInvitation(rawToken)).rejects.toThrow(
        'E_VALIDATION: This invitation is no longer valid',
      );
    });

    it('rejects already used invitation for different user', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'E_CONFLICT: This invitation has already been used',
          code: '23505',
        },
      } as never);

      await expect(acceptOwnerInvitation(rawToken)).rejects.toThrow(
        'E_CONFLICT: This invitation has already been used',
      );
    });

    it('rejects invalid / random tokens', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'E_NOT_FOUND: Invalid invitation token',
          code: 'P0002',
        },
      } as never);

      await expect(acceptOwnerInvitation('completely-invalid-token')).rejects.toThrow(
        'E_NOT_FOUND: Invalid invitation token',
      );
    });
  });

  describe('Invitation Regeneration & Revocation', () => {
    it('allows Super Admin to regenerate owner invitation and get new token', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: {
          invitationId: 'inv-uuid-2',
          invitationToken: 'new-token-hex-1234567890abcdef',
          invitationExpiresAt: '2026-08-25T12:00:00Z',
          academyId: 'acad-super-1',
        },
        error: null,
      } as never);

      const res = await regenerateOwnerInvitation('acad-super-1' as UUID);

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('regenerate_owner_invitation', {
        p_academy_id: 'acad-super-1',
      });
      expect(res.invitationToken).toBe('new-token-hex-1234567890abcdef');
    });

    it('allows Super Admin to revoke owner invitation', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: null,
        error: null,
      } as never);

      await revokeOwnerInvitation('inv-uuid-1' as UUID);

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('revoke_owner_invitation', {
        p_invitation_id: 'inv-uuid-1',
      });
    });
  });

  describe('Join Code Role Safeguard', () => {
    it('strictly prevents normal join code flow from ever granting Owner role', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'E_FORBIDDEN: Owner role cannot be requested via join codes',
          code: '42501',
        },
      } as never);

      await expect(requestJoinByCode('OWNER1')).rejects.toThrow(
        'E_FORBIDDEN: Owner role cannot be requested via join codes',
      );
    });

    it('allows players to request join with player role via code', async () => {
      mockedSupabase.rpc.mockResolvedValue({
        data: {
          id: 'req-1',
          academy_id: 'acad-1',
          requested_role: 'player',
          status: 'pending',
          created_at: '2026-08-17T12:00:00Z',
        },
        error: null,
      } as never);

      const req = await requestJoinByCode('PLY123', 'I am a wicketkeeper batsman');

      expect(req.requestedRole).toBe('player');
      expect(req.status).toBe('pending');
    });
  });
});
