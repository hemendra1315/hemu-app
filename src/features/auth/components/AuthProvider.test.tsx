import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useAuthStore } from '@/stores';
import { AuthProvider } from './AuthProvider';

// Mock dependencies
let authStateCallback: ((event: string, session: unknown) => void) | null = null;
const mockUnsubscribe = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn((cb) => {
        authStateCallback = cb;
        return {
          data: {
            subscription: {
              unsubscribe: mockUnsubscribe,
            },
          },
        };
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock('@/lib/offline/indexedDb', () => ({
  requestPersistentStorage: vi.fn().mockResolvedValue(true),
}));

vi.mock('../hooks/useIdentity', () => ({
  useIdentity: vi.fn(),
}));

import { supabase } from '@/lib/supabase/client';
import { requestPersistentStorage } from '@/lib/offline/indexedDb';

const mockedGetSession = supabase.auth.getSession as unknown as ReturnType<typeof vi.fn>;

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    act(() => {
      useAuthStore.setState({
        status: 'unauthenticated',
        identityStatus: 'idle',
        session: null,
        user: null,
        signingOut: false,
      });
    });
  });

  it('loads initial session on mount and triggers storage persistence if authenticated', async () => {
    const mockSession = {
      user: { id: 'u-1', email: 'user@test.com' },
      access_token: 'valid-token',
    };

    mockedGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    render(
      <AuthProvider>
        <div data-testid="child-content">App Child</div>
      </AuthProvider>,
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();

    await waitFor(() => {
      expect(useAuthStore.getState().session).toEqual(mockSession);
      expect(requestPersistentStorage).toHaveBeenCalled();
    });
  });

  it('handles getSession error gracefully and sets session to null', async () => {
    mockedGetSession.mockRejectedValue(new Error('Network error'));

    render(
      <AuthProvider>
        <div>App Content</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(useAuthStore.getState().session).toBeNull();
    });
  });

  it('updates auth store when onAuthStateChange fires SIGNED_IN and SIGNED_OUT events', async () => {
    mockedGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { unmount } = render(
      <AuthProvider>
        <div>Content</div>
      </AuthProvider>,
    );

    expect(authStateCallback).toBeDefined();

    // 1. Fire SIGNED_IN event
    const newSession = {
      user: { id: 'u-2', email: 'coach@test.com' },
      access_token: 'coach-token',
    };

    act(() => {
      authStateCallback?.('SIGNED_IN', newSession);
    });

    expect(useAuthStore.getState().session).toEqual(newSession);

    // 2. Fire SIGNED_OUT event
    act(() => {
      authStateCallback?.('SIGNED_OUT', null);
    });

    expect(useAuthStore.getState().session).toBeNull();

    // 3. Unsubscribe on unmount
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('supports window.__E2E_SET_AUTH__ hook for test harness injection', async () => {
    mockedGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    render(
      <AuthProvider>
        <div>E2E Mode</div>
      </AuthProvider>,
    );

    expect(window.__E2E_SET_AUTH__).toBeDefined();

    act(() => {
      window.__E2E_SET_AUTH__?.({
        user: { id: 'e2e-user', email: 'e2e@test.com' },
        profile: { id: 'e2e-user', fullName: 'E2E User' },
        memberships: [{ id: 'mem-1', role: 'academy_owner' }],
        activeAcademyId: 'acad-e2e',
      });
    });

    expect(useAuthStore.getState().identityStatus).toBe('ready');
    expect(useAuthStore.getState().user?.id).toBe('e2e-user');
    expect(requestPersistentStorage).toHaveBeenCalled();
  });
});
