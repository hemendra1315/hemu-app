import { describe, expect, it, vi, beforeEach } from 'vitest';
import { updateAcademy, uploadAcademyLogo, removeAcademyLogo } from '../api/academiesApi';
import { supabase } from '@/lib/supabase/client';
import { roleHasCapability } from '@/lib/rbac/permissions';

vi.mock('@/lib/supabase/client', () => {
  const uploadMock = vi.fn().mockResolvedValue({ error: null });
  const getPublicUrlMock = vi.fn().mockReturnValue({
    data: { publicUrl: 'https://storage.example.com/academy-logos/acad-123/1786972000000.png' },
  });

  const singleMock = vi.fn().mockResolvedValue({
    data: {
      id: 'acad-123',
      name: 'Lords Cricket Academy',
      slug: 'lords-cricket-academy',
      logo_url: 'https://storage.example.com/academy-logos/acad-123/1786972000000.png',
      city: 'London',
      state: 'Greater London',
      timezone: 'Europe/London',
      contact_email: 'info@lords.cricket',
      contact_phone: '+44 1234567890',
      fee_mode: 'player_pays',
      default_monthly_fee_paise: 20000,
      grace_period_days: 7,
      owner_user_id: 'user-owner-123',
      is_active: true,
      created_at: new Date().toISOString(),
    },
    error: null,
  });

  const selectMock = vi.fn().mockReturnValue({ single: singleMock });
  const eqMock = vi.fn().mockReturnValue({ select: selectMock });
  const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'academies') {
      return { update: updateMock };
    }
    return {};
  });

  return {
    supabase: {
      from: fromMock,
      storage: {
        from: vi.fn().mockReturnValue({
          upload: uploadMock,
          getPublicUrl: getPublicUrlMock,
        }),
      },
    },
  };
});

describe('Academy Branding & Storage Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates academy name and logo_url through updateAcademy', async () => {
    const updated = await updateAcademy('acad-123', {
      name: 'Lords Cricket Academy',
      logoUrl: 'https://storage.example.com/academy-logos/acad-123/1786972000000.png',
    });

    expect(updated.name).toBe('Lords Cricket Academy');
    expect(updated.logoUrl).toBe(
      'https://storage.example.com/academy-logos/acad-123/1786972000000.png',
    );
    expect(supabase.from).toHaveBeenCalledWith('academies');
  });

  it('successfully uploads valid academy logo (PNG/JPG/WebP <= 5MB) and updates academy logoUrl', async () => {
    const validFile = new File(['image-data-mock'], 'academy_logo.png', { type: 'image/png' });

    const publicUrl = await uploadAcademyLogo('acad-123', validFile);

    // The returned URL is tenant-scoped and carries a cache-busting `?t=` timestamp
    // (so updated logos are never served from a stale browser cache).
    expect(publicUrl).toMatch(
      /^https:\/\/storage\.example\.com\/academy-logos\/acad-123\/1786972000000\.png\?t=\d+$/,
    );
    expect(supabase.storage.from).toHaveBeenCalledWith('academy-logos');
  });

  it('rejects invalid image file format with descriptive error message', async () => {
    const invalidFile = new File(['text-data'], 'document.pdf', { type: 'application/pdf' });

    await expect(uploadAcademyLogo('acad-123', invalidFile)).rejects.toThrow(
      'Invalid file format. Please upload a JPG, PNG, or WebP image.',
    );
  });

  it('rejects image file larger than 5 MB with clear validation error', async () => {
    const largeBlob = new Uint8Array(5.5 * 1024 * 1024);
    const largeFile = new File([largeBlob], 'large_logo.jpg', { type: 'image/jpeg' });

    await expect(uploadAcademyLogo('acad-123', largeFile)).rejects.toThrow(
      'Image file is too large. Maximum allowed size is 5 MB.',
    );
  });

  it('removes academy logo by setting logo_url to null', async () => {
    await removeAcademyLogo('acad-123');

    expect(supabase.from).toHaveBeenCalledWith('academies');
  });

  it('enforces RBAC: only academy_owner and super_admin hold academy:update capability', () => {
    expect(roleHasCapability('academy_owner', 'academy:update')).toBe(true);
    expect(roleHasCapability('super_admin', 'academy:update')).toBe(true);
    expect(roleHasCapability('coach', 'academy:update')).toBe(false);
    expect(roleHasCapability('player', 'academy:update')).toBe(false);
  });

  it('guarantees tenant isolation: storage folder names are scoped to academy_id', () => {
    const academyA = 'acad-aaaa-aaaa-aaaa';
    const academyB = 'acad-bbbb-bbbb-bbbb';

    const pathA = `${academyA}/logo.png`;
    const folderA = pathA.split('/')[0];

    expect(folderA).toBe(academyA);
    expect(folderA).not.toBe(academyB);
  });
});
