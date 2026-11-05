import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public-shell';
import { PageIntro, TrialCta } from '@/components/marketing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { connectors } from '@/lib/public-content';

export const metadata: Metadata = { title: 'Integrations | Subscription Waste Manager', alternates: { canonical: '/integrations' } };
export default function IntegrationsPage() {
  return <PublicShell><PageIntro eyebrow="Connect your sources" title="Your software inventory, in one place." description="Start with manual entries, then connect the sources your organization uses. Access and availability depend on provider setup, permissions, and your plan." /><section className="mx-auto max-w-6xl px-4 py-16 sm:px-6"><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{connectors.map(item => <Card key={item.name}><CardHeader><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">{item.category}</p><CardTitle className="text-xl">{item.name}</CardTitle></CardHeader><CardContent><p className="text-sm leading-7 text-muted-foreground">{item.description}</p><p className="mt-5 text-xs font-medium text-muted-foreground">Provider configuration required</p></CardContent></Card>)}</div><div className="mt-10 rounded-xl border bg-muted/40 p-6 text-sm leading-7"><h2 className="mb-2 text-lg font-semibold">Before connecting</h2><p>Check that you can grant the requested permissions. Review your provider’s consent screen, start with one source, and inspect the imported data after the first sync. You can disconnect a source from Settings → Integrations and revoke access at the provider.</p><p className="mt-3">QuickBooks, Xero, HR connectors, and Microsoft Teams notifications are future work and are not offered as live connections. Need a particular source? <Link href="/contact" className="text-primary underline">Tell us what you need</Link>.</p></div></section><TrialCta /></PublicShell>;
}
