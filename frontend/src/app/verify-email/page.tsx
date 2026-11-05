"use client";
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { authApi } from '@/lib/services';
import { apiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/lib/stores';
function Verification() {
  const router = useRouter(); const params = useSearchParams(); const started = useRef(false);
  const { user, isAuthenticated, fetchUser, logout } = useAuthStore();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [confirmed, setConfirmed] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  useEffect(() => {
    const token = params.get('token');
    if (!token || started.current) return;
    started.current = true;
    window.history.replaceState(null, '', '/verify-email');
    async function confirm() {
      setBusy(true);
      try { const result = await authApi.confirmVerification(token!); setConfirmed(true); setMessage(result.message); if (useAuthStore.getState().isAuthenticated) await fetchUser(); }
      catch (failure) { setError(apiErrorMessage(failure, 'This link could not be verified. Request a new email.')); }
      finally { setBusy(false); }
    }
    void confirm();
  }, [params, fetchUser]);
  async function check() {
    setBusy(true); setError('');
    try { await fetchUser(); const current = useAuthStore.getState().user;
      if (current?.email_verification_required) { setMessage('Not verified yet. Open the latest email link, then check again.'); return; }
      router.replace(current?.agreements_required ? '/agreements' : '/onboarding');
    } catch (failure) { setError(apiErrorMessage(failure, 'Sign in again to check your verification.')); }
    finally { setBusy(false); }
  }
  return <AuthShell title={confirmed || user?.email_verified ? 'Your email is verified.' : 'Check your inbox.'} description="Confirm your email address before entering your workspace. Links expire after 24 hours."><Card><CardContent className="space-y-5 pt-6"><FormMessage message={error} />{message && <p role="status" className="text-sm leading-6">{message}</p>}{busy && <p role="status">Please wait…</p>}{isAuthenticated ? <><p className="break-all text-sm text-muted-foreground">Verification address: {user?.email}</p>{!user?.email_verified && <><p className="text-sm leading-6 text-muted-foreground">Check your inbox and spam folder. If the email did not arrive, request another below. Only the person with access to this mailbox can confirm it.</p><Button variant="outline" className="w-full" disabled={busy || cooldown > 0} onClick={async () => { setBusy(true); setError(''); setCooldown(60); try { const result = await authApi.requestVerification(); setMessage(result.message); } catch (failure) { setError(apiErrorMessage(failure, 'Email could not be sent. Wait a minute and retry.')); } finally { setBusy(false); } }}>{cooldown ? `Resend available in ${cooldown}s` : 'Resend verification email'}</Button></>}<Button className="w-full" disabled={busy} onClick={() => void check()}>{user?.email_verified ? 'Continue to workspace' : 'I have verified my email'}</Button><Button variant="ghost" className="w-full" disabled={busy} onClick={async () => { await logout(); router.replace('/login'); }}>Sign out or use another account</Button></> : <Button asChild className="w-full"><Link href="/login">Sign in to continue</Link></Button>}<p className="text-xs leading-6 text-muted-foreground">Need help? <Link href="/contact" className="text-primary underline">Contact support</Link>. No card or automatic charge is involved.</p></CardContent></Card></AuthShell>;
}
export default function VerifyEmailPage() { return <Suspense><Verification /></Suspense>; }
