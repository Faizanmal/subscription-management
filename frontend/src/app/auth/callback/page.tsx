'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { FormMessage } from '@/components/form-message';
import { authApi } from '@/lib/services';
import { useAuthStore } from '@/lib/stores';
import { apiErrorMessage } from '@/lib/api-error';

function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const started = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    async function complete() {
      try {
        const code = params.get('code');
        const verifier = sessionStorage.getItem('swm-social-verifier');
        window.history.replaceState(null, '', '/auth/callback');
        sessionStorage.removeItem('swm-social-verifier');
        if (!code || !verifier) throw new Error('Start sign-in again in this browser tab.');
        const result = await authApi.exchangeSocialCode(code, verifier);
        useAuthStore.getState().setTokens(result.tokens.access, result.tokens.refresh);
        await useAuthStore.getState().fetchUser();
        const user = useAuthStore.getState().user;
        router.replace(user?.email_verification_required ? '/verify-email' : user?.agreements_required ? '/agreements' : user?.organization_id ? '/dashboard' : '/onboarding');
      } catch (failure) { setError(apiErrorMessage(failure, 'Social sign-in expired. Please start again.')); }
    }
    void complete();
  }, [params, router]);
  return <AuthShell title={error ? 'Sign-in needs another try.' : 'Completing sign-in…'} description="Securely connecting your account to this browser.">{error ? <><FormMessage message={error} /><Link className="text-primary underline" href="/login">Return to sign in</Link></> : <p role="status" className="text-center text-sm text-muted-foreground">Please wait…</p>}</AuthShell>;
}

export default function SocialCallbackPage() { return <Suspense><Callback /></Suspense>; }
