'use client';

import { useAuth } from './use-auth';

/**
 * A simplified hook that consumes the total unread count from the global AuthContext.
 * The actual calculation logic is now handled within the AuthProvider to ensure
 * it runs immediately after login and persists across page navigations.
 */
export function useUnreadCount() {
  const { totalUnreadCount } = useAuth();
  return totalUnreadCount;
}
