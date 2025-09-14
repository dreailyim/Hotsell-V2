
import * as admin from 'firebase-admin';
import type { FullUser, Conversation } from '@/lib/types';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

/**
 * Fetches all conversations for a given user, enriching them with details
 * about the other participant and the associated product.
 * This function is designed to be called from the client via HTTPS onCall.
 */
export const getConversationsForUser = async (data: any, context: any) => {
    // 1. Authentication check
    if (!context.auth) {
        throw new Error('Authentication required: You must be logged in to view conversations.');
    }
    const userId = context.auth.uid;

    try {
        // 2. Query conversations where the user is a participant
        const conversationsRef = db.collection('conversations');
        const querySnapshot = await conversationsRef
            .where('participantIds', 'array-contains', userId)
            .orderBy('lastActivity', 'desc')
            .get();

        if (querySnapshot.empty) {
            return [];
        }

        // 3. Fetch details for all other participants and products in parallel
        const userPromises: Promise<admin.firestore.DocumentSnapshot>[] = [];
        
        const participantIds = new Set<string>();

        querySnapshot.docs.forEach(doc => {
            const convo = doc.data() as Conversation;
            const otherUserId = convo.participantIds.find(pId => pId !== userId);
            if (otherUserId && !participantIds.has(otherUserId)) {
                participantIds.add(otherUserId);
            }
        });
        
        participantIds.forEach(id => {
             userPromises.push(db.collection('users').doc(id).get());
        })


        const userSnapshots = await Promise.all(userPromises);

        const usersCache = new Map<string, FullUser>();
        userSnapshots.forEach(snap => {
            if (snap.exists) {
                usersCache.set(snap.id, snap.data() as FullUser);
            }
        });

        // 4. Construct the final enriched conversation list
        const enrichedConversations = querySnapshot.docs
            .map(doc => {
                const convo = doc.data() as Conversation;

                // Filter out conversations hidden by the user
                if (convo.hiddenFor && convo.hiddenFor.includes(userId)) {
                    return null;
                }
                
                const otherUserId = convo.participantIds.find(pId => pId !== userId);
                if (!otherUserId) return null; // Should not happen in a valid conversation

                const otherUserDetails = usersCache.get(otherUserId) || {
                    uid: otherUserId,
                    displayName: '用戶',
                    photoURL: '',
                };
                
                return {
                    ...convo,
                    id: doc.id,
                    otherUserDetails, // Add the enriched details
                };
            })
            .filter(Boolean); // Remove null entries (e.g. hidden conversations)


        return enrichedConversations;

    } catch (error: any) {
        console.error('Error in getConversationsForUser:', error);
        // Throw a generic error to the client
        throw new Error(`Failed to fetch conversations. Error code: ${error.code || 'UNKNOWN'}`);
    }
};
