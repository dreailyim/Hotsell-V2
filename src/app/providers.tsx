'use client';

import { AuthProvider } from '@/hooks/use-auth';
import { ThemeProvider } from '@/components/theme-provider';
import { I18nProvider } from '@/i18n/client';
import { ReactNode } from 'react';

export function Providers({
  children,
  locale
}: {
  children: ReactNode;
  locale: string;
}) {
  return (
    <I18nProvider locale={locale}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
