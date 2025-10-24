'use client';

import { useEffect, useState } from 'react';
import { errorEmitter } from '@/lib/firebase/error-emitter';
import { FirestorePermissionError } from '@/lib/firebase/errors';

/**
 * A client component that listens for Firestore permission errors
 * and can be used to display them to the user, for example, in a toast.
 * 
 * For this implementation, we will rely on the Next.js error overlay
 * which will automatically display the console.error from the custom error.
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (e: FirestorePermissionError) => {
      setError(e);
      // The custom error already logs to the console, which is what the
      // Next.js error overlay uses. No need to show a toast here for dev.
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  // This component doesn't render anything itself.
  // It just listens for errors and triggers logging.
  return null;
}
