'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';
import { PolicyCheckbox } from '@/components/policy-checkbox';
import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/lib/stores';
import { usePolicies } from '@/lib/use-policies';
import { authApi } from '@/lib/services';
import { apiErrorMessage } from '@/lib/api-error';

export default function AgreementsPage() {
  const router = useRouter();
  const { isAuthenticated, fetchUser, logout } = useAuthStore();
  const { policies, error: policyError, reload } = usePolicies();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (!isAuthenticated) router.replace('/login'); }, [isAuthenticated, router]);
  async function accept() {
    if (!accepted || !policies) return;
    setBusy(true); setError('');
    try {
      await authApi.acceptPolicies({ accept_terms: true, acknowledge_privacy: true, terms_version: policies.terms_version, privacy_version: policies.privacy_version });
      await fetchUser();
      const user = useAuthStore.getState().user;
      router.replace(user?.email_verification_required ? '/verify-email' : user?.organization_id ? '/dashboard' : '/onboarding');
    } catch (failure) { setError(apiErrorMessage(failure, 'Unable to save your acknowledgement. Please retry.')); }
    finally { setBusy(false); }
  }
  return <AuthShell title="Review before you continue." description="Please review the current Terms and Privacy Policy. Your account will record the versions and the time you acknowledge them."><Card><CardContent className="space-y-6 pt-6"><FormMessage message={error} /><PolicyCheckbox checked={accepted} onChange={setAccepted} disabled={busy} />{policies && <p className="text-xs text-muted-foreground">Terms version {policies.terms_version} · Privacy version {policies.privacy_version}</p>}{policyError && <div role="alert" className="text-sm">Current agreements could not be loaded. <Button variant="link" className="px-0" onClick={reload}>Retry</Button></div>}<Button className="w-full" onClick={accept} disabled={!accepted || !policies || busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{busy ? 'Saving…' : 'Agree & continue'}</Button><Button variant="ghost" className="w-full" disabled={busy} onClick={async () => { await logout(); router.replace('/'); }}>Sign out</Button></CardContent></Card></AuthShell>;
}
