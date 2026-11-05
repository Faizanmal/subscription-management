import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public-shell';
import { FaqList, PageIntro } from '@/components/marketing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Help & FAQ | Subscription Waste Manager', alternates: { canonical: '/help' } };
const guides = [
  { id: 'getting-started', title: 'Build your first inventory', steps: ['Create an account and organization. Confirm the current Terms and privacy acknowledgement.', 'Complete onboarding and add a subscription manually: name, price, billing cycle, and renewal date.', 'Review the Dashboard and check that monthly cost and renewal information look right.'], href: '/onboarding', label: 'Open onboarding' },
  { id: 'connecting', title: 'Connect a source', steps: ['Open Settings → Integrations as an organization admin and choose a supported provider.', 'Review the required permissions and complete the provider’s authorization flow.', 'Run a sync and review imported records. Disconnect or revoke provider access when no longer needed.'], href: '/integrations', label: 'See supported sources' },
  { id: 'billing', title: 'Manage your plan', steps: ['Your 14-day app trial begins without a card. Trial expiry does not automatically create a paid subscription.', 'Organization admins can explicitly upgrade in Settings → Billing.', 'Use Manage billing for the payment provider’s available invoices, payment methods, and cancellation options.'], href: '/billing-policy', label: 'Read billing information' },
  { id: 'account', title: 'Access and account recovery', steps: ['Use Forgot password to request a reset link. Check spam and confirm that the email address matches your account.', 'MFA accounts use email, password, and an unused authenticator code. Keep your authenticator available when signing in.', 'For access, billing, or data requests that need help, contact support from your account email. Never send passwords, reset links, or access tokens.'], href: '/contact', label: 'Contact support' },
];
export default function HelpPage() {
  return <PublicShell><PageIntro eyebrow="Help center" title="A clear next step, wherever you are." description="Set up your inventory, understand your plan, and find help with account access." /><section className="mx-auto max-w-6xl px-4 py-12 sm:px-6"><nav aria-label="Help topics" className="mb-10 flex flex-wrap gap-3">{guides.map(guide => <Link key={guide.id} href={`#${guide.id}`} className="rounded-full border px-4 py-2 text-sm hover:bg-accent">{guide.title}</Link>)}</nav><div className="grid gap-6 md:grid-cols-2">{guides.map(guide => <Card key={guide.id} id={guide.id}><CardHeader><CardTitle className="text-xl">{guide.title}</CardTitle></CardHeader><CardContent><ol className="list-decimal space-y-3 pl-5 text-sm leading-7 text-muted-foreground">{guide.steps.map(step => <li key={step}>{step}</li>)}</ol><Button asChild variant="link" className="mt-5 px-0"><Link href={guide.href}>{guide.label} →</Link></Button></CardContent></Card>)}</div></section><section id="faq" className="px-4 py-16"><h2 className="mb-8 text-center text-3xl font-bold">Frequently asked questions</h2><FaqList /></section></PublicShell>;
}
