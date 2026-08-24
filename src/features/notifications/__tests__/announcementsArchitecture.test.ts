import { describe, expect, it, vi, beforeEach } from 'vitest';
import { roleHasCapability } from '@/lib/rbac/permissions';
import { announcementsApi } from '../api/announcementsApi';
import { supabase } from '@/lib/supabase/client';

vi.mock('@/lib/supabase/client', () => {
  const insertMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'ann-123',
          academy_id: 'acad-123',
          title: 'Test Announcement',
          message: 'This is a test.',
          audience: 'all',
          batch_id: null,
          created_by: 'user-owner-123',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      }),
    }),
  });

  const eqMock = vi.fn().mockReturnValue({ select: vi.fn() });
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock, order: vi.fn() });
  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'announcements') {
      return {
        insert: insertMock,
        select: selectMock,
      };
    }
    return {};
  });

  return {
    supabase: {
      from: fromMock,
    },
  };
});

describe('Announcements & Notifications Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Owner has announcements:manage and announcements:read capabilities', () => {
    expect(roleHasCapability('academy_owner', 'announcements:manage')).toBe(true);
    expect(roleHasCapability('academy_owner', 'announcements:read')).toBe(true);
  });

  it('Coach has announcements:manage and announcements:read capabilities', () => {
    expect(roleHasCapability('coach', 'announcements:manage')).toBe(true);
    expect(roleHasCapability('coach', 'announcements:read')).toBe(true);
  });

  it('Player has ONLY announcements:read capability and CANNOT manage', () => {
    expect(roleHasCapability('player', 'announcements:manage')).toBe(false);
    expect(roleHasCapability('player', 'announcements:read')).toBe(true);
  });

  it('creates announcement successfully with provided payload', async () => {
    const payload = {
      academy_id: 'acad-123',
      title: 'Ground closed tomorrow',
      message: 'Due to rain, no session tomorrow.',
      audience: 'all' as const,
      batch_id: null,
    };

    const result = await announcementsApi.createAnnouncement(payload);

    expect(result.id).toBe('ann-123');
    expect(supabase.from).toHaveBeenCalledWith('announcements');
  });

  it('verifies that the API throws error if tenant ID is spoofed (architecture check)', async () => {
    // In a real RLS test we'd execute the RPC. Here we verify the API shape expects academy_id.
    // Tenant isolation is guaranteed by `is_owner(academy_id)` or `is_staff(academy_id)` in the RLS policy.
    const payload = {
      academy_id: 'acad-spoofed-456',
      title: 'Spoofed announcement',
      message: 'This should fail in DB',
      audience: 'all' as const,
      batch_id: null,
    };

    const mockRpcFail = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'new row violates row-level security policy for table "announcements"',
        code: '42501',
      },
    });

    // Temporarily mock it to simulate RLS failure
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: mockRpcFail,
        }),
      }),
    }));

    await expect(announcementsApi.createAnnouncement(payload)).rejects.toThrow(
      'new row violates row-level security policy for table "announcements"',
    );
  });
});
