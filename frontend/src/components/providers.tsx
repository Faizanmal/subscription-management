'use client';

import { ReactNode, useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { useAuthStore } from '@/lib/stores';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const loadProfile = useAuthStore((state) => state.loadProfile);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Load user profile on app init if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadProfile().catch(() => {
        // If profile load fails, user is logged out
      });
    }
  }, [isAuthenticated, loadProfile]);

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
