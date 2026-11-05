'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThemeControl() {
  const { resolvedTheme, setTheme } = useTheme();
  return <Button type="button" variant="ghost" size="icon" aria-label="Toggle color theme" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
    <Moon className="h-4 w-4 dark:hidden" aria-hidden="true" /><Sun className="hidden h-4 w-4 dark:block" aria-hidden="true" />
  </Button>;
}
