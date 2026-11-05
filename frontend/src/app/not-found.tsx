import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { PublicShell } from '@/components/public-shell';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return <PublicShell><section className="mx-auto max-w-2xl px-4 py-24 text-center"><SearchX className="mx-auto mb-6 h-12 w-12 text-primary" aria-hidden="true" /><p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">404 · Page not found</p><h1 className="mt-4 text-4xl font-bold tracking-tight">Let’s get you back on track.</h1><p className="mt-5 leading-8 text-muted-foreground">This link may have changed, or the page may no longer be available. Your workspace is still one step away.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Button asChild><Link href="/">Go home</Link></Button><Button asChild variant="outline"><Link href="/dashboard">Open dashboard</Link></Button><Button asChild variant="ghost"><Link href="/help">Find help</Link></Button></div></section></PublicShell>;
}
