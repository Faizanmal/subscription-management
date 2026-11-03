'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { useOrganizationStore } from '@/lib/stores';
import { organizationApi } from '@/lib/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { hardNavigate } from '@/lib/navigation';
import type { BillingStatus } from '@/types/swm';

export default function BillingSettingsPage() {
  const { fetchOrganization } = useOrganizationStore();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const [status] = await Promise.all([organizationApi.getBilling(), fetchOrganization()]);
      setBilling(status);
    } catch {
      toast.error('Unable to load billing');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      toast.success('Checkout complete. Plan updates after Stripe confirms the subscription.');
      window.history.replaceState({}, '', '/settings/billing');
    } else if (params.get('checkout') === 'cancel') {
      toast.info('Checkout was cancelled');
      window.history.replaceState({}, '', '/settings/billing');
    }
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apiError = (error: unknown, fallback: string) => {
    const err = error as { response?: { data?: { error?: string } }; message?: string };
    return err.response?.data?.error || err.message || fallback;
  };

  const handleCheckout = async (planId: string) => {
    setBusyPlan(planId);
    try {
      const { checkout_url } = await organizationApi.createCheckoutSession(planId);
      hardNavigate(checkout_url);
    } catch (error) {
      toast.error(apiError(error, 'Unable to start checkout'));
      setBusyPlan(null);
    }
  };

  const handlePortal = async () => {
    setBusyPlan('portal');
    try {
      const { portal_url } = await organizationApi.createBillingPortal();
      hardNavigate(portal_url);
    } catch (error) {
      toast.error(apiError(error, 'Unable to open billing portal'));
      setBusyPlan(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Settings
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-gray-500">Plan and payment methods for this workspace</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Current plan</CardTitle>
                  <CardDescription>
                    {billing?.is_on_trial
                      ? `Trial ends ${billing.trial_ends_at ? new Date(billing.trial_ends_at).toLocaleDateString() : 'soon'} · Pro features unlocked`
                      : billing?.has_pro_access
                        ? 'Pro features active'
                        : 'Starter plan — upgrade for discovery, AI, and bank feeds'}
                  </CardDescription>
                </div>
              </div>
              {billing && (
                <Badge className="capitalize">{billing.plan_label || billing.plan}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {billing?.features && (
              <ul className="grid sm:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                {Object.entries(billing.feature_labels || {}).map(([key, label]) => (
                  <li key={key} className="flex items-start gap-2">
                    <span className={billing.features?.[key] ? 'text-green-600' : 'text-gray-400'}>
                      {billing.features?.[key] ? '✓' : '–'}
                    </span>
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            )}
            {(billing?.seat_limit || billing?.subscription_limit) && (
              <p className="text-xs text-gray-500">
                Limits: {billing.seat_limit ?? '∞'} seats · {billing.subscription_limit ?? '∞'} subscriptions
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handlePortal}
                disabled={!billing?.has_stripe_customer || busyPlan === 'portal'}
              >
                {busyPlan === 'portal' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Manage payment methods
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/settings/organization">Organization details</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <p className="text-sm text-gray-500">Loading plans...</p>
        ) : !billing ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
              <p className="text-sm text-gray-500">Billing details could not be loaded.</p>
              <Button variant="outline" onClick={() => void load()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(billing.plans || []).map((plan) => {
              const current = billing.plan === plan.id;
              return (
                <Card key={plan.id} className={current ? 'border-blue-600' : undefined}>
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>
                      <span className="text-2xl font-semibold text-foreground">{plan.price}</span>
                      <span className="ml-1">/{plan.period}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-500">{plan.description}</p>
                    {current ? (
                      <Button className="w-full" variant="secondary" disabled>
                        Current plan
                      </Button>
                    ) : plan.checkout_enabled ? (
                      <Button
                        className="w-full"
                        onClick={() => handleCheckout(plan.id)}
                        disabled={busyPlan === plan.id}
                      >
                        {busyPlan === plan.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Upgrade
                      </Button>
                    ) : plan.id === 'enterprise' ? (
                      <Button className="w-full" variant="outline" asChild>
                        <a href="mailto:sales@subscriptionwastemanager.com">Contact sales</a>
                      </Button>
                    ) : (
                      <Button className="w-full" variant="outline" disabled>
                        {billing.stripe_configured ? 'Not available' : 'Stripe not configured'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {billing && !billing.stripe_configured && (
          <p className="text-sm text-gray-500">
            Paid upgrades need STRIPE_SECRET_KEY and STRIPE_PRICE_PRO on the API server, plus a webhook to{' '}
            <code className="text-xs">/api/v1/auth/billing/webhook/</code>.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
