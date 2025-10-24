'use client';

// A custom error class for Firestore permission errors.
// This allows us to capture more context about the operation that failed.

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  public context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    const message = `FirestoreError: Missing or insufficient permissions.`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;

    // This is for logging the rich error to the developer console.
    // The Next.js error overlay will pick this up.
    console.error(message, JSON.stringify(this.context, null, 2));
  }
}
