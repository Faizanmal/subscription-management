import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, ShieldCheck, LifeBuoy } from 'lucide-react';
import { PublicShell } from '@/components/public-shell';
import { PageIntro } from '@/components/marketing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supportEmail } from '@/lib/public-content';

export const metadata: Metadata = { title: 'Contact | Subscription Waste Manager', alternates: { canonical: '/contact' } };
const contacts = [
  { title: 'Product, plans & support', email: supportEmail, icon: LifeBuoy, body: 'Questions about getting started, billing, integrations, or an issue with your workspace.' },
  { title: 'Privacy & your data', email: 'privacy@subscriptionwastemanager.com', icon: Mail, body: 'Requests about exports, deletion, or how information is processed.' },
  { title: 'Report a security issue', email: 'security@subscriptionwastemanager.com', icon: ShieldCheck, body: 'Report a suspected vulnerability or unauthorized access. Include safe reproduction details.' },
];
export default function ContactPage() {
  return <PublicShell><PageIntro eyebrow="Contact" title="Get help from the right place." description="Choose the subject that best fits your question. We’ll use your account and organization information to understand the request." /><section className="mx-auto max-w-6xl px-4 py-16 sm:px-6"><div className="grid gap-6 md:grid-cols-3">{contacts.map(item => <Card key={item.title}><CardHeader><item.icon className="mb-3 h-7 w-7 text-primary" aria-hidden="true" /><CardTitle className="text-xl">{item.title}</CardTitle></CardHeader><CardContent><p className="mb-5 text-sm leading-7 text-muted-foreground">{item.body}</p><a className="break-all text-sm font-medium text-primary underline" href={`mailto:${item.email}?subject=${encodeURIComponent(item.title)}`}>{item.email}</a></CardContent></Card>)}</div><div className="mx-auto mt-12 max-w-3xl rounded-xl bg-muted p-6 text-sm leading-7"><h2 className="text-lg font-semibold">What to include</h2><p className="mt-2">Send your account email, organization name, the affected page, and the approximate time of the issue. Screenshots should hide personal or financial information. Never include a password, access token, payment card details, or an active reset link.</p><p className="mt-3">Looking for a quick answer? Visit <Link href="/help" className="text-primary underline">Help & FAQ</Link>. Data requests follow the process on <Link href="/data" className="text-primary underline">Your data</Link>.</p></div></section></PublicShell>;
}
