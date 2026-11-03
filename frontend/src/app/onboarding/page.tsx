'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { useAuthStore, useIntegrationsStore, useOrganizationStore, useSubscriptionsStore } from '@/lib/stores';
import { organizationApi, integrationsApi } from '@/lib/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowRight,
  CheckCircle2,
  Plug,
  Search,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { hardNavigate } from '@/lib/navigation';

const STEPS = ['Welcome', 'Connect', 'First insight', 'Done'] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { isAuthenticated, fetchUser } = useAuthStore();
  const { organization, fetchOrganization } = useOrganizationStore();
  const { integrations, fetchIntegrations, syncIntegration } = useIntegrationsStore();
  const { fetchSubscriptions, subscriptions } = useSubscriptionsStore();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualCost, setManualCost] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    void fetchUser();
    void fetchOrganization();
    void fetchIntegrations();
    void fetchSubscriptions();
  }, [isAuthenticated, router, fetchUser, fetchOrganization, fetchIntegrations, fetchSubscriptions]);

  useEffect(() => {
    const settings = (organization?.settings || {}) as Record<string, unknown>;
    if (settings.onboarding_completed) {
      router.replace('/dashboard');
    }
  }, [organization, router]);

  const connectedDiscovery = (integrations || []).filter((i) =>
    ['google_workspace', 'microsoft_365', 'plaid', 'okta', 'azure_ad'].includes(i.type) &&
    (i.status === 'connected' || i.status === 'active'),
  );

  const apiError = (error: unknown, fallback: string) => {
    const err = error as {
      response?: { status?: number; data?: { error?: string; code?: string; upgrade_url?: string } };
      message?: string;
    };
    if (err.response?.data?.code === 'plan_upgrade_required' || err.response?.status === 402) {
      toast.error(err.response.data?.error || 'Upgrade required for discovery', {
        action: {
          label: 'Billing',
          onClick: () => hardNavigate(err.response?.data?.upgrade_url || '/settings/billing'),
        },
      });
      return err.response.data?.error || fallback;
    }
    return err.response?.data?.error || err.message || fallback;
  };

  const openProvider = async (type: string) => {
    setBusy(true);
    try {
      const { auth_url } = await integrationsApi.getProviderAuthUrl(type);
      window.open(auth_url, 'swm-oauth', 'width=520,height=720,scrollbars=yes');
      toast.message('Finish connecting in the popup, then continue');
    } catch (error) {
      toast.error(apiError(error, 'Unable to start connection'));
    } finally {
      setBusy(false);
    }
  };

  const runSync = async () => {
    setBusy(true);
    try {
      await fetchIntegrations();
      const list = useIntegrationsStore.getState().integrations || [];
      const targets = list.filter((i) =>
        ['google_workspace', 'microsoft_365', 'plaid', 'okta', 'azure_ad'].includes(i.type),
      );
      if (targets.length === 0) {
        toast.info('No discovery connectors yet — add a subscription manually or connect a provider');
        return;
      }
      for (const item of targets.slice(0, 3)) {
        await syncIntegration(item.id);
      }
      toast.success('Discovery sync started');
      await fetchSubscriptions();
    } catch (error) {
      toast.error(apiError(error, 'Sync failed'));
    } finally {
      setBusy(false);
    }
  };

  const addManual = async () => {
    if (!manualName.trim()) {
      toast.error('Enter a subscription name');
      return;
    }
    setBusy(true);
    try {
      const { createSubscription } = useSubscriptionsStore.getState();
      await createSubscription({
        name: manualName.trim(),
        cost_per_unit: Number(manualCost) || 0,
        total_licenses: 1,
        used_licenses: 1,
        billing_cycle: 'monthly',
        status: 'active',
      } as never);
      toast.success('Subscription added');
      setManualName('');
      setManualCost('');
      await fetchSubscriptions();
      setStep(3);
    } catch (error) {
      toast.error(apiError(error, 'Could not add subscription'));
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      await organizationApi.updateSettings({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      } as never);
      await fetchOrganization();
      try {
        localStorage.setItem('swm_onboarding_completed', '1');
      } catch {
        /* ignore */
      }
      toast.success('You are ready to cut SaaS waste');
      router.push('/dashboard');
    } catch {
      try {
        localStorage.setItem('swm_onboarding_completed', '1');
      } catch {
        /* ignore */
      }
      router.push('/dashboard');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-8 py-4">
        <div>
          <Badge variant="secondary" className="mb-2">
            Setup
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight">Get to your first savings insight</h1>
          <p className="text-gray-500 mt-1">
            Connect a workspace directory or add one subscription manually — about five minutes.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {STEPS.map((label, index) => (
            <Badge
              key={label}
              variant={index === step ? 'default' : index < step ? 'secondary' : 'outline'}
            >
              {index + 1}. {label}
            </Badge>
          ))}
        </div>

        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                What SWM does
              </CardTitle>
              <CardDescription>
                Find unused seats and duplicate tools, then cancel or right-size before renewal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex gap-2">
                  <Search className="h-4 w-4 mt-0.5 shrink-0" />
                  Discover apps from Google Workspace or Microsoft 365
                </li>
                <li className="flex gap-2">
                  <Plug className="h-4 w-4 mt-0.5 shrink-0" />
                  Optionally link bank feeds (Plaid) on Pro / trial
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  Track everything manually if you prefer to start simple
                </li>
              </ul>
              <Button onClick={() => setStep(1)}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Connect a discovery source</CardTitle>
              <CardDescription>
                Trial and Pro unlock live connectors. You can skip and enter tools by hand.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => openProvider('google_workspace')}
                >
                  Google Workspace
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => openProvider('microsoft_365')}
                >
                  Microsoft 365
                </Button>
              </div>
              {connectedDiscovery.length > 0 && (
                <p className="text-sm text-green-700 dark:text-green-400">
                  Connected: {connectedDiscovery.map((i) => i.name || i.type).join(', ')}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { void fetchIntegrations(); setStep(2); }} disabled={busy}>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="ghost" onClick={() => setStep(2)}>
                  Skip for now
                </Button>
                <Button variant="link" asChild>
                  <Link href="/settings/integrations">Open integrations</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>First insight</CardTitle>
              <CardDescription>
                Run a sync if you connected a provider, or add your first subscription.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Button onClick={runSync} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Sync connected sources
                </Button>
                <p className="text-xs text-gray-500">
                  {subscriptions?.length
                    ? `${subscriptions.length} subscription(s) in this workspace`
                    : 'No subscriptions yet'}
                </p>
              </div>

              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">Or add one manually</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="sub-name">Name</Label>
                    <Input
                      id="sub-name"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="Slack"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sub-cost">Monthly cost (USD)</Label>
                    <Input
                      id="sub-cost"
                      type="number"
                      min="0"
                      value={manualCost}
                      onChange={(e) => setManualCost(e.target.value)}
                      placeholder="12.50"
                    />
                  </div>
                </div>
                <Button variant="secondary" onClick={addManual} disabled={busy}>
                  Save subscription
                </Button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button onClick={() => setStep(3)} disabled={busy}>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                You are set
              </CardTitle>
              <CardDescription>
                Next: review the dashboard, check recommendations, and set renewal alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={finish} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Go to dashboard
              </Button>
              <Button variant="outline" asChild>
                <Link href="/recommendations">View recommendations</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
