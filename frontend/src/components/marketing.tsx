import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { faqs, plans } from '@/lib/public-content';

export function PageIntro({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <section className="border-b bg-gradient-to-b from-blue-50/70 to-background px-4 py-16 dark:from-blue-950/40 sm:px-6 sm:py-20"><div className="mx-auto max-w-4xl text-center"><p className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary">{eyebrow}</p><h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1><p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">{description}</p>{children && <div className="mt-8">{children}</div>}</div></section>;
}

export function PricingGrid() {
  return <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">{plans.map(plan => <Card key={plan.name} className={plan.featured ? 'relative border-2 border-blue-600 shadow-lg' : 'flex flex-col'}><CardHeader><div className="mb-2 flex items-center justify-between"><CardTitle className="text-xl">{plan.name}</CardTitle>{plan.featured && <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">14-day trial</span>}</div><p><span className="text-4xl font-bold tracking-tight">{plan.price}</span><span className="ml-2 text-sm text-muted-foreground">{plan.price.startsWith('$') ? 'USD' : ''}{plan.period ? ` / ${plan.period}` : ''}</span></p><p className="mt-3 text-sm leading-6 text-muted-foreground">{plan.description}</p></CardHeader><CardContent><ul className="mb-8 min-h-40 space-y-3">{plan.features.map(feature => <li key={feature} className="flex gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />{feature}</li>)}</ul><Button asChild variant={plan.featured ? 'default' : 'outline'} className="w-full"><Link href={plan.href}>{plan.cta}<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button></CardContent></Card>)}</div>;
}

export function FaqList() {
  return <div className="mx-auto max-w-3xl divide-y rounded-2xl border bg-card px-5 sm:px-8">{faqs.map(item => <details key={item.question} className="group py-5"><summary className="pr-4 font-semibold leading-6 marker:text-primary">{item.question}</summary><p className="mt-4 text-sm leading-7 text-muted-foreground">{item.answer}</p></details>)}</div>;
}

export function TrialCta() {
  return <section className="border-t bg-muted/40 px-4 py-16 text-center"><ShieldCheck className="mx-auto mb-4 h-8 w-8 text-primary" aria-hidden="true" /><h2 className="text-3xl font-bold tracking-tight">Start with your first subscription.</h2><p className="mx-auto mt-4 max-w-xl leading-7 text-muted-foreground">Try Pro for 14 days without a card. Keep manual tracking on Starter when the trial ends, or choose a paid plan from Billing.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Button asChild><Link href="/register">Start free</Link></Button><Button asChild variant="outline"><Link href="/contact">Ask a question</Link></Button></div></section>;
}
