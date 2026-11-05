import type { ReactNode } from 'react';
import { businessName, businessCountry } from '@/lib/public-content';
import { PublicShell } from '@/components/public-shell';

export function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return <PublicShell><article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
    <p className="mb-3 text-sm text-muted-foreground">Last updated {updated}</p>
    <h1 className="mb-8 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
    {(!businessName || !businessCountry) && <p className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">Preview policy: business identity, jurisdiction, and final legal review are pending. This site is being prepared for launch.</p>}
    <div className="policy-content">{children}</div>
  </article></PublicShell>;
}
