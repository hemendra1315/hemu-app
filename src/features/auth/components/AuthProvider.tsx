import { useEffect, type ReactNode } from 'react';

import { logger } from '@/lib/logger';
import { requestPersistentStorage } from '@/lib/offline/indexedDb';
import { supabase } from '@/lib/supabase/client';
import { useAcademyStore, useAuthStore, useTestModeStore } from '@/stores';
import type { TestModeRole } from '@/stores/testModeStore';

import { useIdentity } from '../hooks/useIdentity';

/**
 * Bridges Supabase auth events into the auth store, then loads the identity
 * (profile, memberships, pending join requests) that routing depends on.
 */
declare global {
  interface Window {
    __E2E_SET_AUTH__?: (data: {
      user?: unknown;
      profile?: unknown;
      memberships?: unknown[];
      joinRequests?: unknown[];
      activeAcademyId?: string | null;
      testModeRole?: TestModeRole;
    }) => void;
  }
}

/**
 * Bridges Supabase auth events into the auth store, then loads the identity
 * (profile, memberships, pending join requests) that routing depends on.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    let active = true;

    if (typeof window !== 'undefined') {
      window.__E2E_SET_AUTH__ = (data) => {
        if (data.user) {
          sessionStorage.setItem('cam.e2e_auth', JSON.stringify(data));
        } else {
          sessionStorage.removeItem('cam.e2e_auth');
        }
        const { user, profile, memberships, joinRequests = [], activeAcademyId } = data;
        const mockSession = user
          ? ({
              user,
              access_token: 'e2e-token',
              refresh_token: 'e2e-refresh',
              expires_in: 3600,
              token_type: 'bearer',
            } as unknown as import('@supabase/supabase-js').Session)
          : null;
        useAuthStore.getState().setSession(mockSession);
        useAuthStore.getState().setProfile((profile as import('@/types').Profile) ?? null);
        useAuthStore
          .getState()
          .setMemberships((memberships as import('@/types').Membership[]) ?? []);
        useAuthStore
          .getState()
          .setJoinRequests((joinRequests as import('@/types').JoinRequest[]) ?? []);
        useAuthStore.getState().setIdentityStatus('ready');
        void requestPersistentStorage();
        if (activeAcademyId !== undefined) {
          useAcademyStore.getState().setActiveAcademy(activeAcademyId);
          if (typeof localStorage !== 'undefined' && activeAcademyId) {
            localStorage.setItem(
              'cam.active-academy',
              JSON.stringify({ state: { activeAcademyId }, version: 0 }),
            );
          }
        }
        if (data.testModeRole !== undefined) {
          useTestModeStore.getState().setTestMode(data.testModeRole, activeAcademyId ?? null);
        }
      };

      const storedAuth = sessionStorage.getItem('cam.e2e_auth');
      if (storedAuth) {
        try {
          const parsed = JSON.parse(storedAuth);
          window.__E2E_SET_AUTH__(parsed);
        } catch {
          // ignore invalid json
        }
      }
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        const isE2E = Boolean(
          typeof window !== 'undefined' && sessionStorage.getItem('cam.e2e_auth'),
        );
        if (
          active &&
          !isE2E &&
          !useAuthStore.getState().signingOut &&
          useAuthStore.getState().identityStatus !== 'ready'
        ) {
          setSession(data.session);
          if (data.session) {
            void requestPersistentStorage();
          }
        }
      })
      .catch((error: unknown) => {
        logger.error('session_bootstrap_failed', { error: String(error) });
        const isE2E = Boolean(
          typeof window !== 'undefined' && sessionStorage.getItem('cam.e2e_auth'),
        );
        if (
          active &&
          !isE2E &&
          !useAuthStore.getState().signingOut &&
          useAuthStore.getState().identityStatus !== 'ready'
        ) {
          setSession(null);
        }
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      logger.debug('auth_state_change', { event });
      const isE2E = Boolean(
        typeof window !== 'undefined' && sessionStorage.getItem('cam.e2e_auth'),
      );
      if (
        !isE2E &&
        !useAuthStore.getState().signingOut &&
        useAuthStore.getState().identityStatus !== 'ready'
      ) {
        setSession(session);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [setSession]);

  return <IdentityLoader>{children}</IdentityLoader>;
}

/** Runs the identity query for as long as a session exists. */
function IdentityLoader({ children }: { children: ReactNode }) {
  useIdentity();
  return <>{children}</>;
}
