'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, MailCheck } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/services';
import { apiErrorMessage } from '@/lib/api-error';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await authApi.requestPasswordReset(email.trim()); setSent(true); }
    catch (failure) { setError(apiErrorMessage(failure, 'We could not request a reset link. Please retry.')); }
    finally { setBusy(false); }
  }
  return <AuthShell title="Reset your password." description="Enter the email you use to sign in. We’ll send instructions if an account exists."><Card><CardContent className="space-y-5 pt-6"><FormMessage message={error} />{sent ? <div role="status" className="space-y-4"><MailCheck className="h-9 w-9 text-primary" aria-hidden="true" /><h2 className="text-xl font-semibold">Check your inbox.</h2><p className="text-sm leading-7 text-muted-foreground">If an account exists for {email}, a reset link has been requested. Check spam and allow time for delivery. Reset links expire after one hour.</p><p className="text-sm leading-7 text-muted-foreground">Still no message? Check the address or <Link href="/contact" className="text-primary underline">contact support</Link>. Never share an active reset link.</p><Button variant="outline" onClick={() => setSent(false)}>Try another address</Button></div> : <form onSubmit={submit} className="space-y-5" aria-busy={busy}><div className="space-y-2"><Label htmlFor="email">Account email</Label><Input id="email" name="email" type="email" autoComplete="email" required value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></div><Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{busy ? 'Requesting link…' : 'Send reset link'}</Button></form>}</CardContent><CardFooter className="justify-center border-t pt-5"><Link href="/login" className="text-sm text-primary underline">Back to sign in</Link></CardFooter></Card></AuthShell>;
}
