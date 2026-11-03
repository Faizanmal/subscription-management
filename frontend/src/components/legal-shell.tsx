'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <nav className="border-b">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight">
            Subscription Waste Manager
          </Link>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">Start free</Link>
            </Button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-3xl px-4 py-12 prose prose-gray dark:prose-invert">
        <p className="text-sm text-gray-500 not-prose mb-2">Last updated {updated}</p>
        <h1 className="text-3xl font-bold tracking-tight mb-8 not-prose">{title}</h1>
        {children}
      </main>
      <footer className="border-t py-8 text-center text-sm text-gray-500">
        <Link href="/privacy" className="hover:underline mx-2">
          Privacy
        </Link>
        <Link href="/terms" className="hover:underline mx-2">
          Terms
        </Link>
        <Link href="/security" className="hover:underline mx-2">
          Security
        </Link>
        <Link href="/data" className="hover:underline mx-2">
          Your data
        </Link>
        <Link href="/support" className="hover:underline mx-2">
          Support
        </Link>
      </footer>
    </div>
  );
}
