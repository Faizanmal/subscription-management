'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Brand } from '@/components/brand';
import { ThemeControl } from '@/components/theme-control';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const links = [{ href: '/#features', label: 'Features' }, { href: '/pricing', label: 'Pricing' }, { href: '/integrations', label: 'Integrations' }, { href: '/help', label: 'Help' }];

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return <>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Brand />
        <nav aria-label="Main navigation" className="hidden items-center gap-6 lg:flex">
          {links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined} className="text-sm font-medium text-muted-foreground hover:text-primary aria-[current=page]:text-primary">{link.label}</Link>)}
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeControl />
          <Button variant="ghost" asChild className="hidden sm:inline-flex"><Link href="/login">Sign in</Link></Button>
          <Button asChild size="sm"><Link href="/register">Start free</Link></Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation"><Menu aria-hidden="true" /></Button></SheetTrigger>
            <SheetContent className="w-[min(90vw,24rem)]">
              <SheetHeader><SheetTitle>Explore SWM</SheetTitle><SheetDescription>Product information and account access</SheetDescription></SheetHeader>
              <nav aria-label="Mobile navigation" className="mt-8 flex flex-col gap-2">
                {[...links, { href: '/about', label: 'About' }, { href: '/contact', label: 'Contact' }, { href: '/login', label: 'Sign in' }].map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 font-medium hover:bg-accent">{link.label}</Link>)}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  </>;
}
