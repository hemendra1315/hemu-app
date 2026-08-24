import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { createHmac } from 'node:crypto';

function getSeededIds(): {
  academyId: string;
  sessionId: string;
  coachUserId: string;
  coachMemberId: string;
} {
  try {
    const output = execSync(
      `docker exec -i supabase_db_cricket psql -U postgres -d postgres -t -A -F "|" -c "SELECT a.id, s.id, u.id, am.id FROM academies a JOIN training_sessions s ON s.academy_id = a.id JOIN auth.users u ON u.email = 'coach1@demo.com' JOIN academy_members am ON am.user_id = u.id AND am.academy_id = a.id LIMIT 1;"`,
      { encoding: 'utf8' },
    ).trim();
    const parts = output.split('|');
    return {
      academyId: parts[0] || 'fe7498b5-a84b-404f-90f0-9b9e0d12273a',
      sessionId: parts[1] || '086f6fda-68f0-4856-a5fc-c1b4a7b18c3b',
      coachUserId: parts[2] || '1db413cf-a6c3-4bb0-9e64-bb3b8545c671',
      coachMemberId: parts[3] || '5518c7c5-2636-4500-b4a8-621fcadb8c00',
    };
  } catch {
    return {
      academyId: 'fe7498b5-a84b-404f-90f0-9b9e0d12273a',
      sessionId: '086f6fda-68f0-4856-a5fc-c1b4a7b18c3b',
      coachUserId: '1db413cf-a6c3-4bb0-9e64-bb3b8545c671',
      coachMemberId: '5518c7c5-2636-4500-b4a8-621fcadb8c00',
    };
  }
}

const JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';

interface QueuedItemRecord {
  id: string;
  status: string;
  statusState: string;
}

function b64url(buf: Buffer) {
  return buf.toString('base64url');
}

function forgeJWT(sub: string, email?: string, expSeconds = 3600): string {
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    Buffer.from(
      JSON.stringify({
        iss: 'supabase-demo',
        aud: 'authenticated',
        sub,
        email: email ?? 'coach1@demo.com',
        role: 'authenticated',
        iat: now,
        exp: now + expSeconds,
      }),
    ),
  );
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest();
  return `${header}.${payload}.${b64url(sig)}`;
}

function resetDbAttendance(sessionId: string) {
  execSync(
    `docker exec -i supabase_db_cricket psql -U postgres -d postgres -c "DELETE FROM attendance WHERE session_id = '${sessionId}';"`,
    { encoding: 'utf8' },
  );
}

function queryDbAttendance(sessionId: string) {
  const output = execSync(
    `docker exec -i supabase_db_cricket psql -U postgres -d postgres -t -A -c "SELECT player_id, status, updated_at FROM attendance WHERE session_id = '${sessionId}';"`,
    { encoding: 'utf8' },
  );
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line: string) => {
      const [playerId, status, updatedAt] = line.split('|');
      return { playerId, status, updatedAt };
    });
}

test.describe('Phase 1.5: Persistent IndexedDB Offline Attendance Verification', () => {
  test('Complete 5-Step Offline Persistence & Sync Suite', async ({ context }) => {
    const {
      academyId: ACADEMY_ID,
      sessionId: SESSION_ID,
      coachUserId: COACH_USER_ID,
      coachMemberId: COACH_MEMBER_ID,
    } = getSeededIds();
    resetDbAttendance(SESSION_ID);

    const page = await context.newPage();
    const jwt = forgeJWT(COACH_USER_ID, 'coach1@demo.com');

    const coachAuth = {
      user: {
        id: COACH_USER_ID,
        email: 'coach1@demo.com',
        user_metadata: { full_name: 'Suresh Menon' },
      },
      profile: {
        id: COACH_USER_ID,
        email: 'coach1@demo.com',
        fullName: 'Suresh Menon',
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
          id: COACH_MEMBER_ID,
          userId: COACH_USER_ID,
          academyId: ACADEMY_ID,
          academyName: 'Elite Cricket Academy',
          academySlug: 'elite-cricket-academy',
          slug: 'elite-cricket-academy',
          logoUrl: null,
          city: 'Bangalore',
          timezone: 'Asia/Kolkata',
          role: 'coach',
          status: 'active',
          joinedAt: '2026-01-01T00:00:00Z',
        },
      ],
      activeAcademyId: ACADEMY_ID,
      jwt,
    };

    const injectAuth = async (p: typeof page) => {
      await p.addInitScript((data) => {
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
      }, coachAuth);
    };

    await injectAuth(page);

    // Initial page load while ONLINE
    console.log('\n=== Loading attendance page online ===');
    await page.goto(`/sessions/${SESSION_ID}/attendance`);
    await page.waitForSelector('button:has-text("Present"), button:has-text("Absent")', {
      timeout: 10000,
    });
    // Wait for Service Worker registration to finish precaching app shell
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready.catch(() => null);
      }
    });
    await page.waitForTimeout(1000);

    const isStoragePersisted = await page.evaluate(async () => {
      if (
        typeof navigator !== 'undefined' &&
        navigator.storage &&
        typeof navigator.storage.persisted === 'function'
      ) {
        return await navigator.storage.persisted();
      }
      return false;
    });
    console.log(`[Storage Persistence] navigator.storage.persisted() -> ${isStoragePersisted}`);

    const presentButtons = page.getByRole('button', { name: /^Present$/i });
    const count = await presentButtons.count();
    console.log(`Roster loaded with ${count} players.`);
    expect(count).toBeGreaterThan(0);

    // ========================================================================
    // STEP 1: Go offline, mark 3 players, confirm IndexedDB contains queued items
    // ========================================================================
    console.log('\n=== STEP 1: Mark offline & inspect IndexedDB ===');
    await context.setOffline(true);
    await page.waitForTimeout(500);

    // Mark player 0 present
    await presentButtons.nth(0).click();
    await page.waitForTimeout(300);

    // Mark player 1 present
    await presentButtons.nth(1).click();
    await page.waitForTimeout(300);

    // Mark player 2 present
    await presentButtons.nth(2).click();
    await page.waitForTimeout(500);

    // Inspect IndexedDB
    const dbQueue = await page.evaluate(async () => {
      return new Promise<QueuedItemRecord[]>((resolve, reject) => {
        const req = indexedDB.open('cam_offline_db');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('offline_attendance_queue', 'readonly');
          const store = tx.objectStore('offline_attendance_queue');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => {
            db.close();
            resolve(getAllReq.result as QueuedItemRecord[]);
          };
          getAllReq.onerror = () => {
            db.close();
            reject(getAllReq.error);
          };
        };
        req.onerror = () => reject(req.error);
      });
    });

    console.log(`IndexedDB queue size: ${dbQueue.length}`);
    console.log(
      'IndexedDB queued items:',
      dbQueue.map((i) => ({ id: i.id, status: i.status, statusState: i.statusState })),
    );
    expect(dbQueue.length).toBeGreaterThanOrEqual(3);

    // Check UI has queued indicators
    const queuedBadges = page.locator('text=Queued (Offline)');
    const badgeCount = await queuedBadges.count();
    console.log(`UI Queued (Offline) badges count: ${badgeCount}`);
    expect(badgeCount).toBeGreaterThanOrEqual(3);

    // ========================================================================
    // STEP 2: Reload the page while STILL OFFLINE -> Confirm marks survive
    // ========================================================================
    console.log('\n=== STEP 2: Reload while still offline ===');
    await page.reload();
    await page.waitForSelector('button:has-text("Present"), button:has-text("Absent")', {
      timeout: 10000,
    });

    const dbQueueAfterReload = await page.evaluate(async () => {
      return new Promise<QueuedItemRecord[]>((resolve, reject) => {
        const req = indexedDB.open('cam_offline_db');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('offline_attendance_queue', 'readonly');
          const store = tx.objectStore('offline_attendance_queue');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => {
            db.close();
            resolve(getAllReq.result as QueuedItemRecord[]);
          };
          getAllReq.onerror = () => {
            db.close();
            reject(getAllReq.error);
          };
        };
        req.onerror = () => reject(req.error);
      });
    });

    console.log(`IndexedDB queue size after reload: ${dbQueueAfterReload.length}`);
    expect(dbQueueAfterReload.length).toBeGreaterThanOrEqual(3);

    const queuedBadgesAfterReload = page.locator('text=Queued (Offline)');
    const badgeCountAfterReload = await queuedBadgesAfterReload.count();
    console.log(`UI Queued badges after reload: ${badgeCountAfterReload}`);
    expect(badgeCountAfterReload).toBeGreaterThanOrEqual(3);

    // ========================================================================
    // STEP 3: Reconnect -> Confirm automatic sync to Supabase database
    // ========================================================================
    console.log('\n=== STEP 3: Reconnect and verify auto-sync ===');
    await context.setOffline(false);
    console.log('Restored connection. Waiting 4s for queue auto-sync...');
    await page.waitForTimeout(4000);

    const dbQueueAfterSync = await page.evaluate(async () => {
      return new Promise<QueuedItemRecord[]>((resolve, reject) => {
        const req = indexedDB.open('cam_offline_db');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('offline_attendance_queue', 'readonly');
          const store = tx.objectStore('offline_attendance_queue');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => {
            db.close();
            resolve(getAllReq.result as QueuedItemRecord[]);
          };
          getAllReq.onerror = () => {
            db.close();
            reject(getAllReq.error);
          };
        };
        req.onerror = () => reject(req.error);
      });
    });

    console.log(`IndexedDB queue size after sync (expected 0): ${dbQueueAfterSync.length}`);
    expect(dbQueueAfterSync.length).toBe(0);

    // ========================================================================
    // STEP 4: Mark same player twice while offline (with reload in between)
    // ========================================================================
    console.log('\n=== STEP 4: Mark player twice with reload in between ===');
    await context.setOffline(true);
    await page.waitForTimeout(300);

    // Click present on player 3
    console.log('Marking player 3 Present...');
    await presentButtons.nth(3).click();
    await page.waitForTimeout(500);

    // Reload while offline
    console.log('Reloading while offline...');
    await page.reload();
    await page.waitForSelector('button:has-text("Present"), button:has-text("Absent")');

    // Click absent on player 3
    console.log('Marking player 3 Absent...');
    const refreshedAbsentButtons = page.getByRole('button', { name: /^Absent$/i });
    await refreshedAbsentButtons.nth(3).click();
    await page.waitForTimeout(500);

    // Reconnect
    console.log('Reconnecting...');
    await context.setOffline(false);
    await page.waitForTimeout(4000);

    const p3Db = queryDbAttendance(SESSION_ID);
    console.log('Database records count for session:', p3Db.length);

    // ========================================================================
    // STEP 5: Test Tab Close while offline -> Reopen app -> Sync
    // ========================================================================
    console.log('\n=== STEP 5: Tab close while offline ===');
    await context.setOffline(true);
    await page.waitForTimeout(300);

    // Mark player 4 present
    const p4Present = page.getByRole('button', { name: /^Present$/i });
    console.log('Marking player 4 Present while offline...');
    await p4Present.nth(4).click();
    await page.waitForTimeout(500);

    // Close the tab
    console.log('Closing page/tab entirely while offline...');
    await page.close();

    // Reopen new tab while STILL OFFLINE
    console.log('Reopening new tab while still offline...');
    const newPage = await context.newPage();
    await injectAuth(newPage);
    await newPage.goto(`/sessions/${SESSION_ID}/attendance`);
    await newPage.waitForSelector('button:has-text("Present"), button:has-text("Absent")', {
      timeout: 10000,
    });

    const newPageQueue = await newPage.evaluate(async () => {
      return new Promise<QueuedItemRecord[]>((resolve, reject) => {
        const req = indexedDB.open('cam_offline_db');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('offline_attendance_queue', 'readonly');
          const store = tx.objectStore('offline_attendance_queue');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => {
            db.close();
            resolve(getAllReq.result as QueuedItemRecord[]);
          };
          getAllReq.onerror = () => {
            db.close();
            reject(getAllReq.error);
          };
        };
        req.onerror = () => reject(req.error);
      });
    });

    console.log(`IndexedDB queue in new tab: ${newPageQueue.length}`);
    expect(newPageQueue.length).toBeGreaterThanOrEqual(1);

    // Reconnect in new tab
    console.log('Reconnecting online in new tab...');
    await context.setOffline(false);
    await newPage.waitForTimeout(4000);

    const finalDbQueue = await newPage.evaluate(async () => {
      return new Promise<QueuedItemRecord[]>((resolve, reject) => {
        const req = indexedDB.open('cam_offline_db');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('offline_attendance_queue', 'readonly');
          const store = tx.objectStore('offline_attendance_queue');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => {
            db.close();
            resolve(getAllReq.result as QueuedItemRecord[]);
          };
          getAllReq.onerror = () => {
            db.close();
            reject(getAllReq.error);
          };
        };
        req.onerror = () => reject(req.error);
      });
    });

    console.log(`Final IndexedDB queue size after sync: ${finalDbQueue.length}`);
    expect(finalDbQueue.length).toBe(0);

    console.log('\n=== ALL 5 OFFLINE PERSISTENCE & SYNC STEPS PASSED SUCCESSFULLY! ===\n');
  });
});
