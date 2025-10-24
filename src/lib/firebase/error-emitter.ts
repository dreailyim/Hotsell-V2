import { EventEmitter } from 'events';

// A global event emitter to broadcast Firestore permission errors.
// Components can listen to this emitter to display error messages.
export const errorEmitter = new EventEmitter();
