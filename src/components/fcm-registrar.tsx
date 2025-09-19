'use client';

import { useFcm } from '@/hooks/use-fcm';

/**
 * This component's sole purpose is to activate the useFcm hook
 * in a client-side context at the root of the application.
 * This ensures that the FCM logic is initialized as soon as the app loads.
 */
export function FcmRegistrar() {
  useFcm();
  return null; // This component does not render anything.
}
