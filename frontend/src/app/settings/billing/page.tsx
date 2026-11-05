'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCard, ExternalLink, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { FormMessage } from '@/components/form-message';
import { useAuthStore, useOrganizationStore } from '@/lib/stores';
import { organizationApi } from '@/lib/services';
import { apiErrorMessage } from '@/lib/api-error';
import { hardNavigate } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { BillingPlanOption, BillingStatus } from '@/types/swm';

export default function BillingSettingsPage() {
  const user = useAuthStore(state => state.user);
  const fetchOrganization = useOrganizationStore(state => state.fetchOrganization);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [selected, setSelected] = useState<BillingPlanOption | null>(null);
  const canManage = user?.role === 'admin';
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try { const result = await organizationApi.getBilling(); setBilling(result); void fetchOrganization(); return result; }
    catch { setError('Billing could not be loaded. Please retry or contact support.'); return null; }
    finally { setLoading(false); }
  }, [fetchOrganization]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const first = window.setTimeout(async () => {
      const outcome = new URLSearchParams(window.location.search).get('checkout');
      if (outcome) window.history.replaceState({}, '', '/settings/billing');
      const result = await load();
      if (!active || outcome !== 'success' || (result && ['pro', 'enterprise'].includes(result.plan))) return;
      setChecking(true);
      let attempts = 0;
      timer = setInterval(async () => {
        const current = await load(true); attempts++;
        if (!active) return;
        if ((current && ['pro', 'enterprise'].includes(current.plan)) || attempts >= 12) {
          if (timer) clearInterval(timer);
          setChecking(false);
          if (!(current && ['pro', 'enterprise'].includes(current.plan))) setError('Subscription confirmation is still pending. Refresh the status or contact support before starting another payment.');
        }
      }, 2500);
    }, 0);
    return () => { active = false; clearTimeout(first); if (timer) clearInterval(timer); };
  }, [load]);

  async function checkout() {
    if (!selected || !canManage) return;
    setBusy(selected.id); setError('');
    try { const result = await organizationApi.createCheckoutSession(selected.id); hardNavigate(result.checkout_url); }
    catch (failure) { setError(apiErrorMessage(failure, 'Checkout is temporarily unavailable. Please try again or contact support.')); setBusy(''); }
    finally { setSelected(null); }
  }
  async function portal() {
    setBusy('portal'); setError('');
    try { const result = await organizationApi.createBillingPortal(); hardNavigate(result.portal_url); }
    catch (failure) { setError(apiErrorMessage(failure, 'The billing portal is unavailable. Please contact support.')); setBusy(''); }
  }

  return <DashboardLayout><div className="max-w-5xl space-y-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Organization settings</p><h1 className="text-3xl font-bold tracking-tight">Billing & plans</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Review your access, choose a plan, or manage an existing subscription.</p></div><Button variant="outline" size="sm" onClick={() => { setError(''); void load(); }} disabled={loading}><RefreshCw className="h-4 w-4" aria-hidden="true" />Refresh status</Button></div><FormMessage message={error} />
    {checking && <div role="status" className="flex items-center gap-3 rounded-lg border bg-secondary p-4 text-sm"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Checking your subscription confirmation. Access changes only after payment-provider verification.</div>}
    {loading && !billing ? <div role="status" className="rounded-xl border bg-card p-8 text-muted-foreground">Loading your plan…</div> : billing ? <>
      <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="rounded-xl bg-secondary p-3"><CreditCard className="h-5 w-5 text-primary" aria-hidden="true" /></span><div><CardTitle className="text-xl">{billing.is_on_trial ? 'Your Pro trial' : billing.plan_label || billing.plan}</CardTitle><CardDescription className="mt-2 leading-6">{billing.is_on_trial ? `Trial ends ${billing.trial_ends_at ? new Date(billing.trial_ends_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'soon'}. No payment is required to continue with Starter afterward.` : billing.has_pro_access ? 'Paid features are active for your organization.' : 'Manual tracking is available on Starter. Upgrade explicitly when you need more.'}</CardDescription></div></div><Badge variant="secondary">{billing.is_on_trial ? 'Trial · no automatic charge' : billing.plan_label || billing.plan}</Badge></div></CardHeader><CardContent><div className="grid gap-3 rounded-xl bg-muted/50 p-4 text-sm sm:grid-cols-2"><p><span className="font-semibold">Seats:</span> {billing.seat_limit ?? 'Unlimited'}</p><p><span className="font-semibold">Subscriptions:</span> {billing.subscription_limit ?? 'Unlimited'}</p></div><div className="mt-5 flex flex-wrap gap-3"><Button variant="outline" onClick={portal} disabled={!canManage || !billing.has_stripe_customer || !!busy}>{busy === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" aria-hidden="true" />}Manage billing & invoices</Button><Button variant="ghost" asChild><Link href="/billing-policy">Cancellation & refund information</Link></Button></div><p className="mt-3 text-xs leading-6 text-muted-foreground">{canManage ? 'Use the portal for available invoices, payment methods, and cancellation. Review the effective cancellation date before confirming.' : 'Only an organization administrator can change the plan or open the billing portal. Ask your administrator for billing changes.'}</p></CardContent></Card>
      {!billing.stripe_configured && <div className="rounded-xl border bg-muted/50 p-5"><h2 className="font-semibold">Paid upgrades are currently unavailable.</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">You can continue with your available plan features. For help with an upgrade or billing access, <Link href="/contact" className="text-primary underline">contact support</Link>.</p></div>}
      <div className="grid gap-5 md:grid-cols-3">{billing.plans.map(plan => {
        const current = billing.plan === plan.id;
        return <Card key={plan.id} className={current ? 'border-blue-500' : ''}><CardHeader><CardTitle className="text-xl">{plan.name}</CardTitle><p className="mt-3 text-3xl font-bold">{plan.price}<span className="ml-2 text-sm font-normal text-muted-foreground">{plan.period === 'per month' ? '/ month' : plan.period === 'forever' ? 'forever' : ''}</span></p></CardHeader><CardContent><p className="mb-5 min-h-18 text-sm leading-7 text-muted-foreground">{plan.description}</p>{current ? <Button variant="secondary" className="w-full" disabled>{billing.is_on_trial ? 'Starter after trial' : 'Current plan'}</Button> : plan.checkout_enabled && !billing.has_stripe_subscription ? <Button className="w-full" onClick={() => setSelected(plan)} disabled={!canManage || !!busy || checking}>{busy === plan.id ? 'Opening checkout…' : `Choose ${plan.name}`}</Button> : plan.id === 'enterprise' ? <Button asChild variant="outline" className="w-full"><Link href="/contact">Talk to us</Link></Button> : billing.has_stripe_subscription ? <Button variant="outline" className="w-full" onClick={portal} disabled={!canManage || !!busy}>Manage in billing portal</Button> : <Button className="w-full" variant="outline" disabled>Currently unavailable</Button>}</CardContent></Card>;
      })}</div>
      <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-5 text-sm leading-7 text-muted-foreground"><ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><p>Starting a paid plan is an explicit choice. Subscription changes do not cancel any vendor subscriptions you track in SWM. <Link href="/help#billing" className="text-primary underline">Read the billing guide</Link>.</p></div>
    </> : <Card><CardContent className="py-10 text-center"><h2 className="font-semibold">Your billing details are unavailable.</h2><p className="mt-3 text-sm text-muted-foreground">Retry the request or contact your administrator.</p><Button variant="outline" className="mt-5" onClick={() => void load()}>Try again</Button></CardContent></Card>}
    <AlertDialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Continue with {selected?.name}?</AlertDialogTitle><AlertDialogDescription>The payment page will show {selected?.price} {selected?.period} and the final amount before confirmation. Upgrading starts the paid subscription you confirm; your remaining app trial does not postpone that charge. You can keep your current plan by canceling this step.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep current plan</AlertDialogCancel><AlertDialogAction onClick={checkout}>Continue to secure checkout</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div></DashboardLayout>;
}
