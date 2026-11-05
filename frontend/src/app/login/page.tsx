'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';
import { PasswordInput } from '@/components/password-input';
import { SocialButtons } from '@/components/social-buttons';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/lib/stores';
import { usePolicies } from '@/lib/use-policies';
import { apiErrorMessage } from '@/lib/api-error';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore(state => state.login);
  const { policies } = usePolicies();
  const [form, setForm] = useState({ email: '', password: '', otp: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const state = new URLSearchParams(window.location.search).get('social');
    const timer = window.setTimeout(() => { if (state) setError(state === 'mfa' ? 'This account has MFA. Use email, password, and your authenticator code.' : 'Social sign-in could not complete. Use your existing sign-in method or try again.'); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      await login(form.email.trim(), form.password, form.otp);
      const user = useAuthStore.getState().user;
      router.replace(user?.email_verification_required ? '/verify-email' : user?.agreements_required ? '/agreements' : user?.organization_id ? '/dashboard' : '/onboarding');
    } catch (failure) { setError(apiErrorMessage(failure, 'We could not sign you in. Check your email, password, and authenticator code if enabled.')); }
    finally { setBusy(false); }
  }
  return <AuthShell title="Welcome back." description="Sign in to your organization’s software workspace."><Card className="shadow-lg"><CardContent className="pt-6"><SocialButtons policies={policies} disabled={busy} /><form onSubmit={submit} className="space-y-5" aria-busy={busy}><FormMessage message={error} /><div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="username" required value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} disabled={busy} /></div><div className="space-y-2"><div className="flex items-center justify-between gap-3"><Label htmlFor="password">Password</Label><Link href="/forgot-password" className="text-xs text-primary underline">Forgot password?</Link></div><PasswordInput id="password" name="password" autoComplete="current-password" required value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} disabled={busy} /></div><div className="space-y-2"><Label htmlFor="otp">Authenticator code <span className="font-normal text-muted-foreground">(if enabled)</span></Label><Input id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} aria-describedby="otp-help" value={form.otp} onChange={event => setForm({ ...form, otp: event.target.value })} disabled={busy} /><p id="otp-help" className="text-xs leading-5 text-muted-foreground">Enter the current six-digit code if your account has MFA. MFA accounts use email and password sign-in.</p></div><Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{busy ? 'Signing in…' : 'Sign in'}</Button></form></CardContent><CardFooter className="justify-center border-t pt-5 text-sm text-muted-foreground">New to SWM? <Link href="/register" className="ml-1 font-medium text-primary underline">Start free</Link></CardFooter></Card><p className="mt-5 text-center text-xs leading-6 text-muted-foreground">Need help getting back in? <Link href="/help#account" className="text-primary underline">See account recovery</Link>.</p></AuthShell>;
}
