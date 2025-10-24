'use client';

import { AuthProvider } from '@/hooks/use-auth';
import { LanguageProvider } from '@/providers/language-provider';
import { ThemeProvider } from 'next-themes';
import { ReactNode } from 'react';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export function Providers({
  children,
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
        <AuthProvider>
          {children}
          <FirebaseErrorListener />
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
