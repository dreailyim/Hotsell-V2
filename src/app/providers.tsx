
'use client';

import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/hooks/use-auth';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
