"use client";

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { useAuthStore } from '@/lib/stores';
import { organizationApi } from '@/lib/services';
import { api } from '@/lib/api-base';
import { apiErrorMessage } from '@/lib/api-error';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { User, UserRole, Invitation } from '@/types/swm';
import { toast } from 'sonner';

type Role = { id: string; name: string; type: UserRole };
export default function TeamPage() {
  const user = useAuthStore(state => state.user);
  const admin = user?.role === 'admin';
  const [members, setMembers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [remove, setRemove] = useState<User | null>(null);
  async function load() {
    setLoading(true); setError('');
    try {
      const [people, invites, availableRoles] = await Promise.all([organizationApi.getMembers(), organizationApi.getInvitations(), organizationApi.getRoles()]);
      setMembers(people); setInvitations(invites); setRoles(availableRoles);
      setRole(previous => previous || availableRoles.find(item => item.type === 'viewer')?.id || availableRoles[0]?.id || '');
    } catch (failure) { setError(apiErrorMessage(failure, 'Unable to load team records. Retry to see the current state.')); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    if (!admin) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [admin]);
  async function act(action: () => Promise<unknown>, message: string) {
    setBusy(true); setError('');
    try { await action(); toast.success(message); await load(); }
    catch (failure) { setError(apiErrorMessage(failure, 'The change could not be saved. Please try again.')); }
    finally { setBusy(false); }
  }
  return <DashboardLayout><div className="space-y-7"><div><h1 className="text-2xl font-bold">Team members</h1><p className="mt-2 text-sm text-muted-foreground">Manage workspace membership and pending invitations.</p></div>{!admin ? <Card><CardContent className="pt-6">An organization admin manages team membership. Contact your admin to invite a colleague or change a role.</CardContent></Card> : <><FormMessage message={error} />{error && <Button variant="outline" onClick={() => void load()}>Retry loading</Button>}<Card><CardHeader><CardTitle>Invite a teammate</CardTitle></CardHeader><CardContent><form className="grid items-end gap-4 md:grid-cols-[1fr_12rem_auto]" onSubmit={event => { event.preventDefault(); void act(async () => { await organizationApi.sendInvitation({ email: email.trim(), role }); setEmail(''); }, 'Invitation sent'); }}><div className="space-y-2"><Label htmlFor="invite-email">Email address</Label><Input id="invite-email" type="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></div><div className="space-y-2"><Label htmlFor="invite-role">Role</Label><select id="invite-role" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={role} onChange={event => setRole(event.target.value)} disabled={busy || loading}>{roles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><Button type="submit" disabled={busy || loading || !role}>Send invitation</Button></form><p className="mt-3 text-xs text-muted-foreground">Invitations expire after seven days and count toward your seat limit.</p></CardContent></Card>{loading ? <p role="status">Loading team records…</p> : <><Card><CardHeader><CardTitle>Members ({members.length})</CardTitle></CardHeader><CardContent><ul className="divide-y">{members.map(member => <li key={member.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="font-medium">{member.first_name} {member.last_name}{member.id === user?.id ? ' (you)' : ''}</p><p className="break-all text-sm text-muted-foreground">{member.email}</p></div><div className="flex flex-wrap items-center gap-3"><select aria-label={`Role for ${member.email}`} className="h-9 rounded-md border bg-background px-2 text-sm" value={member.role_id || ''} disabled={busy || member.id === user?.id} onChange={event => void act(() => api.patch(`/auth/users/${member.id}/`, { role: event.target.value }), 'Role updated')}>{roles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Button variant="outline" size="sm" disabled={busy || member.id === user?.id} onClick={() => setRemove(member)}>Remove</Button></div></li>)}</ul>{!members.length && <p className="text-sm text-muted-foreground">No team members were returned.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Invitations</CardTitle></CardHeader><CardContent><ul className="divide-y">{invitations.map(invite => <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="break-all font-medium">{invite.email}</p><p className="text-sm capitalize text-muted-foreground">{invite.status}</p></div>{invite.status === 'pending' && <div className="flex gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => void act(() => organizationApi.resendInvitation(invite.id), 'Invitation resent')}>Resend</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => void act(() => organizationApi.revokeInvitation(invite.id), 'Invitation cancelled')}>Cancel</Button></div>}</li>)}</ul>{!invitations.length && <p className="text-sm text-muted-foreground">No invitations yet. Invite someone above when you’re ready.</p>}</CardContent></Card></>}</>}<AlertDialog open={!!remove} onOpenChange={open => { if (!open) setRemove(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove this member?</AlertDialogTitle><AlertDialogDescription>{remove?.email} will lose access to this workspace. You can invite them again later.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep member</AlertDialogCancel><AlertDialogAction onClick={() => { if (remove) void act(() => organizationApi.removeMember(remove.id), 'Member removed'); setRemove(null); }}>Remove member</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></DashboardLayout>;
}
