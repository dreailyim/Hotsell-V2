
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

/**
 * A Firestore trigger that runs when a new message is created in any 'messages' subcollection.
 * It updates the parent conversation document (lastMessage, lastActivity, unread counts)
 * and the recipient's total unread count in their user document.
 */
export const onNewMessage = functions.region("asia-east2").firestore
  .document("conversations/{conversationId}/messages/{messageId}")
  .onCreate(async (snapshot, context) => {
    const { conversationId } = context.params;
    const messageData = snapshot.data();
    
    const senderId = messageData?.senderId;
    
    if (!senderId || !messageData) {
      console.log(`Message ${snapshot.id} is missing senderId or data. Exiting.`);
      return null;
    }

    const convoDocRef = db.collection("conversations").doc(conversationId);

    try {
      return db.runTransaction(async (transaction) => {
        const convoDoc = await transaction.get(convoDocRef);
        if (!convoDoc.exists) {
          console.warn(`Conversation ${conversationId} does not exist. This can happen if a conversation is deleted.`);
          return;
        }

        const convoData = convoDoc.data();
        const participants = convoData?.participantIds as string[] | undefined;

        if (!participants || participants.length < 2) {
          console.error(`Conversation ${conversationId} has invalid participantIds.`);
          return;
        }

        const otherUserId = participants.find(p => p !== senderId);

        if (!otherUserId) {
          console.error(`Could not determine the other user in conversation ${conversationId}.`);
          return;
        }

        // 1. Update the parent conversation document
        const convoUpdatePayload = {
          lastMessage: {
            text: messageData.text,
            senderId: senderId,
            timestamp: snapshot.createTime // Use the reliable server-side timestamp
          },
          lastActivity: snapshot.createTime, // Use the reliable server-side timestamp for sorting
          [`unreadCounts.${otherUserId}`]: admin.firestore.FieldValue.increment(1),
        };
        transaction.update(convoDocRef, convoUpdatePayload);

        // 2. Update the recipient's total unread count in their user document
        const userDocRef = db.collection("users").doc(otherUserId);
        // Use set with merge to prevent crashes if the user doc doesn't exist yet.
        transaction.set(userDocRef, {
            totalUnreadCount: admin.firestore.FieldValue.increment(1),
        }, { merge: true });
      });
    } catch (error) {
      console.error(
        `Error in onNewMessage transaction for conversation ${conversationId}:`,
        error
      );
      throw new functions.https.HttpsError('internal', 'Transaction failed in onNewMessage.', error);
    }
  });


/**
 * A Firestore trigger that runs when a user's document in the 'users' collection is updated.
 * It finds all conversations the user is a part of and updates their details (displayName, photoURL)
 * in the 'participantDetails' map of each conversation.
 */
export const onUserUpdate = functions.region("asia-east2").firestore
  .document("users/{userId}")
  .onUpdate(async (change, context) => {
    const { userId } = context.params;
    const newData = change.after.data();
    const oldData = change.before.data();

    if (newData.displayName === oldData.displayName && newData.photoURL === oldData.photoURL) {
      console.log(`User ${userId} data updated, but displayName and photoURL are unchanged. No conversation update needed.`);
      return null;
    }
    
    console.log(`User ${userId} updated. Syncing to conversations...`);
    
    const newDetails = {
        displayName: newData.displayName,
        photoURL: newData.photoURL,
    };

    const conversationsRef = db.collection("conversations");
    const q = conversationsRef.where("participantIds", "array-contains", userId);

    try {
      const querySnapshot = await q.get();

      if (querySnapshot.empty) {
        console.log(`User ${userId} is not in any conversations. Nothing to update.`);
        return null;
      }

      const batch = db.batch();
      querySnapshot.forEach(doc => {
        const convoRef = doc.ref;
        batch.update(convoRef, { [`participantDetails.${userId}`]: newDetails });
      });
      
      await batch.commit();

      console.log(`Successfully synced user ${userId} updates to ${querySnapshot.size} conversations.`);
      return null;

    } catch (error) {
       console.error(`Failed to sync user ${userId} updates to conversations:`, error);
       throw new functions.https.HttpsError(
        "internal",
        "Failed to update user details in conversations."
      );
    }
  });


/**
 * A Firestore trigger that runs when a conversation document is updated.
 * Specifically, it checks if an unread count for a user was reset to 0.
 * If so, it recalculates and updates that user's total unread count.
 */
export const onConversationUpdate = functions.region("asia-east2").firestore
  .document("conversations/{conversationId}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    const beforeUnreadCounts = beforeData.unreadCounts || {};
    const afterUnreadCounts = afterData.unreadCounts || {};

    const usersToRecalculate = new Set<string>();

    for (const userId in beforeUnreadCounts) {
      if ((beforeUnreadCounts[userId] > 0) && (afterUnreadCounts[userId] === 0)) {
        usersToRecalculate.add(userId);
      }
    }

    if (usersToRecalculate.size === 0) {
      return null;
    }

    console.log("Users to recalculate total unread count:", Array.from(usersToRecalculate));

    for (const userId of usersToRecalculate) {
      console.log(`Recalculating total unread count for user: ${userId}`);
      const conversationsRef = db.collection("conversations");
      const q = conversationsRef.where("participantIds", "array-contains", userId);
      
      try {
        const querySnapshot = await q.get();
        let total = 0;
        querySnapshot.forEach(doc => {
            const convo = doc.data();
            total += convo.unreadCounts?.[userId] || 0;
        });

        const userDocRef = db.collection("users").doc(userId);
        await userDocRef.update({ totalUnreadCount: total });

        console.log(`Successfully recalculated total unread count for ${userId} to ${total}`);

      } catch (error) {
         console.error(`Failed to recalculate total unread count for user ${userId}:`, error);
      }
    }

    return null;
  });
