import type { ReactNode } from 'react';
import { PublicHeader } from '@/components/public-header';
import { PublicFooter } from '@/components/public-footer';

export function PublicShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground"><PublicHeader /><main id="main-content" tabIndex={-1}>{children}</main><PublicFooter /></div>;
}
