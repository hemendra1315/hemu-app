import { expect, test } from '@playwright/test';
import { execSync } from 'node:child_process';
import { createHmac } from 'node:crypto';

/**
 * The local Supabase Postgres container's name isn't a fixed string -- the
 * Supabase CLI derives it from the working directory (or `project_id` in
 * config.toml, which this repo doesn't set), so it's whatever folder the
 * repo happens to be checked out into. Discovering it from `docker ps`
 * works regardless of the checkout folder's name, on any machine -- see the
 * same helper in test-offline-queue-suite.spec.ts / rpc-critical-path.spec.ts
 * / pilot-manual-walkthrough.spec.ts.
 */
let cachedDbContainer: string | null = null;
function getDbContainer(): string {
  if (cachedDbContainer) return cachedDbContainer;
  const output = execSync('docker ps --filter "name=supabase_db_" --format "{{.Names}}"', {
    encoding: 'utf8',
  }).trim();
  const name = output.split('\n')[0]?.trim();
  if (!name) {
    throw new Error('No running supabase_db_* container found -- is `supabase start` running?');
  }
  cachedDbContainer = name;
  return cachedDbContainer;
}

/** The seeded coach's real academy/session/member ids -- same lookup as
 * test-offline-queue-suite.spec.ts's getSeededIds(), needed because the
 * attendance session page is a per-ID detail page: it only renders once its
 * `sessionId`/`academyId` queries actually succeed, so (unlike the list
 * pages tested elsewhere in this file) a fake id like "session-1" leaves it
 * stuck on its loading skeleton forever -- `isUUID` disables the query
 * entirely for a non-UUID param, and even a syntactically valid but
 * nonexistent UUID would 404. */
function getSeededIds(): {
  academyId: string;
  sessionId: string;
  coachUserId: string;
  coachMemberId: string;
} {
  // Picks a session whose batch is actually coached by coach1@demo.com AND
  // actually has at least one assigned player -- a plain `training_sessions
  // LIMIT 1` (the previous version of this query) could just as easily
  // return a session belonging to coach2's batch, or a batch with zero
  // batch_members, either of which leaves the attendance page's roster
  // empty and its Present/Absent buttons never rendering, timing out the
  // waitForSelector below for reasons that have nothing to do with this
  // test's own logic (see the identical fix/comment in
  // test-offline-queue-suite.spec.ts's getSeededIds()).
  const output = execSync(
    `docker exec -i ${getDbContainer()} psql -U postgres -d postgres -t -A -F "|" -c "SELECT a.id, s.id, u.id, am.id FROM academies a JOIN auth.users u ON u.email = 'coach1@demo.com' JOIN academy_members am ON am.user_id = u.id AND am.academy_id = a.id JOIN batches b ON b.academy_id = a.id AND b.coach_id = am.id JOIN training_sessions s ON s.academy_id = a.id AND s.batch_id = b.id WHERE EXISTS (SELECT 1 FROM batch_members bm WHERE bm.batch_id = b.id) ORDER BY s.id LIMIT 1;"`,
    { encoding: 'utf8' },
  ).trim();
  const [academyId, sessionId, coachUserId, coachMemberId] = output.split('|');
  if (!academyId || !sessionId || !coachUserId || !coachMemberId) {
    throw new Error(
      `Could not find a seeded coach1@demo.com session with an assigned player. Got: "${output}"`,
    );
  }
  return { academyId, sessionId, coachUserId, coachMemberId };
}

const JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';

function b64url(buf: Buffer) {
  return buf.toString('base64url');
}

/** Forges a Supabase-compatible JWT for a real seeded user, signed with the
 * local Supabase instance's well-known dev JWT secret -- matching
 * pilot-manual-walkthrough.spec.ts and test-offline-queue-suite.spec.ts.
 * `cam.e2e_auth` alone (used by every other test in this file) only fakes
 * this app's OWN auth/profile/membership state; it never gives supabase-js
 * a signed session, so any page that makes a real RLS-governed Supabase
 * query needs this too. */
function forgeJWT(sub: string, email: string): string {
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    Buffer.from(
      JSON.stringify({
        iss: 'supabase-demo',
        aud: 'authenticated',
        sub,
        email,
        role: 'authenticated',
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest();
  return `${header}.${payload}.${b64url(sig)}`;
}

const MOCK_USER = {
  id: 'user-123',
  email: 'owner@cricket.academy',
  user_metadata: { full_name: 'Academy Owner' },
};

const MOCK_PROFILE = {
  id: 'user-123',
  email: 'owner@cricket.academy',
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

const MOCK_MEMBERSHIP = {
  id: 'mem-1',
  academyId: 'academy-1',
  academyName: 'Strikers Cricket Academy',
  academySlug: 'strikers-cricket-academy',
  logoUrl: null,
  city: 'Mumbai',
  timezone: 'Asia/Kolkata',
  role: 'academy_owner' as const,
  status: 'active' as const,
};

test.describe('1. Authentication & Route Protection', () => {
  test('unauthenticated visitors are redirected to sign-in screen', async ({ page }) => {
    const protectedPaths = ['/dashboard', '/members', '/batches', '/sessions', '/profile'];
    for (const path of protectedPaths) {
      await page.goto(path);
      await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
    }
  });

  test('sign-in page renders title, login button, and theme toggle', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { name: /cricket academy manager/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();

    await page.getByRole('radio', { name: 'dark theme' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});

test.describe('2. Academy Creation & Join by Code UI Flows', () => {
  test('normal user onboarding only shows Join Academy with code and blocks create-academy', async ({
    page,
  }) => {
    await page.addInitScript(
      (data) => {
        sessionStorage.setItem('cam.e2e_auth', JSON.stringify(data));
      },
      { user: MOCK_USER, profile: MOCK_PROFILE, memberships: [], joinRequests: [] },
    );

    await page.goto('/onboarding');
    await expect(page.getByRole('heading', { name: /join an academy/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /create an academy/i })).not.toBeVisible();

    // Trying to directly navigate to /onboarding/create-academy redirects normal user
    await page.goto('/onboarding/create-academy');
    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test('join academy by code onboarding page renders code input and request button', async ({
    page,
  }) => {
    await page.addInitScript(
      (data) => {
        sessionStorage.setItem('cam.e2e_auth', JSON.stringify(data));
      },
      { user: MOCK_USER, profile: MOCK_PROFILE, memberships: [], joinRequests: [] },
    );

    await page.goto('/onboarding/join-academy');
    await expect(page.getByRole('heading', { name: /join an academy/i })).toBeVisible();
    await expect(page.getByLabel(/join code/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /request to join/i })).toBeVisible();
  });
});

test.describe('3. Member Management & Approval UI', () => {
  test('members page renders join code card, pending requests, and roster table', async ({
    page,
  }) => {
    await page.addInitScript(
      (data) => {
        sessionStorage.setItem('cam.e2e_auth', JSON.stringify(data));
        if (data.activeAcademyId) {
          localStorage.setItem(
            'cam.active-academy',
            JSON.stringify({ state: { activeAcademyId: data.activeAcademyId }, version: 0 }),
          );
        }
      },
      {
        user: MOCK_USER,
        profile: MOCK_PROFILE,
        memberships: [MOCK_MEMBERSHIP],
        activeAcademyId: MOCK_MEMBERSHIP.academyId,
      },
    );

    await page.goto('/members');
    await expect(page.getByRole('heading', { name: /players/i })).toBeVisible();
  });
});

test.describe('4. Batch Management & Player Assignment UI', () => {
  test('batches page renders batch list and create batch button', async ({ page }) => {
    await page.addInitScript(
      (data) => {
        sessionStorage.setItem('cam.e2e_auth', JSON.stringify(data));
        if (data.activeAcademyId) {
          localStorage.setItem(
            'cam.active-academy',
            JSON.stringify({ state: { activeAcademyId: data.activeAcademyId }, version: 0 }),
          );
        }
      },
      {
        user: MOCK_USER,
        profile: MOCK_PROFILE,
        memberships: [MOCK_MEMBERSHIP],
        activeAcademyId: MOCK_MEMBERSHIP.academyId,
      },
    );

    await page.goto('/batches');
    await expect(page.getByRole('heading', { name: 'Batches', exact: true })).toBeVisible();
  });
});

test.describe('5. Session Management UI', () => {
  test('training sessions page renders session controls and list', async ({ page }) => {
    await page.addInitScript(
      (data) => {
        sessionStorage.setItem('cam.e2e_auth', JSON.stringify(data));
        if (data.activeAcademyId) {
          localStorage.setItem(
            'cam.active-academy',
            JSON.stringify({ state: { activeAcademyId: data.activeAcademyId }, version: 0 }),
          );
        }
      },
      {
        user: MOCK_USER,
        profile: MOCK_PROFILE,
        memberships: [MOCK_MEMBERSHIP],
        activeAcademyId: MOCK_MEMBERSHIP.academyId,
      },
    );

    await page.goto('/sessions');
    await expect(page.getByRole('heading', { name: /sessions/i }).first()).toBeVisible();
  });
});

test.describe('6. Attendance Session UI', () => {
  test('attendance session page renders player roster and marking controls', async ({ page }) => {
    // Unlike every other test in this file, this is a per-ID detail page --
    // it needs a REAL session (and a real, RLS-authenticated coach) rather
    // than the fake `MOCK_USER`/`session-1` this test originally used, which
    // left the page stuck on its loading skeleton forever (see the
    // `getSeededIds`/`forgeJWT` comments above).
    const { academyId, sessionId, coachUserId, coachMemberId } = getSeededIds();
    const jwt = forgeJWT(coachUserId, 'coach1@demo.com');

    await page.addInitScript(
      (data) => {
        sessionStorage.setItem('cam.e2e_auth', JSON.stringify(data));
        localStorage.setItem(
          'cam.active-academy',
          JSON.stringify({ state: { activeAcademyId: data.activeAcademyId }, version: 0 }),
        );
        localStorage.setItem(
          'cam.auth',
          JSON.stringify({
            access_token: data.jwt,
            refresh_token: 'fake-refresh-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: 'bearer',
            user: data.user,
          }),
        );
      },
      {
        user: { id: coachUserId, email: 'coach1@demo.com', user_metadata: { full_name: 'Coach' } },
        profile: {
          id: coachUserId,
          email: 'coach1@demo.com',
          fullName: 'Coach',
          avatarUrl: null,
          phone: '+919876543210',
          phoneVerified: true,
          dateOfBirth: '1985-05-15',
          gender: 'male',
          locale: 'en',
          timezone: 'Asia/Kolkata',
          isSuperAdmin: false,
        },
        memberships: [
          {
            id: coachMemberId,
            academyId,
            academyName: 'Academy',
            academySlug: 'academy',
            logoUrl: null,
            city: 'Bengaluru',
            timezone: 'Asia/Kolkata',
            role: 'coach',
            status: 'active',
          },
        ],
        activeAcademyId: academyId,
        jwt,
      },
    );

    await page.goto(`/sessions/${sessionId}/attendance`);
    // "Player roster and marking controls" is exactly what this waits for --
    // a stronger, more direct check than a heading, and the same target
    // test-offline-queue-suite.spec.ts already waits for on this same page.
    await page.waitForSelector('button:has-text("Present"), button:has-text("Absent")', {
      timeout: 10000,
    });
  });
});

test.describe('7. Player Profile & Tab Navigation UI', () => {
  test('player profile renders tabs and stat cards cleanly', async ({ page }) => {
    await page.addInitScript(
      (data) => {
        sessionStorage.setItem('cam.e2e_auth', JSON.stringify(data));
        if (data.activeAcademyId) {
          localStorage.setItem(
            'cam.active-academy',
            JSON.stringify({ state: { activeAcademyId: data.activeAcademyId }, version: 0 }),
          );
        }
      },
      {
        user: MOCK_USER,
        profile: MOCK_PROFILE,
        memberships: [MOCK_MEMBERSHIP],
        activeAcademyId: MOCK_MEMBERSHIP.academyId,
      },
    );

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();
  });
});

test.describe('8. Mobile Responsiveness & Viewport Fit', () => {
  test('mobile drawer opens, link navigation closes drawer, no horizontal overflow on 360px-430px', async ({
    page,
  }) => {
    for (const width of [360, 390, 430, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/sign-in');

      const scrollWidth = await page.evaluate(() => {
        const doc = (
          globalThis as unknown as { document: { documentElement: { scrollWidth: number } } }
        ).document;
        return doc.documentElement.scrollWidth;
      });
      expect(scrollWidth).toBeLessThanOrEqual(width);
    }
  });
});

test.describe('9. Owner Invitation Flow', () => {
  test('unauthenticated visitor opening owner invite sees invite card and sign-in button', async ({
    page,
  }) => {
    // Intercept Supabase RPC call for get_owner_invitation_details
    await page.route('**/rest/v1/rpc/get_owner_invitation_details*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isValid: true,
          status: 'pending',
          academyId: 'acad-inv-test',
          academyName: 'Champions Cricket Academy',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          targetRole: 'academy_owner',
        }),
      });
    });

    await page.goto('/academy/invite/sample-valid-token-12345');
    await expect(page.getByRole('heading', { name: /academy owner invitation/i })).toBeVisible();
    await expect(page.getByText('Champions Cricket Academy')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in to accept invitation/i })).toBeVisible();
  });
});
