'use client';

import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { BottomNav } from '@/components/layout/bottom-nav';
import { useFcm } from '@/hooks/use-fcm';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function MainLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  // This hook handles FCM token registration and foreground messages.
  // It's safe to call here, it will only run its logic when a user is logged in.
  useFcm();

  useEffect(() => {
    // Wait until the auth state is determined.
    if (!loading) {
      // If auth state is determined and there's no user, redirect to login.
      if (!user) {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  // While loading the auth state, or if there's no user (and we are about to redirect),
  // show a loading spinner to prevent flashing content of a protected page.
  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If user is authenticated, render the layout with the children pages.
  return (
    <>
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 pb-24 md:pb-0">{children}</main>
      </div>
      <BottomNav />
    </>
  );
}
