'use client';

import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { BottomNav } from '@/components/layout/bottom-nav';
import { usePathname } from 'next/navigation';
import { Flame } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';

export default function MainLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const { t } = useTranslation();
  
  // The useFcm hook has been moved to the root layout via FcmRegistrar component.

  // This loading state is still useful to prevent content flashing while auth state is being determined.
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-4">
            <Flame className="h-16 w-16 text-primary animate-burn" />
            <p className="text-muted-foreground animate-pulse">{t('loading')}</p>
        </div>
      </div>
    );
  }
  
  const showBottomNav = !pathname.startsWith('/chat/');

  return (
    <div className="flex min-h-screen flex-col">
        <div className="flex-1 animate-zoom-in">
            <main className="pb-24 md:pb-0">{children}</main>
        </div>
        {showBottomNav && <BottomNav user={user} />}
    </div>
  );
}
