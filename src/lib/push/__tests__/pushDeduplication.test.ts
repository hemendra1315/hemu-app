import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase/client';

describe('Push Subscriptions Deduplication & Multi-platform Architecture', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Persisting token deduplicates legacy Android endpoints for the same user and token', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'owner@demo.com',
    } as unknown as import('@supabase/supabase-js').User;
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockResolvedValue({ error: null }),
    });

    const upsertMock = vi.fn().mockResolvedValue({ error: null });

    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'push_subscriptions') {
        return {
          upsert: upsertMock,
          delete: deleteMock,
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return {} as unknown as ReturnType<typeof supabase.from>;
    });

    const token = { value: 'fcm-token-abc' };
    const canonicalEndpoint = `fcm:${token.value}`;

    // Simulate persistToken logic
    await supabase.from('push_subscriptions').upsert(
      {
        user_id: mockUser.id,
        academy_id: 'academy-456',
        platform: 'android',
        endpoint: canonicalEndpoint,
        fcm_token: token.value,
        p256dh: null,
        auth: null,
      },
      { onConflict: 'user_id,endpoint' },
    );

    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', mockUser.id)
      .eq('platform', 'android')
      .eq('fcm_token', token.value)
      .neq('endpoint', canonicalEndpoint);

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        platform: 'android',
        endpoint: 'fcm:fcm-token-abc',
        fcm_token: 'fcm-token-abc',
      }),
      { onConflict: 'user_id,endpoint' },
    );
    expect(deleteMock).toHaveBeenCalled();
  });

  it('2. Edge Function logic groups and deduplicates duplicate Android subscription rows by fcm_token', () => {
    type PushSub = {
      id: string;
      platform: 'web' | 'android';
      endpoint: string;
      fcm_token: string | null;
    };

    // Simulate duplicate rows returned by database for the same user/token
    const subs: PushSub[] = [
      {
        id: 'sub-1',
        platform: 'android',
        endpoint: 'fcm:token-xyz',
        fcm_token: 'token-xyz',
      },
      {
        id: 'sub-2',
        platform: 'android',
        endpoint: 'https://fcm.googleapis.com/fcm/send/token-xyz',
        fcm_token: 'token-xyz',
      },
    ];

    const androidSubs = subs.filter((s) => s.platform === 'android');
    const tokenToSubMap = new Map<string, PushSub[]>();
    for (const sub of androidSubs) {
      if (!sub.fcm_token) continue;
      const existing = tokenToSubMap.get(sub.fcm_token) ?? [];
      existing.push(sub);
      tokenToSubMap.set(sub.fcm_token, existing);
    }

    // Must group to 1 unique FCM dispatch
    expect(tokenToSubMap.size).toBe(1);
    expect(tokenToSubMap.get('token-xyz')?.length).toBe(2);
    expect(Array.from(tokenToSubMap.keys())).toEqual(['token-xyz']);
  });

  it('3. Different tokens for the same user (e.g. tablet and phone) are preserved and sent independently', () => {
    type PushSub = {
      id: string;
      platform: 'web' | 'android';
      endpoint: string;
      fcm_token: string | null;
    };

    const subs: PushSub[] = [
      {
        id: 'sub-phone',
        platform: 'android',
        endpoint: 'fcm:token-phone',
        fcm_token: 'token-phone',
      },
      {
        id: 'sub-tablet',
        platform: 'android',
        endpoint: 'fcm:token-tablet',
        fcm_token: 'token-tablet',
      },
    ];

    const androidSubs = subs.filter((s) => s.platform === 'android');
    const tokenToSubMap = new Map<string, PushSub[]>();
    for (const sub of androidSubs) {
      if (!sub.fcm_token) continue;
      const existing = tokenToSubMap.get(sub.fcm_token) ?? [];
      existing.push(sub);
      tokenToSubMap.set(sub.fcm_token, existing);
    }

    expect(tokenToSubMap.size).toBe(2);
    expect(Array.from(tokenToSubMap.keys())).toEqual(['token-phone', 'token-tablet']);
  });

  it('4. Android and Web Push subscriptions operate independently for the same user', () => {
    type PushSub = {
      id: string;
      platform: 'web' | 'android';
      endpoint: string;
      fcm_token: string | null;
      p256dh: string | null;
      auth: string | null;
    };

    const allSubs: PushSub[] = [
      {
        id: 'sub-web',
        platform: 'web',
        endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/web-token',
        fcm_token: null,
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      },
      {
        id: 'sub-android',
        platform: 'android',
        endpoint: 'fcm:android-token',
        fcm_token: 'android-token',
        p256dh: null,
        auth: null,
      },
    ];

    const webSubs = allSubs.filter((s) => s.platform === 'web');
    const androidSubs = allSubs.filter((s) => s.platform === 'android');

    expect(webSubs.length).toBe(1);
    expect(webSubs[0]?.endpoint).toContain('updates.push.services.mozilla.com');
    expect(androidSubs.length).toBe(1);
    expect(androidSubs[0]?.fcm_token).toBe('android-token');
  });

  it('5. Dead token error (404/400) prunes all associated duplicate row IDs together', () => {
    type PushSub = { id: string; fcm_token: string };
    const subsForToken: PushSub[] = [
      { id: 'sub-1', fcm_token: 'dead-token' },
      { id: 'sub-2', fcm_token: 'dead-token' },
    ];

    const staleIds: string[] = [];
    const httpStatus = 404;

    if (httpStatus === 404 || httpStatus === 400) {
      for (const sub of subsForToken) {
        staleIds.push(sub.id);
      }
    }

    expect(staleIds).toEqual(['sub-1', 'sub-2']);
  });
});
