import Link from 'next/link';
import { Brand } from '@/components/brand';
import { businessCountry, businessName, productName, supportEmail } from '@/lib/public-content';

const groups = [
  { title: 'Product', links: [['Features', '/#features'], ['Pricing', '/pricing'], ['Integrations', '/integrations'], ['Help & FAQ', '/help']] },
  { title: 'Company', links: [['About', '/about'], ['Contact', '/contact'], ['Support', '/support'], ['Billing & cancellation', '/billing-policy']] },
  { title: 'Trust & data', links: [['Privacy Policy', '/privacy'], ['Terms of Service', '/terms'], ['Security', '/security'], ['Your data', '/data'], ['Cookies & storage', '/cookies']] },
];

export function PublicFooter() {
  return <footer className="border-t bg-muted/40">
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div><Brand /><p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">A clearer view of software spend, renewals, and opportunities to save.</p><a href={`mailto:${supportEmail}`} className="mt-4 inline-block break-all text-sm text-primary hover:underline">{supportEmail}</a></div>
        {groups.map(group => <nav key={group.title} aria-label={`${group.title} links`}><h2 className="mb-4 text-sm font-semibold">{group.title}</h2><ul className="space-y-3">{group.links.map(([label, href]) => <li key={href}><Link href={href} className="text-sm text-muted-foreground hover:text-primary hover:underline">{label}</Link></li>)}</ul></nav>)}
      </div>
      <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs leading-5 text-muted-foreground sm:flex-row sm:justify-between"><p>© {new Date().getFullYear()} {businessName || productName}. All rights reserved.{businessCountry ? ` ${businessCountry}.` : ''}</p><p>Start with a 14-day trial. No card required.</p></div>
    </div>
  </footer>;
}
