import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { LoadingScreen } from '@/components/feedback';
import { supabase } from '@/lib/supabase/client';

import { useAuth } from '../hooks/useAuth';

/**
 * OAuth landing route.
 */
export default function AuthCallbackPage() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const exchanged = useRef(false);

  useEffect(() => {
    // Handle explicitly returned OAuth errors
    if (errorParam) {
      console.error('[OAuth] Callback received error:', errorParam, errorDescription);
      navigate('/sign-in', { replace: true, state: { error: errorDescription || errorParam } });
      return;
    }

    if (code && !exchanged.current) {
      exchanged.current = true;
      // eslint-disable-next-line no-console
      console.log('[OAuth] exchanging code for session');
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error('[OAuth] Failed to exchange code for session:', error);
          navigate('/sign-in', { replace: true });
        }
      });
    }
  }, [code, errorParam, errorDescription, navigate]);

  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/', { replace: true });
    }
    // Don't auto-redirect to sign-in if we are currently exchanging a code
    if (status === 'unauthenticated' && !code && !errorParam) {
      navigate('/sign-in', { replace: true });
    }
  }, [status, navigate, code, errorParam]);

  return <LoadingScreen message="Completing sign-in…" />;
}
