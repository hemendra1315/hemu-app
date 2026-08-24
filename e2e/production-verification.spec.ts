import { expect, test, type Page } from '@playwright/test';

/**
 * PHASE 53 — MAXIMUM ADVERSARIAL PRODUCTION QA
 *
 * Runs against whatever E2E_BASE_URL points at (the deployed production app by
 * default, or `vite preview` locally) in a REAL Chromium browser. Uses the app's
 * own E2E auth affordance (`cam.e2e_auth` / `window.__E2E_SET_AUTH__` /
 * persisted `cam.active-academy`) to seed identity exactly the way the app's
 * AuthProvider + academy store persist it, then walks the real guards, stores,
 * bottom nav, routing and error handling.
 *
 * The Supabase REST/RPC layer is never reached with a malformed UUID: every
 * parameterized route is fuzzed and we assert (a) no raw Postgres error text in
 * the DOM, (b) no infinite loading, (c) no uncaught page error, and (d) the
 * malformed value never appears in a request URL.
 */

const UUID_A = 'aaaa0000-0000-4000-8000-0000000000a1';
const UUID_B = 'bbbb0000-0000-4000-8000-0000000000b2';
const UUID_C = 'cccc0000-0000-4000-8000-0000000000c3';
const MEMBER_1 = '11111111-1111-4111-8111-111111111111';
const MEMBER_2 = '22222222-2222-4222-8222-222222222222';

const baseProfile = (over: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-000000000000',
  email: 'identity@example.org',
  fullName: 'QA Identity',
  avatarUrl: null,
  phone: '+919876543210',
  phoneVerified: true,
  dateOfBirth: '1995-05-05',
  locale: 'en',
  timezone: 'Asia/Kolkata',
  isSuperAdmin: false,
  ...over,
});

const baseUser = (over: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-000000000000',
  email: 'identity@example.org',
  user_metadata: { full_name: 'QA Identity' },
  ...over,
});

const membership = (over: Record<string, unknown>) => ({
  id: MEMBER_1,
  userId: '00000000-0000-4000-8000-000000000000',
  academyId: UUID_A,
  academyName: 'Academy A',
  academySlug: 'academy-a',
  slug: 'academy-a',
  logoUrl: null,
  city: 'Mumbai',
  timezone: 'Asia/Kolkata',
  role: 'player',
  status: 'active',
  joinedAt: '2025-01-01T00:00:00Z',
  ...over,
});

interface Seed {
  user: unknown;
  profile: unknown;
  memberships: unknown[];
  joinRequests?: unknown[];
  activeAcademyId?: string | null;
  testModeRole?: 'student' | 'coach' | 'academy_owner' | null;
}

function seedAuth(page: Page, data: Seed) {
  const payload = {
    user: data.user,
    profile: data.profile,
    memberships: data.memberships,
    joinRequests: data.joinRequests ?? [],
    activeAcademyId: data.activeAcademyId,
    testModeRole: data.testModeRole,
  };
  return page.addInitScript(
    ({ payload, activeAcademyId, testModeRole }) => {
      if (sessionStorage.getItem('cam.logged_out') === 'true') {
        return;
      }
      const existingStored = localStorage.getItem('cam.active-academy');
      let targetAcademyId = activeAcademyId;
      if (existingStored) {
        try {
          const parsed = JSON.parse(existingStored);
          if (parsed?.state?.activeAcademyId) {
            targetAcademyId = parsed.state.activeAcademyId;
          }
        } catch {
          // ignore
        }
      }

      sessionStorage.setItem(
        'cam.e2e_auth',
        JSON.stringify({ ...payload, activeAcademyId: targetAcademyId }),
      );
      if (window.__E2E_SET_AUTH__) {
        window.__E2E_SET_AUTH__({ ...payload, activeAcademyId: targetAcademyId, testModeRole });
      }
      if (targetAcademyId) {
        localStorage.setItem(
          'cam.active-academy',
          JSON.stringify({ state: { activeAcademyId: targetAcademyId }, version: 0 }),
        );
      } else {
        localStorage.removeItem('cam.active-academy');
      }
    },
    { payload, activeAcademyId: data.activeAcademyId, testModeRole: data.testModeRole },
  );
}

const SUPER_ADMIN_PROFILE = baseProfile({ isSuperAdmin: true });
const OWNER_PROFILE = baseProfile();
const COACH_PROFILE = baseProfile();
const STUDENT_PROFILE = baseProfile();

const SUPER = (activeAcademyId?: string | null, memberships: Array<Record<string, unknown>> = []) =>
  ({
    user: baseUser(),
    profile: SUPER_ADMIN_PROFILE,
    memberships,
    activeAcademyId,
  }) as Seed;

const OWNER = (academyId: string = UUID_A) =>
  ({
    user: baseUser({ id: MEMBER_1 }),
    profile: { ...OWNER_PROFILE, id: MEMBER_1 },
    memberships: [membership({ id: MEMBER_1, academyId, role: 'academy_owner' })],
    activeAcademyId: academyId,
  }) as Seed;

const COACH = (academyId: string = UUID_A) =>
  ({
    user: baseUser({ id: MEMBER_2 }),
    profile: { ...COACH_PROFILE, id: MEMBER_2 },
    memberships: [membership({ id: MEMBER_2, academyId, role: 'coach' })],
    activeAcademyId: academyId,
  }) as Seed;

const STUDENT = (academyId: string = UUID_A) =>
  ({
    user: baseUser({ id: MEMBER_2 }),
    profile: { ...STUDENT_PROFILE, id: MEMBER_2 },
    memberships: [membership({ id: MEMBER_2, academyId, role: 'player' })],
    activeAcademyId: academyId,
  }) as Seed;

const RAW_DB_MARKERS = [
  'invalid input syntax',
  'syntax for type uuid',
  'permission denied for',
  'permission denied to',
  'relation "',
  'relation does not exist',
  'table does not exist',
  'PostgREST',
  'postgres error',
  'database error',
  'rpc/',
];

function attachAudit(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const requestUrls: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e)));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('requestfailed', (r) => failedRequests.push(`${r.method()} ${r.url()}`));
  page.on('request', (r) => requestUrls.push(r.url()));
  return { pageErrors, consoleErrors, failedRequests, requestUrls };
}

async function expectNoRawDbError(page: Page) {
  const body = (await page.locator('body').innerText()).toLowerCase();
  for (const marker of RAW_DB_MARKERS) {
    expect(body, `DOM leaked raw DB text: "${marker}"`).not.toContain(marker);
  }
}

async function expectNotStuckOnLoading(page: Page) {
  await page.waitForTimeout(1500);
  const body = (await page.locator('body').innerText()).toLowerCase();
  expect(body).not.toContain('checking your session');
  expect(body).not.toContain('loading your academies');
  expect(body).not.toContain('setting things up');
  expect(body).not.toContain('completing sign-in');
}

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `horizontal overflow: ${scrollWidth} > ${clientWidth}`).toBeLessThanOrEqual(
    clientWidth,
  );
}

test.describe('1. Unauthenticated access control', () => {
  const protectedPaths = ['/dashboard', '/members', '/batches', '/sessions', '/profile', '/admin'];

  for (const path of protectedPaths) {
    test(`anonymous visitor to ${path} lands on /sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible({
        timeout: 15000,
      });
    });
  }

  test('legacy /signin and /login alias to /sign-in', async ({ page }) => {
    for (const path of ['/signin', '/login']) {
      await page.goto(path);
      await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible({
        timeout: 15000,
      });
    }
  });

  test('unknown route renders a friendly page, not a raw error', async ({ page }) => {
    await page.goto('/totally/unknown/route');
    await page.waitForTimeout(1000);
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).not.toContain('relation "');
    expect(body).not.toContain('invalid input syntax');
  });
});

test.describe('2. Malformed URL fuzzing (super admin, academy A active)', () => {
  const badParams = ['abc', 'not-a-uuid', 'demo-player-id', 'super-admin-virtual'];

  const routes = [
    (p: string) => `/matches/${p}`,
    (p: string) => `/sessions/${p}`,
    (p: string) => `/batches/${p}`,
    (p: string) => `/members/${p}`,
    (p: string) => `/members/${p}/attendance`,
    (p: string) => `/drills/${p}`,
    (p: string) => `/sessions/${p}/attendance`,
    (p: string) => `/batches/${p}/attendance`,
  ];

  for (const makeRoute of routes) {
    for (const bad of badParams) {
      const url = makeRoute(encodeURIComponent(bad));
      test(`${url} → no raw DB error, no infinite loading, no crash`, async ({ page }) => {
        const audit = attachAudit(page);
        await seedAuth(page, SUPER(UUID_A, []));
        await page.goto('/dashboard');
        await expect(page.locator('html')).not.toContainText('checking your session', {
          timeout: 15000,
        });
        await page.goto(url);
        await page.waitForTimeout(1800);

        await expectNoRawDbError(page);
        await expectNotStuckOnLoading(page);
        expect(audit.pageErrors, `page errors: ${audit.pageErrors.join('; ')}`).toEqual([]);

        const raw = decodeURIComponent(bad);
        const sent = audit.requestUrls.filter(
          (u) => (u.includes('/rest/v1/') || u.includes('/auth/v1/')) && u.includes(raw),
        );
        expect(
          sent,
          `malformed value "${raw}" leaked to Supabase API in ${sent.length} request(s)`,
        ).toEqual([]);
      });
    }
  }
});

test.describe('3. Role home + bottom navigation (mobile)', () => {
  const widths = [320, 375, 390, 430];

  async function expectNav(page: Page, items: string[]) {
    for (const label of items) {
      await expect(
        page.locator('nav[aria-label="Mobile Bottom Navigation"]').getByText(label),
      ).toBeVisible();
    }
  }

  for (const width of widths) {
    test(`owner @ ${width}px → Players beside Home; Settings directly visible`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await seedAuth(page, OWNER());
      await page.goto('/dashboard');
      await expect(page.locator('nav[aria-label="Mobile Bottom Navigation"]')).toBeVisible();
      await expectNav(page, ['Players', 'Sessions', 'Settings', 'More']);
      await expectNoHorizontalOverflow(page);
    });

    test(`super admin (academy active) @ ${width}px → Players, Sessions, Settings, More`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await seedAuth(page, SUPER(UUID_A, []));
      await page.goto('/dashboard');
      await expect(page.locator('nav[aria-label="Mobile Bottom Navigation"]')).toBeVisible();
      await expectNav(page, ['Players', 'Sessions', 'Settings', 'More']);
      await expectNoHorizontalOverflow(page);
    });

    test(`coach @ ${width}px → Home, Players, Batches, Sessions, More`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await seedAuth(page, COACH());
      await page.goto('/coach');
      await expect(page.locator('nav[aria-label="Mobile Bottom Navigation"]')).toBeVisible();
      await expectNav(page, ['Home', 'Players', 'Batches', 'Sessions', 'More']);
      await expectNoHorizontalOverflow(page);
    });

    test(`student @ ${width}px → Home, Sessions, Matches, Profile, More`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await seedAuth(page, STUDENT());
      await page.goto('/player');
      await expect(page.locator('nav[aria-label="Mobile Bottom Navigation"]')).toBeVisible();
      await expectNav(page, ['Home', 'Sessions', 'Matches', 'Profile', 'More']);
      await expectNoHorizontalOverflow(page);
    });
  }
});

test.describe('4. Super admin academy state survives refresh', () => {
  test('active academy persists across reload and dashboard stays accessible', async ({ page }) => {
    const audit = attachAudit(page);
    await seedAuth(page, SUPER(UUID_B, []));
    await page.goto('/dashboard');
    await page.waitForTimeout(1500);
    expect(page.url()).toContain('/dashboard');

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('cam.active-academy') ?? '{}'),
    );
    expect(stored.state?.activeAcademyId).toBe(UUID_B);

    // Reload → state must survive (isSuperAdmin + activeAcademyId set).
    await page.reload();
    await page.goto('/dashboard');
    await page.waitForTimeout(1500);
    expect(page.url()).toContain('/dashboard');
    const reloaded = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('cam.active-academy') ?? '{}'),
    );
    expect(reloaded.state?.activeAcademyId).toBe(UUID_B);
    await expectNoRawDbError(page);
    expect(audit.pageErrors, `page errors: ${audit.pageErrors.join('; ')}`).toEqual([]);

    // Switch B → C → A → B by updating the persisted store and active academy.
    for (const next of [UUID_C, UUID_A, UUID_B]) {
      await page.evaluate((id) => {
        localStorage.setItem(
          'cam.active-academy',
          JSON.stringify({ state: { activeAcademyId: id }, version: 0 }),
        );
        const auth = JSON.parse(sessionStorage.getItem('cam.e2e_auth') ?? '{}');
        auth.activeAcademyId = id;
        sessionStorage.setItem('cam.e2e_auth', JSON.stringify(auth));
      }, next);
      await page.goto('/dashboard');
      await page.waitForTimeout(1200);
      const current = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('cam.active-academy') ?? '{}'),
      );
      expect(current.state?.activeAcademyId).toBe(next);
      expect(page.url()).toContain('/dashboard');
    }
  });

  test('super admin without an academy lands on /admin', async ({ page }) => {
    await seedAuth(page, SUPER(null, []));
    await page.goto('/');
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
  });
});

test.describe('5. Test App As — Owner / Coach / Student', () => {
  test('owner test mode is reachable on /dashboard with bottom nav', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const audit = attachAudit(page);
    await seedAuth(page, { ...SUPER(UUID_A, []), testModeRole: 'academy_owner' });
    await page.goto('/dashboard');
    await page.waitForTimeout(1500);
    expect(page.url()).toContain('/dashboard');
    await expect(page.locator('nav[aria-label="Mobile Bottom Navigation"]')).toBeVisible();
    await expectNoRawDbError(page);
    expect(audit.pageErrors, `page errors: ${audit.pageErrors.join('; ')}`).toEqual([]);
  });

  test('coach test mode lands on /coach with coach nav', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const audit = attachAudit(page);
    await seedAuth(page, { ...SUPER(UUID_A, []), testModeRole: 'coach' });
    await page.goto('/coach');
    await page.waitForTimeout(1500);
    expect(page.url()).toContain('/coach');
    await expect(
      page.locator('nav[aria-label="Mobile Bottom Navigation"]').getByText('Batches'),
    ).toBeVisible();
    await expectNoRawDbError(page);
    expect(audit.pageErrors, `page errors: ${audit.pageErrors.join('; ')}`).toEqual([]);
  });

  test('student test mode lands on /player with student nav', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const audit = attachAudit(page);
    await seedAuth(page, { ...SUPER(UUID_A, []), testModeRole: 'student' });
    await page.goto('/player');
    await page.waitForTimeout(1500);
    expect(page.url()).toContain('/player');
    await expect(
      page.locator('nav[aria-label="Mobile Bottom Navigation"]').getByText('Profile'),
    ).toBeVisible();
    await expectNoRawDbError(page);
    expect(audit.pageErrors, `page errors: ${audit.pageErrors.join('; ')}`).toEqual([]);
  });
});

test.describe('6. Logout & no auth resurrection', () => {
  test('logout from More reaches /sign-in and later direct hits are blocked', async ({ page }) => {
    const audit = attachAudit(page);
    await seedAuth(page, OWNER());
    await page.goto('/more');
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible({
      timeout: 15000,
    });

    await page.evaluate(() => {
      sessionStorage.setItem('cam.logged_out', 'true');
      sessionStorage.removeItem('cam.e2e_auth');
      localStorage.clear();
    });

    for (const path of ['/dashboard', '/settings/academy', '/admin', '/profile', '/more']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sign-in/, { timeout: 15000 });
    }
    expect(audit.pageErrors, `page errors: ${audit.pageErrors.join('; ')}`).toEqual([]);
  });

  test('logout from AppShell header reaches /sign-in', async ({ page }) => {
    await seedAuth(page, OWNER());
    await page.goto('/dashboard');
    const signOut = page.getByRole('button', { name: /sign out/i });
    if (await signOut.isVisible().catch(() => false)) {
      await signOut.click();
      await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible({
        timeout: 15000,
      });
    } else {
      await page.goto('/more');
      await page.getByRole('button', { name: /sign out/i }).click();
      await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible({
        timeout: 15000,
      });
    }
  });
});

test.describe('7. Profile & onboarding guard', () => {
  test('incomplete profile routes to /onboarding/profile', async ({ page }) => {
    const profile = baseProfile({ phoneVerified: false, phone: null, dateOfBirth: null });
    await seedAuth(page, {
      user: baseUser({ id: MEMBER_1 }),
      profile: { ...profile, id: MEMBER_1 },
      memberships: [],
      joinRequests: [],
      activeAcademyId: null,
    });
    await page.goto('/');
    await expect(page).toHaveURL(/\/onboarding\/profile/, { timeout: 15000 });
  });

  test('sign-in initiates the Supabase Google OAuth redirect', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: /continue with google/i }).click();
    await page.waitForTimeout(4000);
    const url = page.url();
    expect(url).not.toMatch(/\/sign-in$/);
  });
});

test.describe('8. Console & network audit on major screens', () => {
  const screens = ['/dashboard', '/members', '/batches', '/sessions', '/matches', '/stats'];
  for (const path of screens) {
    test(`${path} (owner) does not emit uncaught errors`, async ({ page }) => {
      const audit = attachAudit(page);
      await seedAuth(page, OWNER());
      await page.goto(path);
      await page.waitForTimeout(1800);
      expect(audit.pageErrors, `page errors: ${audit.pageErrors.join('; ')}`).toEqual([]);
      await expectNoRawDbError(page);
    });
  }
});
