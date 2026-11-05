'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Check } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';
import { PasswordInput } from '@/components/password-input';
import { PolicyCheckbox } from '@/components/policy-checkbox';
import { SocialButtons } from '@/components/social-buttons';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/lib/stores';
import { usePolicies } from '@/lib/use-policies';
import { apiErrorMessage } from '@/lib/api-error';

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore(state => state.register);
  const { policies, error: policyError, reload } = usePolicies();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', company_name: '', password: '', confirm_password: '' });
  const update = (key: keyof typeof form, value: string) => setForm(previous => ({ ...previous, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!form.first_name.trim() || !form.last_name.trim() || !form.company_name.trim()) return setError('Enter your name and organization name.');
    if (form.password.length < 10) return setError('Use at least 10 characters for your password.');
    if (form.password !== form.confirm_password) return setError('The two passwords do not match.');
    if (!accepted || !policies) return setError('Review the current Terms and Privacy Policy before continuing.');
    setBusy(true);
    try {
      await register({ email: form.email.trim(), first_name: form.first_name.trim(), last_name: form.last_name.trim(), organization_name: form.company_name.trim(), password: form.password, password_confirm: form.confirm_password, accept_terms: true, acknowledge_privacy: true, terms_version: policies.terms_version, privacy_version: policies.privacy_version });
      router.push('/verify-email');
    } catch (failure) { setError(apiErrorMessage(failure, 'We could not create your account. Check your details and try again.')); }
    finally { setBusy(false); }
  }

  return <AuthShell title="Start with a clearer inventory." description="Your organization gets 14 days of Pro. No card, automatic charge, or paid subscription at signup.">
    <Card className="shadow-lg"><CardContent className="pt-6"><SocialButtons policies={policies} disabled={busy || !accepted} />
      <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
        <FormMessage message={error} />
        <div className="grid gap-4 sm:grid-cols-2">{([{ key: 'first_name', label: 'First name', autoComplete: 'given-name' }, { key: 'last_name', label: 'Last name', autoComplete: 'family-name' }] as const).map(field => <div key={field.key} className="space-y-2"><Label htmlFor={field.key}>{field.label} <span aria-hidden="true">*</span></Label><Input id={field.key} name={field.key} autoComplete={field.autoComplete} required value={form[field.key]} disabled={busy} onChange={event => update(field.key, event.target.value)} /></div>)}</div>
        <div className="space-y-2"><Label htmlFor="email">Work email *</Label><Input id="email" name="email" type="email" autoComplete="email" required value={form.email} disabled={busy} onChange={event => update('email', event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="company_name">Organization name *</Label><Input id="company_name" name="organization" autoComplete="organization" required value={form.company_name} disabled={busy} onChange={event => update('company_name', event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="password">Password *</Label><PasswordInput id="password" name="password" autoComplete="new-password" minLength={10} required aria-describedby="password-help" value={form.password} disabled={busy} onChange={event => update('password', event.target.value)} /><p id="password-help" className="text-xs leading-5 text-muted-foreground">At least 10 characters. Use a unique phrase; avoid common or entirely numeric passwords.</p></div>
        <div className="space-y-2"><Label htmlFor="confirm_password">Confirm password *</Label><PasswordInput id="confirm_password" name="confirm_password" autoComplete="new-password" minLength={10} required value={form.confirm_password} disabled={busy} onChange={event => update('confirm_password', event.target.value)} />{form.confirm_password && <p className={`text-xs ${form.password === form.confirm_password ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>{form.password === form.confirm_password ? 'Passwords match' : 'Passwords do not match yet'}</p>}</div>
        <PolicyCheckbox checked={accepted} onChange={setAccepted} disabled={busy} />
        {policyError ? <div role="alert" className="rounded-lg bg-muted p-3 text-sm"><p>We could not load the current agreements. Please retry before creating your account.</p><Button type="button" variant="link" className="mt-1 px-0" onClick={reload}>Reload agreements</Button></div> : !policies ? <p role="status" className="text-xs text-muted-foreground">Loading current agreements…</p> : null}
        <Button type="submit" className="w-full" disabled={busy || !accepted || !policies}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{busy ? 'Creating your organization…' : 'Create account & start free'}</Button>
        <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />You choose whether to upgrade later. You can start with manual tracking.</p>
      </form>
    </CardContent><CardFooter className="justify-center border-t pt-5 text-sm text-muted-foreground">Already have an account? <Link href="/login" className="ml-1 font-medium text-primary underline">Sign in</Link></CardFooter></Card>
  </AuthShell>;
}
