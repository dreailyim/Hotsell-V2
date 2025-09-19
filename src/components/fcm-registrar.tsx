'use client';

import { useFcm } from '@/hooks/use-fcm';

/**
 * This is a client component whose sole purpose is to activate the useFcm hook
 * at the top level of the application.
 */
export function FcmRegistrar() {
  useFcm();
  return null;
}
