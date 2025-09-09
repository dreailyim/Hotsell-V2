
'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { BottomNav } from '@/components/layout/bottom-nav';
import { useFcm } from '@/hooks/use-fcm';


export default function MainLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  // This hook handles FCM token registration and foreground messages.
  // It's safe to call here, it will only run its logic when a user is logged in.
  useFcm();

  return (
    <>
      <div className="flex min-h-screen flex-col">
        <main className="flex-1">{children}</main>
      </div>
      {user && <BottomNav />}
    </>
  );
}
