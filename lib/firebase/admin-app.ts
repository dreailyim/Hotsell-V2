import admin from 'firebase-admin';

// This function initializes the Firebase Admin SDK.
// It's designed to be idempotent, meaning it can be called multiple times
// without causing issues, as it checks if an app is already initialized.
export function initFirebaseAdmin() {
  if (!admin.apps.length) {
    try {
      // When deployed to Firebase/Google Cloud, the SDK will automatically
      // find the service account credentials from the environment.
      // For local development, you must set the GOOGLE_APPLICATION_CREDENTIALS
      // environment variable to point to your service account JSON file.
      admin.initializeApp();
      console.log('Firebase Admin SDK initialized.');
    } catch (error: any) {
      console.error('Firebase admin initialization error', error.stack);
      throw new Error('Failed to initialize Firebase Admin SDK');
    }
  }
  return admin.app();
}
