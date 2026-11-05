import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public-shell';
import { PageIntro, TrialCta } from '@/components/marketing';

export const metadata: Metadata = { title: 'About | Subscription Waste Manager', alternates: { canonical: '/about' } };
export default function AboutPage() {
  return <PublicShell><PageIntro eyebrow="About SWM" title="Make software spend easier to understand." description="Subscription Waste Manager helps IT and finance teams organize subscriptions, review usage, and decide where to reduce waste." /><article className="policy-content mx-auto max-w-3xl px-4 py-14 sm:px-6"><h2>Start with visibility</h2><p>Software spending becomes difficult to manage when subscriptions, owners, renewal dates, and usage information live in different places. SWM brings those records into one workspace so your team can review them together.</p><h2>From inventory to a decision</h2><p>Begin with manual tracking. Where supported sources are configured, connect them to help discover subscriptions and usage information. Review overlapping tools, available license data, and renewal dates before making a purchasing or cancellation decision.</p><h2>Keep your team in control</h2><p>Recommendations help you investigate opportunities. They do not guarantee savings, and updating a tracked record does not cancel a contract with its vendor. Your organization remains responsible for purchasing and vendor changes.</p><h2>Talk to us</h2><p>We are preparing the service for early users and welcome concrete feedback about your inventory and reporting needs. <Link href="/contact">Contact the product team</Link> or read the <Link href="/help">getting-started guides</Link>.</p></article><TrialCta /></PublicShell>;
}
