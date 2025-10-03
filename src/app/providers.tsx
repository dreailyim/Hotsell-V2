'use client';

import { AuthProvider } from '@/hooks/use-auth';
import { ThemeProvider } from 'next-themes';
import { LanguageProvider } from '@/providers/language-provider';
import { ReactNode } from 'react';

export function Providers({
  children
}: {
  children: ReactNode;
}) {
  return (
    <LanguageProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
