'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';
import { PasswordInput } from '@/components/password-input';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/services';
import { apiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/lib/stores';

function ResetForm() {
  const token = useSearchParams().get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (password.length < 10 || password !== confirm) return setError('Use at least 10 characters and make both passwords match.');
    setBusy(true);
    try { await authApi.confirmPasswordReset(token, password, confirm); useAuthStore.getState().clearAuth(); setComplete(true); }
    catch (failure) { setError(apiErrorMessage(failure, 'The reset link may be invalid or expired. Request a new link and try again.')); }
    finally { setBusy(false); }
  }
  return <Card><CardContent className="space-y-5 pt-6">{complete ? <div role="status" className="space-y-5"><ShieldCheck className="h-9 w-9 text-primary" aria-hidden="true" /><h2 className="text-xl font-semibold">Your password is updated.</h2><p className="text-sm leading-7 text-muted-foreground">Sign in again with the new password and your authenticator code if MFA is enabled.</p><Button asChild className="w-full"><Link href="/login">Sign in</Link></Button></div> : !token ? <><FormMessage message="This link is missing its reset information. Request a new password-reset link to continue." /><Button asChild className="w-full"><Link href="/forgot-password">Request a new link</Link></Button></> : <form onSubmit={submit} className="space-y-5" aria-busy={busy}><FormMessage message={error} /><div className="space-y-2"><Label htmlFor="password">New password</Label><PasswordInput id="password" name="password" autoComplete="new-password" minLength={10} required value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /><p className="text-xs leading-5 text-muted-foreground">At least 10 characters. Avoid common or entirely numeric passwords.</p></div><div className="space-y-2"><Label htmlFor="confirm">Confirm new password</Label><PasswordInput id="confirm" name="confirm_password" autoComplete="new-password" minLength={10} required value={confirm} disabled={busy} onChange={event => setConfirm(event.target.value)} /></div><Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{busy ? 'Updating password…' : 'Update password'}</Button><p className="text-center text-sm"><Link href="/forgot-password" className="text-primary underline">Request a fresh link</Link></p></form>}</CardContent></Card>;
}
export default function ResetPasswordPage() {
  return <AuthShell title="Choose a new password." description="A reset link can be used once. Keep your new password unique to this account."><Suspense fallback={<p role="status" className="text-center text-muted-foreground">Loading reset form…</p>}><ResetForm /></Suspense></AuthShell>;
}
