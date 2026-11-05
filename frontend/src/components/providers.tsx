'use client';

import { ReactNode, useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { useAuthStore } from '@/lib/stores';
import { usePathname, useRouter } from 'next/navigation';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const loadProfile = useAuthStore((state) => state.loadProfile);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore(state => state.user);

  // Load user profile on app init if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadProfile().catch(() => {
        // If profile load fails, user is logged out
      });
    }
  }, [isAuthenticated, loadProfile]);

  useEffect(() => {
    const protectedPage = ['/dashboard', '/settings', '/subscriptions', '/analytics', '/recommendations', '/workflows', '/alerts', '/onboarding'].some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
    if (protectedPage && isAuthenticated && user?.email_verification_required) { router.replace('/verify-email'); return; }
    if (protectedPage && isAuthenticated && user?.agreements_required) router.replace('/agreements');
  }, [pathname, isAuthenticated, user?.agreements_required, user?.email_verification_required, router]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
