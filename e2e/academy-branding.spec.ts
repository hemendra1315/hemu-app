import { test, expect, type Page } from '@playwright/test';

const UUID_USER = '11111111-1111-4111-8111-111111111111';
const UUID_ACADEMY = 'aaaa0000-0000-4000-8000-0000000000a1';
const UUID_MEMBERSHIP = '22222222-2222-4222-8222-222222222222';

const MOCK_OWNER_USER = {
  id: UUID_USER,
  email: 'owner@branding-demo.com',
  user_metadata: { full_name: 'Academy Owner' },
};

const MOCK_OWNER_PROFILE = {
  id: UUID_USER,
  email: 'owner@branding-demo.com',
  fullName: 'Academy Owner',
  avatarUrl: null,
  phone: '+919876543210',
  phoneVerified: true,
  dateOfBirth: '1990-01-01',
  gender: 'male',
  locale: 'en',
  timezone: 'Asia/Kolkata',
  isSuperAdmin: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const MOCK_BRANDED_MEMBERSHIP = {
  id: UUID_MEMBERSHIP,
  userId: UUID_USER,
  academyId: UUID_ACADEMY,
  academyName: 'Apex Cricket Academy',
  academySlug: 'apex-cricket-academy',
  logoUrl: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=128&h=128&fit=crop',
  city: 'Mumbai',
  timezone: 'Asia/Kolkata',
  role: 'academy_owner' as const,
  status: 'active' as const,
  joinedAt: '2026-01-01T00:00:00Z',
};

function seedAuth(page: Page, overMembership: Record<string, unknown> = {}) {
  const currentMembership = { ...MOCK_BRANDED_MEMBERSHIP, ...overMembership };
  return page.addInitScript(
    ({ user, profile, membership, academyId }) => {
      const payload = {
        user,
        profile,
        memberships: [membership],
        joinRequests: [],
        activeAcademyId: academyId,
      };

      sessionStorage.setItem('cam.e2e_auth', JSON.stringify(payload));
      if (window.__E2E_SET_AUTH__) {
        window.__E2E_SET_AUTH__(payload);
      }
      localStorage.setItem(
        'cam.active-academy',
        JSON.stringify({ state: { activeAcademyId: academyId }, version: 0 }),
      );
    },
    {
      user: MOCK_OWNER_USER,
      profile: MOCK_OWNER_PROFILE,
      membership: currentMembership,
      academyId: currentMembership.academyId,
    },
  );
}

test.describe('Phase 1 & 2: Academy Branding & Mobile-First CAM Experience', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test('1. Academy branding is visible in header, switcher, and owner dashboard', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Academy name is rendered in header and dashboard
    await expect(page.locator('text=Apex Cricket Academy').first()).toBeVisible();

    // Verify no raw URL string is rendered on screen
    const pageBody = await page.innerText('body');
    expect(pageBody).not.toContain('https://images.unsplash.com');
  });

  test('2. Academy Settings renders Academy Branding section with upload controls and NO raw URL input', async ({
    page,
  }) => {
    await page.goto('/settings/academy');
    await page.waitForLoadState('networkidle');

    // Verify Academy Branding card is visible
    await expect(page.getByRole('heading', { name: 'Academy Branding' })).toBeVisible();

    // Verify Upload/Change Logo button exists
    const uploadBtn = page.getByRole('button', { name: /upload logo|change logo/i });
    await expect(uploadBtn).toBeVisible();

    // Ensure there is NO text input for pasting raw logo URLs
    const logoUrlInputs = page.locator(
      'input[name="logoUrl"], input[placeholder*="http"], input[placeholder*="logo url"]',
    );
    await expect(logoUrlInputs).toHaveCount(0);
  });

  test('3. Mobile viewports have zero horizontal overflow across key dimensions (375px, 390px, 430px)', async ({
    page,
  }) => {
    const viewports = [
      { width: 375, height: 812, name: 'iPhone Mini / SE' },
      { width: 390, height: 844, name: 'iPhone 13/14' },
      { width: 430, height: 932, name: 'iPhone 14/15 Pro Max' },
    ];

    const testRoutes = ['/dashboard', '/settings/academy', '/members', '/batches', '/sessions'];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const route of testRoutes) {
        await page.goto(route);
        await page.waitForLoadState('networkidle');

        const isOverflowing = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });

        expect(
          isOverflowing,
          `Route ${route} overflowed horizontally at ${vp.width}px (${vp.name})`,
        ).toBe(false);
      }
    }
  });

  test('4. Avatar error fallback smoothly handles broken logo URLs without rendering broken image icons', async ({
    page,
  }) => {
    await seedAuth(page, {
      academyName: 'Broken Logo Academy',
      logoUrl: 'https://broken-invalid-domain-xyz.com/nonexistent.png',
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Academy initials fallback 'BL' should be visible
    await expect(page.locator('text=Broken Logo Academy').first()).toBeVisible();
    await expect(page.locator('text=BL').first()).toBeVisible();
  });
});
