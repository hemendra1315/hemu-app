import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression guard for round 13 bug #46.
 *
 * Announcements reported success and wrote their in-app notification rows, but
 * no push ever reached any device on any platform. The browser was refusing to
 * send the request to `send-push-notification` at all: the function's CORS
 * preflight response omitted `Access-Control-Allow-Methods` (required for a
 * JSON POST, which is not CORS-safelisted) and its `Access-Control-Allow-Headers`
 * didn't cover `x-application-name`, a header this app's Supabase client
 * attaches to every request. Either omission alone is fatal, and both fail
 * silently — the server logs show a 200 OPTIONS and simply no POST.
 *
 * A running-browser test is the only way to *prove* CORS behaviour, and that
 * isn't available in this suite. What is checkable, and what would have caught
 * the original bug, is the contract in the source: the function must advertise
 * the POST method, and must not go back to a hardcoded header allow-list that
 * can drift out of sync with whatever headers the client actually sends.
 */

// Paths are resolved from the project root (vitest's cwd) rather than
// `__dirname`, which ESM does not define.
const EDGE_FUNCTION = resolve('supabase/functions/send-push-notification/index.ts');
const SUPABASE_CLIENT = resolve('src/lib/supabase/client.ts');
const NATIVE_PUSH = resolve('src/lib/push/nativePush.ts');

describe('send-push-notification CORS contract (bug #46)', () => {
  const source = readFileSync(EDGE_FUNCTION, 'utf8');

  it('advertises POST in Access-Control-Allow-Methods', () => {
    // Without this the browser silently drops the real request after a
    // successful preflight, which reads in the logs as "never called".
    expect(source).toMatch(/'Access-Control-Allow-Methods':\s*'[^']*POST/);
  });

  it('echoes the headers each preflight asks for rather than a fixed list', () => {
    expect(source).toContain('Access-Control-Request-Headers');
  });

  it('permits every custom header the Supabase client sends, even via the fallback list', () => {
    const clientSource = readFileSync(SUPABASE_CLIENT, 'utf8');

    // Pull the client's `global: { headers: {...} }` block and read the header
    // names out of it, so adding a header there without allowing it here fails
    // this test instead of silently killing push dispatch in production.
    const globalHeaders = clientSource.match(/global:\s*\{\s*headers:\s*\{([^}]*)\}/s);
    expect(globalHeaders, 'could not locate global headers on the Supabase client').not.toBeNull();

    const headerNames = [...globalHeaders![1].matchAll(/'([\w-]+)'\s*:/g)].map((m) =>
      m[1].toLowerCase(),
    );
    expect(headerNames.length).toBeGreaterThan(0);

    for (const name of headerNames) {
      expect(
        source.toLowerCase(),
        `edge function must allow the '${name}' header the client sends`,
      ).toContain(name);
    }
  });
});

/**
 * Regression guard for the same round's native-push schema contract.
 *
 * Android rows are distinguished from Web Push rows by `platform`, and carry
 * an `fcm_token` instead of the `p256dh`/`auth` pair. If a row is written
 * without `platform`, the database default silently makes it a web row and the
 * edge function tries to send it through the Web Push path, where it fails
 * quietly rather than loudly.
 */
describe('native push subscription shape', () => {
  const nativePush = readFileSync(NATIVE_PUSH, 'utf8');

  it("tags its rows as platform 'android'", () => {
    expect(nativePush).toMatch(/platform:\s*'android'/);
  });

  it('stores the FCM token', () => {
    expect(nativePush).toMatch(/fcm_token:/);
  });

  it('deletes only android rows when unsubscribing, leaving web subscriptions alone', () => {
    expect(nativePush).toMatch(/\.eq\('platform',\s*'android'\)/);
  });
});
