'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';
import { PasswordInput } from '@/components/password-input';
import { PolicyCheckbox } from '@/components/policy-checkbox';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/services';
import { useAuthStore } from '@/lib/stores';
import { usePolicies } from '@/lib/use-policies';
import { apiErrorMessage } from '@/lib/api-error';

function InviteForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') || '';
  const { policies, error: policyError, reload } = usePolicies();
  const [form, setForm] = useState({ first_name: '', last_name: '', password: '', password_confirm: '' });
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (!token || !policies || !accepted) return setError('A valid invite and acknowledgement of the current agreements are required.');
    if (!form.first_name.trim() || !form.last_name.trim()) return setError('Enter your first and last name.');
    if (form.password.length < 10 || form.password !== form.password_confirm) return setError('Use at least 10 characters and make both passwords match.');
    setBusy(true);
    try {
      const result = await authApi.acceptInvitation({ token, ...form, first_name: form.first_name.trim(), last_name: form.last_name.trim(), accept_terms: true, acknowledge_privacy: true, terms_version: policies.terms_version, privacy_version: policies.privacy_version });
      useAuthStore.getState().setTokens(result.tokens.access, result.tokens.refresh);
      await useAuthStore.getState().fetchUser(); router.replace('/dashboard');
    } catch (failure) { setError(apiErrorMessage(failure, 'The invitation may be expired or already used. Ask your organization administrator for a new one.')); }
    finally { setBusy(false); }
  }
  return <Card><CardContent className="pt-6">{!token ? <div className="space-y-5"><FormMessage message="This link is missing its invitation information. Ask your organization administrator for a new invite." /><Button variant="outline" asChild><Link href="/contact">Get help</Link></Button></div> : <form onSubmit={submit} className="space-y-5" aria-busy={busy}><FormMessage message={error} /><div className="grid gap-4 sm:grid-cols-2">{(['first_name', 'last_name'] as const).map((field, index) => <div key={field} className="space-y-2"><Label htmlFor={field}>{index ? 'Last name' : 'First name'}</Label><Input id={field} name={field} autoComplete={index ? 'family-name' : 'given-name'} required value={form[field]} disabled={busy} onChange={event => setForm({ ...form, [field]: event.target.value })} /></div>)}</div><div className="space-y-2"><Label htmlFor="password">Password</Label><PasswordInput id="password" name="password" autoComplete="new-password" minLength={10} required value={form.password} disabled={busy} onChange={event => setForm({ ...form, password: event.target.value })} /><p className="text-xs text-muted-foreground">Use at least 10 characters and a unique password.</p></div><div className="space-y-2"><Label htmlFor="password_confirm">Confirm password</Label><PasswordInput id="password_confirm" name="password_confirm" autoComplete="new-password" minLength={10} required value={form.password_confirm} disabled={busy} onChange={event => setForm({ ...form, password_confirm: event.target.value })} /></div><PolicyCheckbox checked={accepted} onChange={setAccepted} disabled={busy} />{policyError && <div role="alert" className="text-sm">Current agreements are unavailable. <Button type="button" variant="link" onClick={reload}>Retry</Button></div>}<Button type="submit" className="w-full" disabled={busy || !accepted || !policies}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{busy ? 'Joining the organization…' : 'Accept invitation & join'}</Button></form>}</CardContent><CardFooter className="justify-center border-t pt-5 text-sm text-muted-foreground">Already registered? <Link href="/login" className="ml-1 text-primary underline">Sign in</Link></CardFooter></Card>;
}
export default function InvitePage() {
  return <AuthShell title="Join your organization." description="Create your account using the invitation sent by your administrator."><Suspense fallback={<p role="status" className="text-center text-muted-foreground">Loading invitation…</p>}><InviteForm /></Suspense></AuthShell>;
}
