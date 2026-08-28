// Supabase Edge Function: send-push-notification
// Triggered after an announcement is created.
// Fans out notifications to all matching subscriptions — Web Push
// (browser/PWA) and native Android (FCM), branching on push_subscriptions.platform.
//
// Environment secrets required (set in Supabase Dashboard → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY   = <your public key>            (Web Push)
//   VAPID_PRIVATE_KEY  = <your private key>            (Web Push)
//   VAPID_SUBJECT      = mailto:admin@youracademy.com  (Web Push)
//   FCM_SERVICE_ACCOUNT_JSON = <the whole downloaded service-account JSON,   (native Android)
//                               from Firebase Console → Project Settings →
//                               Service Accounts → Generate new private key>
//   SUPABASE_URL       = (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY = (auto-injected)
//
// Native Android pushes go through FCM's HTTP v1 API, which authenticates
// with a short-lived OAuth2 token minted from the service account (the
// legacy "server key" + `Authorization: key=...` API was shut down by
// Google) — see getFcmAccessToken() below. Web Push subscriptions don't need
// this at all; they authenticate with the VAPID keypair already configured.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS. Two things here are load-bearing, and getting either wrong produces
// the same confusing symptom — a 200 OPTIONS in the logs followed by no POST
// at all, i.e. "the function was never called":
//
//  1. `Access-Control-Allow-Methods` — a JSON POST is not a CORS-safelisted
//     request, so the browser preflights it and needs the method listed.
//  2. `Access-Control-Allow-Headers` must cover EVERY custom header the
//     supabase-js client attaches. Hardcoding that list is fragile: the app
//     sets its own `x-application-name` global header, and any future one
//     would silently break dispatch again. So we echo back exactly what the
//     preflight asked permission for instead of maintaining a list.
const BASE_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const FALLBACK_ALLOW_HEADERS =
  'authorization, x-client-info, apikey, content-type, x-application-name, x-supabase-api-version';

function corsHeadersFor(req: Request): Record<string, string> {
  return {
    ...BASE_CORS_HEADERS,
    'Access-Control-Allow-Headers':
      req.headers.get('Access-Control-Request-Headers') ?? FALLBACK_ALLOW_HEADERS,
  };
}

// ─── VAPID helpers (pure Deno / Web Crypto — no npm) ────────────────────────

async function importVapidPrivateKey(base64url: string): Promise<CryptoKey> {
  const raw = base64urlToUint8Array(base64url);
  // Wrap raw EC private key bytes into a PKCS#8 DER structure
  const pkcs8 = new Uint8Array([
    0x30,
    0x41,
    0x02,
    0x01,
    0x00,
    0x30,
    0x13,
    0x06,
    0x07,
    0x2a,
    0x86,
    0x48,
    0xce,
    0x3d,
    0x02,
    0x01,
    0x06,
    0x08,
    0x2a,
    0x86,
    0x48,
    0xce,
    0x3d,
    0x03,
    0x01,
    0x07,
    0x04,
    0x27,
    0x30,
    0x25,
    0x02,
    0x01,
    0x01,
    0x04,
    0x20,
    ...raw,
  ]);
  return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ]);
}

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function buildVapidJwt(
  audience: string,
  subject: string,
  privateKey: CryptoKey,
): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 43200, sub: subject };

  const headerB64 = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${uint8ArrayToBase64url(new Uint8Array(signature))}`;
}

// ─── Web Push payload encryption (RFC 8291 "aes128gcm") ────────────────────
//
// Real push services (Chrome/FCM, Firefox/autopush, ...) reject or silently
// drop a push whose body isn't encrypted per RFC 8291 — sending the JSON
// payload in plaintext (the previous behavior here) only ever "worked" in
// the sense that the HTTP call didn't error; the browser never surfaced a
// notification from it. This implements the standard aes128gcm scheme using
// only Web Crypto (available natively in the Deno edge runtime, no npm
// dependency), following the algorithm web-push libraries implement.

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function uint32BE(n: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, n, false);
  return buf;
}

/**
 * Encrypts `plaintext` for delivery to a single push subscription.
 * Returns the aes128gcm-encoded body to send as the push request's raw bytes.
 *
 * @param uaPublicB64 subscription.keys.p256dh (base64url, uncompressed P-256 point)
 * @param uaAuthB64   subscription.keys.auth   (base64url, 16-byte auth secret)
 */
async function encryptWebPushPayload(
  plaintext: Uint8Array,
  uaPublicB64: string,
  uaAuthB64: string,
): Promise<Uint8Array> {
  const uaPublicRaw = base64urlToUint8Array(uaPublicB64);
  const uaAuth = base64urlToUint8Array(uaAuthB64);

  // Ephemeral ECDH key pair for this one message.
  const asKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', asKeyPair.publicKey));

  const uaPublicKey = await crypto.subtle.importKey(
    'raw',
    uaPublicRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  // ECDH shared secret between our ephemeral key and the subscription's key.
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: uaPublicKey },
      asKeyPair.privateKey,
      256,
    ),
  );

  // RFC 8291 §3.4: combine the ECDH secret with the subscription's auth
  // secret to get the input keying material for the message-level HKDF.
  const keyInfo = concatBytes(
    new TextEncoder().encode('WebPush: info'),
    new Uint8Array([0x00]),
    uaPublicRaw,
    asPublicRaw,
  );
  const ecdhSecretKey = await crypto.subtle.importKey('raw', ecdhSecret, 'HKDF', false, [
    'deriveBits',
  ]);
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: uaAuth, info: keyInfo },
      ecdhSecretKey,
      256,
    ),
  );

  // RFC 8188 §2.1: derive the content-encryption key and nonce from a fresh
  // random salt for this message.
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const cekInfo = concatBytes(
    new TextEncoder().encode('Content-Encoding: aes128gcm'),
    new Uint8Array([0x00]),
  );
  const nonceInfo = concatBytes(
    new TextEncoder().encode('Content-Encoding: nonce'),
    new Uint8Array([0x00]),
  );
  const cek = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },
      ikmKey,
      128,
    ),
  );
  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
      ikmKey,
      96,
    ),
  );

  const cekKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  // 0x02 = single-record "last record" delimiter (RFC 8188 §2), no extra padding.
  const paddedPlaintext = concatBytes(plaintext, new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      cekKey,
      paddedPlaintext,
    ),
  );

  // aes128gcm content-coding header (RFC 8188 §2.1): salt(16) + rs(4) + idlen(1) + keyid
  const header = concatBytes(
    salt,
    uint32BE(4096),
    new Uint8Array([asPublicRaw.length]),
    asPublicRaw,
  );
  return concatBytes(header, ciphertext);
}

// ─── FCM (native Android) helpers ────────────────────────────────────────────

interface FcmServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function pemPrivateKeyToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}

/**
 * Exchanges the service account's private key for a short-lived OAuth2
 * access token, by signing a JWT assertion ourselves (RS256, Web Crypto —
 * no npm) and trading it at Google's token endpoint. One token is reused
 * for every Android send in this invocation rather than minted per-message.
 */
async function getFcmAccessToken(serviceAccount: FcmServiceAccount): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemPrivateKeyToDer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(header)));
  const claimsB64 = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${claimsB64}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  const assertion = `${signingInput}.${uint8ArrayToBase64url(new Uint8Array(signature))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`FCM OAuth token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

async function sendFcmMessage(
  projectId: string,
  accessToken: string,
  fcmToken: string,
  title: string,
  body: string,
): Promise<Response> {
  return fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        notification: { title, body },
        data: { url: '/announcements' },
        android: { priority: 'high' },
      },
    }),
  });
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { announcement_id } = (await req.json()) as { announcement_id: string };
    if (!announcement_id) return new Response('Missing announcement_id', { status: 400 });
    console.log('push_dispatch_start', { announcement_id });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Load the announcement (for the push payload's title/body)
    const { data: announcement, error: annErr } = await supabase
      .from('announcements')
      .select('id, title, message')
      .eq('id', announcement_id)
      .single();
    if (annErr || !announcement) return new Response('Announcement not found', { status: 404 });

    // 2. Resolve target user IDs from `notifications`, not by re-deriving
    // audience membership here. `create_announcement_with_targets` /
    // `fanout_announcement` (migration 0046) already wrote one row per
    // correctly-resolved recipient by the time this function runs — for every
    // audience, including `custom` (batches + individually named people) and
    // the batch/parent edge cases that migration fixed (e.g. "All Parents"
    // previously notifying nobody). Re-implementing that resolution here would
    // both duplicate it and risk drifting out of sync with those fixes.
    const { data: recipients } = await supabase
      .from('notifications')
      .select('recipient_user_id')
      .eq('announcement_id', announcement_id);

    const userIds = [
      ...new Set(
        (recipients ?? [])
          .map((r: { recipient_user_id: string | null }) => r.recipient_user_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    if (userIds.length === 0) {
      console.log('push_dispatch_no_recipients');
      return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });
    }

    // 3. Load push subscriptions for these users (both platforms)
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, platform, endpoint, p256dh, auth, fcm_token')
      .in('user_id', userIds);

    if (!subs || subs.length === 0) {
      console.log('push_dispatch_no_subscriptions', { recipients: userIds.length });
      return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });
    }

    type PushSub = {
      id: string;
      platform: 'web' | 'android';
      endpoint: string;
      p256dh: string | null;
      auth: string | null;
      fcm_token: string | null;
    };
    const allSubs = subs as PushSub[];
    const webSubs = allSubs.filter((s) => s.platform === 'web');
    const androidSubs = allSubs.filter((s) => s.platform === 'android');
    console.log('push_dispatch_targets', {
      recipients: userIds.length,
      web: webSubs.length,
      android: androidSubs.length,
    });

    const staleIds: string[] = [];
    let sent = 0;

    // 4a. Web Push — VAPID + RFC 8291 encryption
    if (webSubs.length > 0) {
      const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
      const vapidPrivateKeyB64 = Deno.env.get('VAPID_PRIVATE_KEY')!;
      const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@cricketacademy.app';
      const privateKey = await importVapidPrivateKey(vapidPrivateKeyB64);

      const payloadBytes = new TextEncoder().encode(
        JSON.stringify({
          title: announcement.title,
          body: announcement.message,
          icon: '/icons/icon-192.png',
          data: { url: '/announcements' },
        }),
      );

      await Promise.all(
        webSubs.map(async (sub) => {
          try {
            const origin = new URL(sub.endpoint).origin;
            const jwt = await buildVapidJwt(origin, vapidSubject, privateKey);
            const authHeader = `vapid t=${jwt},k=${vapidPublicKey}`;
            const body = await encryptWebPushPayload(payloadBytes, sub.p256dh!, sub.auth!);

            const res = await fetch(sub.endpoint, {
              method: 'POST',
              headers: {
                Authorization: authHeader,
                'Content-Type': 'application/octet-stream',
                'Content-Encoding': 'aes128gcm',
                TTL: '86400',
              },
              body,
            });

            // 400/401/403 alongside 404/410 usually means a malformed or
            // revoked subscription (bad keys, wrong endpoint) rather than a
            // transient failure — prune those too so they don't keep failing
            // silently on every future announcement.
            if ([400, 401, 403, 404, 410].includes(res.status)) {
              staleIds.push(sub.id);
            } else if (res.ok || res.status === 201) {
              sent++;
            }
          } catch {
            // Network error or malformed subscription keys — skip, will retry
            // on next announcement rather than pruning on a possibly-transient
            // failure.
          }
        }),
      );
    }

    // 4b. Native Android — FCM HTTP v1
    if (androidSubs.length > 0) {
      const serviceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
      if (!serviceAccountJson) {
        console.warn(
          'FCM_SERVICE_ACCOUNT_JSON not set — skipping',
          androidSubs.length,
          'Android subscription(s)',
        );
      } else {
        try {
          const serviceAccount = JSON.parse(serviceAccountJson) as FcmServiceAccount;
          const accessToken = await getFcmAccessToken(serviceAccount);

          await Promise.all(
            androidSubs.map(async (sub) => {
              try {
                const res = await sendFcmMessage(
                  serviceAccount.project_id,
                  accessToken,
                  sub.fcm_token!,
                  announcement.title,
                  announcement.message,
                );

                if (res.ok) {
                  sent++;
                  console.log('fcm_send_ok');
                } else if (res.status === 404 || res.status === 400) {
                  console.warn('fcm_send_rejected', res.status, await res.text());
                  // UNREGISTERED / INVALID_ARGUMENT — the token is dead
                  // (uninstalled app, expired, malformed); stop sending to it.
                  staleIds.push(sub.id);
                } else {
                  console.warn('fcm_send_failed', res.status, await res.text());
                }
              } catch (err) {
                // Network error — skip, will retry on next announcement.
                console.warn('fcm_send_threw', String(err));
              }
            }),
          );
        } catch (err) {
          console.error('FCM send failed:', err);
        }
      }
    }

    // 5. Prune stale subscriptions
    if (staleIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', staleIds);
    }

    console.log('push_dispatch_done', { sent, pruned: staleIds.length });
    return new Response(JSON.stringify({ sent, pruned: staleIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-push-notification error:', err);
    return new Response(String(err), { status: 500 });
  }
});
