import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public-shell';
import { FaqList, PageIntro, PricingGrid, TrialCta } from '@/components/marketing';

export const metadata: Metadata = { title: 'Pricing | Subscription Waste Manager', description: 'Compare Starter, Pro, and Enterprise. Start a 14-day Pro trial with no card.', alternates: { canonical: '/pricing' } };
export default function PricingPage() {
  return <PublicShell><PageIntro eyebrow="Simple plans" title="Start free. Upgrade when you choose." description="Track manually on Starter, or explore discovery and optimization with a 14-day Pro trial. Signup does not create a paid subscription." /><section className="mx-auto max-w-7xl px-4 py-16 sm:px-6"><PricingGrid /><p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-6 text-muted-foreground">Connectors and AI require an available, configured provider and the necessary permissions. Review the currency and total before confirming a payment. Read our <Link href="/billing-policy" className="text-primary underline">billing and cancellation information</Link>.</p></section><section className="bg-muted/30 px-4 py-16"><h2 className="mb-8 text-center text-3xl font-bold">Questions before you start?</h2><FaqList /></section><TrialCta /></PublicShell>;
}
