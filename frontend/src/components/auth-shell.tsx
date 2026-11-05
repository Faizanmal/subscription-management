import type { ReactNode } from 'react';
import { PublicShell } from '@/components/public-shell';

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <PublicShell><section className="bg-gradient-to-br from-blue-50/70 via-background to-indigo-50/50 px-4 py-12 dark:from-blue-950/30 dark:to-indigo-950/20 sm:py-16"><div className="mx-auto w-full max-w-md"><div className="mb-7 text-center"><h1 className="text-3xl font-bold tracking-tight">{title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p></div>{children}</div></section></PublicShell>;
}
