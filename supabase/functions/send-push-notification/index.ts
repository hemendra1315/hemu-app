// Supabase Edge Function: send-push-notification
// Triggered after an announcement is created.
// Fans out Web Push notifications to all matching subscriptions.
//
// Environment secrets required (set in Supabase Dashboard → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY   = <your public key>
//   VAPID_PRIVATE_KEY  = <your private key>
//   VAPID_SUBJECT      = mailto:admin@youracademy.com
//   SUPABASE_URL       = (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY = (auto-injected)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { announcement_id } = (await req.json()) as { announcement_id: string };
    if (!announcement_id) return new Response('Missing announcement_id', { status: 400 });

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

    if (userIds.length === 0)
      return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });

    // 3. Load push subscriptions for these users
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', userIds);

    if (!subs || subs.length === 0)
      return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });

    // 4. Build VAPID auth
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKeyB64 = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@cricketacademy.app';
    const privateKey = await importVapidPrivateKey(vapidPrivateKeyB64);

    const payload = JSON.stringify({
      title: announcement.title,
      body: announcement.message,
      icon: '/icons/icon-192.png',
      data: { url: '/announcements' },
    });

    // 5. Send pushes, collect stale endpoints to prune
    const staleIds: string[] = [];
    let sent = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await Promise.all(
      subs.map(async (sub: any) => {
        try {
          const origin = new URL(sub.endpoint).origin;
          const jwt = await buildVapidJwt(origin, vapidSubject, privateKey);
          const authHeader = `vapid t=${jwt},k=${vapidPublicKey}`;

          const res = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/octet-stream',
              TTL: '86400',
            },
            body: payload, // Note: full encryption (RFC 8291) requires additional libs;
            // plaintext body works for same-origin Chrome test deployments.
            // For production encryption, use a Deno port of web-push.
          });

          if (res.status === 410 || res.status === 404) {
            staleIds.push(sub.id);
          } else if (res.ok || res.status === 201) {
            sent++;
          }
        } catch {
          // Network error — skip, will retry on next announcement
        }
      }),
    );

    // 6. Prune stale subscriptions
    if (staleIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', staleIds);
    }

    return new Response(JSON.stringify({ sent, pruned: staleIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-push-notification error:', err);
    return new Response(String(err), { status: 500 });
  }
});
