'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { useAuthStore, useOrganizationStore } from '@/lib/stores';
import { closureApi } from '@/lib/services';
import { apiErrorMessage } from '@/lib/api-error';
import type { ClosureRequest } from '@/types/swm';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ClosurePage() {
  const user = useAuthStore(state => state.user);
  const { organization, fetchOrganization } = useOrganizationStore();
  const [requests, setRequests] = useState<ClosureRequest[]>([]);
  const [scope, setScope] = useState<'account' | 'workspace'>('account');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [proof, setProof] = useState<{ id: string; token: string } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { setRequests(await closureApi.list()); }
    catch (err) { setError(apiErrorMessage(err, 'Could not load requests. Retry below.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void load(); void fetchOrganization();
    const params = new URLSearchParams(window.location.search);
    const id = params.get('request'), token = params.get('token');
    if (id && token) {
      setProof({ id, token });
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [load, fetchOrganization]);
  const act = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); setMessage(success); await load(); }
    catch (err) { setError(apiErrorMessage(err, 'Could not update the request. Please retry.')); }
    finally { setBusy(false); }
  };
  const expected = scope === 'workspace' ? `DELETE ${organization?.slug || ''}` : 'DELETE ACCOUNT';
  return <DashboardLayout><div className="max-w-2xl space-y-6">
    <div><Link href="/settings" className="text-sm underline">Back to settings</Link><h1 className="mt-3 text-2xl font-bold">Data and closure</h1></div>
    <Card><CardHeader><CardTitle>Keep a copy of your data</CardTitle><CardDescription>Export workspace data before requesting closure.</CardDescription></CardHeader><CardContent><Button asChild variant="outline"><Link href="/settings/backups">Open exports and backups</Link></Button></CardContent></Card>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {proof && <Card><CardHeader><CardTitle>Confirm your request</CardTitle><CardDescription>Confirming schedules review after a 7-day cancellation window. No data is deleted now.</CardDescription></CardHeader><CardContent><Button disabled={busy} onClick={() => void act(async () => { await closureApi.confirm(proof.id, proof.token); setProof(null); }, 'Email confirmed. Your request is scheduled for review.')}>Confirm closure request</Button></CardContent></Card>}
    <Card><CardHeader><CardTitle>Request closure</CardTitle><CardDescription>
      Requests are completed by an operator after identity confirmation and a 7-day cancellation window. Workspace closure includes billing cancellation and production-data deletion. Any retained backup or billing records and their retention dates are recorded on the request. Requesting closure does not immediately cancel billing.
    </CardDescription></CardHeader><CardContent>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void act(async () => {
        const result = await closureApi.create({ scope, confirmation });
        setConfirmation('');
        if (!result.confirmation_email_sent) throw new Error('mail');
      }, 'Request saved. Check your email for the confirmation link.'); }}>
        <div className="space-y-2"><Label htmlFor="closure-scope">What should be closed?</Label><select id="closure-scope" value={scope} className="w-full rounded-md border bg-background p-2" onChange={e => { setScope(e.target.value as 'account' | 'workspace'); setConfirmation(''); }}><option value="account">Only my account</option>{user?.role === 'admin' && <option value="workspace">Entire workspace and its accounts</option>}</select></div>
        <p className="text-sm text-muted-foreground">{scope === 'account' ? 'Workspace subscriptions and shared business records remain. If you are its only admin, assign another admin first.' : 'This affects every member and all workspace data.'}</p>
        <div className="space-y-2"><Label htmlFor="closure-confirmation">Type {expected}</Label><Input id="closure-confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" required /></div>
        <Button variant="destructive" type="submit" disabled={busy || loading || confirmation !== expected || !organization}>Request closure</Button>
      </form>
    </CardContent></Card>
    <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Your requests</h2><Button variant="outline" disabled={busy} onClick={() => { setError(''); void load(); }}>Refresh</Button></div>
    {loading ? <p role="status">Loading requests…</p> : requests.length === 0 ? <p>No closure requests.</p> : requests.map(request => <Card key={request.id}><CardHeader><CardTitle className="text-base">{request.scope === 'workspace' ? 'Workspace' : 'Account'} closure</CardTitle><CardDescription>{request.id}</CardDescription></CardHeader><CardContent className="space-y-3">
      <p>Status: <strong>{request.status.replaceAll('_', ' ')}</strong></p>
      {request.eligible_at && <p className="text-sm">Eligible for operator review: {new Date(request.eligible_at).toLocaleString()}</p>}
      {request.public_notes && <p className="text-sm">{request.public_notes}</p>}
      {request.retention_notes && <p className="text-sm">Retention: {request.retention_notes}</p>}
      {request.retained_data_expires_at && <p className="text-sm">Retained data expires: {new Date(request.retained_data_expires_at).toLocaleDateString()}</p>}
      {request.completed_at && <p className="text-sm">Completed: {new Date(request.completed_at).toLocaleString()}</p>}
      {request.status === 'awaiting_confirmation' && <Button variant="outline" disabled={busy} onClick={() => void act(async () => { const result = await closureApi.resend(request.id); if (!result.confirmation_email_sent) throw new Error('mail'); }, 'Confirmation email sent.')}>Resend confirmation email</Button>}
      {['awaiting_confirmation', 'scheduled', 'blocked'].includes(request.status) && <Button variant="outline" disabled={busy} onClick={() => void act(() => closureApi.cancel(request.id), 'Closure request cancelled.')}>Cancel request</Button>}
      {request.status === 'processing' && <p className="text-sm">Contact <Link href="/support" className="underline">support</Link> if you need to stop processing.</p>}
    </CardContent></Card>)}
  </div></DashboardLayout>;
}
