'use client';

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { PublicShell } from '@/components/public-shell';
import { Button } from '@/components/ui/button';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PublicShell><section role="alert" className="mx-auto max-w-2xl px-4 py-24 text-center"><AlertCircle className="mx-auto mb-6 h-12 w-12 text-destructive" aria-hidden="true" /><h1 className="text-3xl font-bold tracking-tight">This page couldn’t be loaded.</h1><p className="mt-5 leading-7 text-muted-foreground">Please try again. If the issue continues, contact support with the page and approximate time. Avoid repeating a payment until you have checked its status.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Button onClick={reset}>Try again</Button><Button variant="outline" asChild><Link href="/">Go home</Link></Button><Button variant="ghost" asChild><Link href="/contact">Contact support</Link></Button></div></section></PublicShell>;
}
