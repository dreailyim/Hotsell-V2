
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Flame } from 'lucide-react';

/**
 * This page acts as a redirector.
 * It redirects the user to their own profile page if they are logged in,
 * or to the login page if they are not.
 * This is necessary because the bottom navigation links to `/profile` statically.
 */
export default function ProfileRedirectPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait until the authentication state is determined
    if (!loading) {
      if (user) {
        // If user is logged in, redirect to their dynamic profile page
        router.replace(`/profile/${user.uid}`);
      } else {
        // If user is not logged in, redirect to the login page
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  // Display a loading indicator while the redirect is in progress
  return (
    <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-4">
            <Flame className="h-16 w-16 text-primary animate-burn" />
            <p className="text-muted-foreground animate-pulse">載入中...</p>
        </div>
    </div>
  );
}
