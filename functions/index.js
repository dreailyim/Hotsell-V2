
"use strict";

const admin = require("firebase-admin");
const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const functions = require("firebase-functions");


admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Recursively deletes a collection and all its subcollections.
 * @param {FirebaseFirestore.CollectionReference} collectionRef The collection to delete.
 * @param {number} batchSize The number of documents to delete in each batch.
 */
async function deleteCollection(collectionRef, batchSize) {
    const query = collectionRef.limit(batchSize);
    let snapshot = await query.get();

    // When there are no documents left, we are done
    if (snapshot.size === 0) {
        return;
    }

    // Delete documents in a batch
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    // Recurse on the next batch
    process.nextTick(() => deleteCollection(collectionRef, batchSize));
}

// --- Notification Helper ---
/**
 * Creates a notification document in the 'notifications' collection
 * and sends a push notification to the user's devices.
 * This function has been refactored for robustness and better logging.
 * @param {string} userId The ID of the user who will receive the notification.
 * @param {object} notificationData The data for the notification.
 * @param {boolean} options.sendPushNotification Whether to send a push notification. Defaults to true.
 * @param {boolean} options.createInAppNotification Whether to create an in-app notification document. Defaults to true.
 */
async function createAndSendNotification(userId, notificationData, options = {}) {
  const { sendPushNotification = true, createInAppNotification = true } = options;

  if (!userId) {
    console.warn("createAndSendNotification called with null or undefined userId. Skipping.");
    return;
  }
  
  // 1. Create the in-app notification document (if requested).
  if (createInAppNotification) {
    try {
        const userRef = db.collection("users").doc(userId);
        
        await db.collection("notifications").add({
        userId: userId,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        ...notificationData,
        });

        // Also increment the total unread count for the user.
        await userRef.set({
            totalUnreadCount: admin.firestore.FieldValue.increment(1)
        }, { merge: true });

    } catch (error) {
        console.error(`Failed to create in-app notification document for user ${userId}.`, error);
        // We can still attempt to send a push notification.
    }
  }
  
  // 2. Send the push notification (FCM) (if requested).
  if (sendPushNotification) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            console.log(`User document ${userId} not found. Cannot send push notification.`);
            return;
        }
        
        const fcmTokens = userDoc.data()?.fcmTokens;
        if (!fcmTokens || !Array.isArray(fcmTokens) || fcmTokens.length === 0) {
            console.log(`User ${userId} has no FCM tokens. No push notification sent.`);
            return;
        }

        const clickTargetUrl = notificationData.relatedData?.conversationId
        ? `/chat/${notificationData.relatedData.conversationId}`
        : notificationData.relatedData?.productId
        ? `/products/${notificationData.relatedData.productId}`
        : `/messages`;

        const payload = {
        notification: {
            title: 'HotSell 有新通知！',
            body: notificationData.message,
        },
        data: {
            click_action: clickTargetUrl
        },
        webpush: {
            fcmOptions: {
                link: clickTargetUrl
            }
        },
        };
        
        console.log(`Attempting to send push notification to user ${userId} with payload:`, JSON.stringify(payload, null, 2));

        const response = await messaging.sendEachForMulticast({
            ...payload,
            tokens: fcmTokens
        });

        console.log(`Push notification sent to user ${userId}. Success count: ${response.successCount}, Failure count: ${response.failureCount}`);

        // 3. Clean up invalid tokens.
        if (response.failureCount > 0) {
        const invalidTokens = [];
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
            const errorCode = resp.error.code;
            if (errorCode === 'messaging/invalid-registration-token' ||
                errorCode === 'messaging/registration-token-not-registered' ||
                errorCode === 'messaging/invalid-argument') {
                invalidTokens.push(fcmTokens[idx]);
            }
            }
        });
        
        if (invalidTokens.length > 0) {
            console.log(`Found ${invalidTokens.length} invalid tokens for user ${userId}. Removing them...`);
            const userRef = db.collection('users').doc(userId);
            await userRef.update({
                fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens)
            });
            console.log(`Invalid tokens removed for user ${userId}.`);
        }
        }

    } catch (error) {
        console.error(`An unhandled error occurred while trying to send push notification to user ${userId}:`, error);
    }
  }
}


/**
 * A Firestore trigger that runs when a new message is created.
 * It sends a push notification to the recipient and updates their conversation unread count.
 * It NO LONGER creates a redundant in-app system notification for the new message.
 */
exports.processNewMessage = onDocumentCreated("conversations/{conversationId}/messages/{messageId}", async (event) => {
    const { conversationId } = event.params;
    const messageData = event.data.data();
    const senderId = messageData?.senderId;
    
    if (!senderId || !messageData) {
        console.error(`Message ${event.data.id} in conversation ${conversationId} is missing senderId or data.`);
        return;
    }

    const convoDocRef = db.collection("conversations").doc(conversationId);
    
    try {
        const convoDoc = await convoDocRef.get();
        if (!convoDoc.exists) {
            console.warn(`Conversation ${conversationId} does not exist. Cannot process new message.`);
            return;
        }

        const convoData = convoDoc.data();
        const participants = convoData?.participantIds;
        const otherUserId = participants.find(p => p !== senderId);

        if (!otherUserId) {
            console.error(`Could not determine the recipient in conversation ${conversationId}. Participants: ${participants}`);
            return;
        }
        
        // --- Send Push Notification (but no in-app notification) ---
        const senderDetails = convoData.participantDetails?.[senderId];
        if (!senderDetails) {
            console.error(`Could not find sender details for user ${senderId} in conversation ${conversationId}.`);
            return;
        }

        await createAndSendNotification(otherUserId, {
            type: 'new_message',
            message: `${senderDetails.displayName || '新訊息'}: ${messageData.text}`,
            relatedData: {
                conversationId: conversationId,
                productId: convoData.product.id, // For constructing the deeplink
            }
        }, { 
            createInAppNotification: false, // This is the key change!
            sendPushNotification: true 
        });

        // Atomically increment the unread count for the other user in the conversation
        await convoDocRef.update({
            [`unreadCounts.${otherUserId}`]: admin.firestore.FieldValue.increment(1),
        });

        // Increment the total unread count on the user document as well.
        const userRef = db.collection("users").doc(otherUserId);
        await userRef.set({
            totalUnreadCount: admin.firestore.FieldValue.increment(1)
        }, { merge: true });
        
    } catch (error) {
        console.error(`Failed to process new message for conversation ${conversationId}:`, error);
    }
});


/**
 * A Firestore trigger that runs when a user's document is updated.
 * It updates the user's details in all related conversations.
 */
exports.processUserUpdate = onDocumentUpdated("users/{userId}", async (event) => {
    const { userId } = event.params;
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    // Check if the relevant fields have changed.
    if (beforeData.displayName === afterData.displayName &&
        beforeData.photoURL === afterData.photoURL) {
        console.log(`User ${userId} data unchanged for conversations. Exiting.`);
        return;
    }

    const conversationsRef = db.collection("conversations");
    const q = conversationsRef.where("participantIds", "array-contains", userId);

    try {
        const querySnapshot = await q.get();
        if (querySnapshot.empty) {
            console.log(`User ${userId} is not in any conversations. Nothing to update.`);
            return;
        }

        const batch = db.batch();
        querySnapshot.forEach(doc => {
            const docRef = conversationsRef.doc(doc.id);
            // Update the details for the specific user in the map.
            batch.update(docRef, {
                [`participantDetails.${userId}.displayName`]: afterData.displayName,
                [`participantDetails.${userId}.photoURL`]: afterData.photoURL,
            });
        });

        await batch.commit();
        console.log(`Updated user data for ${userId} in ${querySnapshot.size} conversations.`);
    } catch (error) {
        console.error(`Failed to update user data in conversations for user ${userId}:`, error);
    }
});


/**
 * A Firestore trigger that runs when a conversation document is updated.
 * It has two main purposes:
 * 1. Recalculates total unread counts for users whose unread count was reset.
 * 2. Checks if a conversation should be permanently deleted if all participants have "hidden" it.
 */
exports.processConversationUpdate = onDocumentUpdated("conversations/{conversationId}", async (event) => {
    const { conversationId } = event.params;
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    
    // --- Logic 1: Handle permanent deletion ---
    const hiddenBy = afterData.hiddenFor || [];
    const participants = afterData.participantIds || [];
    
    // If all participants have hidden the chat, delete it.
    if (participants.length > 0 && hiddenBy.length >= participants.length) {
        console.log(`All ${participants.length} participants have hidden conversation ${conversationId}. Deleting...`);
        const conversationRef = event.data.after.ref;
        const messagesRef = conversationRef.collection("messages");

        // Delete the messages subcollection first
        await deleteCollection(messagesRef, 100);
        
        // Then delete the conversation document itself
        await conversationRef.delete();
        console.log(`Successfully deleted conversation ${conversationId} and its messages.`);
        // Exit early as the document is gone.
        return;
    }

    // --- Logic 2: Recalculate unread counts ---
    const beforeUnreadCounts = beforeData.unreadCounts || {};
    const afterUnreadCounts = afterData.unreadCounts || {};

    const usersToRecalculate = new Set();

    for (const userId in beforeUnreadCounts) {
        // If a specific user's count in THIS conversation went from >0 to 0.
        if ((beforeUnreadCounts[userId] > 0) && (!afterUnreadCounts[userId] || afterUnreadCounts[userId] === 0)) {
            usersToRecalculate.add(userId);
        }
    }

    if (usersToRecalculate.size === 0) {
        return;
    }

    const recalculationPromises = Array.from(usersToRecalculate).map(async (userId) => {
        const userRef = db.collection('users').doc(userId);
        // We need to get the total from BOTH conversations and notifications
        const convosQuery = db.collection("conversations").where("participantIds", "array-contains", userId);
        const notifsQuery = db.collection("notifications").where("userId", "==", userId).where("isRead", "==", false);

        try {
            const [convosSnapshot, notifsSnapshot] = await Promise.all([convosQuery.get(), notifsQuery.get()]);
            
            let convoUnread = 0;
            convosSnapshot.forEach(doc => {
                convoUnread += doc.data().unreadCounts?.[userId] || 0;
            });

            const notifsUnread = notifsSnapshot.size;

            await userRef.set({ totalUnreadCount: convoUnread + notifsUnread }, { merge: true });

        } catch (error) {
           console.error(`Failed to recalculate total unread count for user ${userId}:`, error);
        }
    });

    await Promise.all(recalculationPromises);
});


/**
 * A Firestore trigger that runs when a new review is created.
 * It recalculates the average rating and review count for the rated user.
 * It also sends a notification to the rated user.
 */
exports.processNewReview = onDocumentCreated("reviews/{reviewId}", async (event) => {
    const reviewData = event.data.data();
    const ratedUserId = reviewData?.ratedUserId;

    if (!ratedUserId) {
        console.error(`Review ${event.data.id} is missing ratedUserId.`);
        return;
    }

    // --- Recalculate Ratings ---
    const userDocRef = db.collection("users").doc(ratedUserId);
    try {
        await db.runTransaction(async (transaction) => {
            const reviewsQuery = db.collection("reviews").where("ratedUserId", "==", ratedUserId);
            const reviewsSnapshot = await transaction.get(reviewsQuery);

            if (reviewsSnapshot.empty) {
                await transaction.update(userDocRef, { averageRating: 0, reviewCount: 0 });
                return;
            }

            let totalRating = 0;
            reviewsSnapshot.forEach(doc => {
                totalRating += doc.data().rating;
            });

            const reviewCount = reviewsSnapshot.size;
            const averageRating = totalRating / reviewCount;

            transaction.update(userDocRef, { averageRating: averageRating, reviewCount: reviewCount });
        });
        console.log(`Successfully updated ratings for user ${ratedUserId}.`);
    } catch (error) {
        console.error(`Failed to update ratings for user ${ratedUserId}:`, error);
    }

    // --- Send Notification ---
    await createAndSendNotification(ratedUserId, {
        type: 'new_review',
        message: `${reviewData.reviewerName} 對您作出了評價。`,
        relatedData: {
            productId: reviewData.productId,
            productName: reviewData.productName,
            productImage: reviewData.productImage,
            actorId: reviewData.reviewerId,
            actorName: reviewData.reviewerName
        }
    });
});


/**
 * Firestore trigger for when a product is created.
 * Sends a notification to the seller.
 */
exports.onProductCreated = onDocumentCreated("products/{productId}", (event) => {
    const product = event.data.data();
    const sellerId = product.sellerId;
    const productName = product.name;

    return createAndSendNotification(sellerId, {
        type: 'new_listing_success',
        message: `您已成功上架新產品：${productName}`,
        relatedData: {
            productId: event.params.productId,
            productName: productName,
            productImage: product.image,
        }
    });
});


/**
 * A Firestore trigger that runs when a product document is updated.
 * Handles multiple notification and data consistency logics.
 */
exports.onProductUpdated = onDocumentUpdated("products/{productId}", async (event) => {
    const afterData = event.data.after.data();
    const beforeData = event.data.before.data();
    const productId = event.params.productId;

    // --- Logic 1: Update favorites count (backend-managed) ---
    const afterFavoritedBy = afterData.favoritedBy || [];
    const beforeFavoritedBy = beforeData.favoritedBy || [];
    if (afterFavoritedBy.length !== beforeFavoritedBy.length) {
        await event.data.after.ref.update({ favorites: afterFavoritedBy.length });
    }

    // --- Logic 2: Notify seller of new favorite ---
    if (afterFavoritedBy.length > beforeFavoritedBy.length) {
        const newFavoriterId = afterFavoritedBy.find(uid => !beforeFavoritedBy.includes(uid));
        if (newFavoriterId && newFavoriterId !== afterData.sellerId) {
            const favoriterDoc = await db.collection("users").doc(newFavoriterId).get();
            const favoriterName = favoriterDoc.exists() ? favoriterDoc.data().displayName : "一位使用者";
            
            await createAndSendNotification(afterData.sellerId, {
                type: 'new_favorite',
                message: `${favoriterName} 收藏了您的產品：${afterData.name}`,
                relatedData: {
                    productId: productId,
                    productName: afterData.name,
                    productImage: afterData.image,
                    actorId: newFavoriterId,
                    actorName: favoriterName,
                }
            });
        }
    }

    // --- Logic 3: Notify favoriters of price drop ---
    if (afterData.price < beforeData.price) {
        const notificationPromises = beforeFavoritedBy.map(userId => {
            if (userId === afterData.sellerId) return null; // Don't notify the seller
            return createAndSendNotification(userId, {
                type: 'price_drop',
                message: `您收藏的產品「${afterData.name}」已減價！`,
                relatedData: {
                    productId: productId,
                    productName: afterData.name,
                    productImage: afterData.image,
                    price: afterData.price
                }
            });
        });
        await Promise.all(notificationPromises);
    }
    
    // --- Logic 4: Notify seller and favoriters of sale ---
    if (afterData.status === 'sold' && beforeData.status !== 'sold') {
        // Notify seller
        await createAndSendNotification(afterData.sellerId, {
            type: 'item_sold',
            message: `恭喜！您的產品「${afterData.name}」已成功賣出。`,
            relatedData: {
                productId: productId,
                productName: afterData.name,
                productImage: afterData.image
            }
        });
        // Notify favoriters
         const saleNotificationPromises = beforeFavoritedBy.map(userId => {
            if (userId === afterData.sellerId) return null;
            return createAndSendNotification(userId, {
                type: 'item_sold_to_other',
                message: `您收藏的產品「${afterData.name}」已賣出。`,
                 relatedData: {
                    productId: productId,
                    productName: afterData.name,
                    productImage: afterData.image,
                }
            });
        });
        await Promise.all(saleNotificationPromises);
    }
});


/**
 * A function to handle cleanup when a conversation is deleted.
 * Recalculates total unread counts for all participants as a safety net.
 */
exports.onConversationDeleted = onDocumentDeleted("conversations/{conversationId}", async (event) => {
    const data = event.data.data();
    const participants = data.participantIds || [];

    const recalculationPromises = participants.map(async (userId) => {
        const userRef = db.collection('users').doc(userId);
        const convosQuery = db.collection("conversations").where("participantIds", "array-contains", userId);
        const notifsQuery = db.collection("notifications").where("userId", "==", userId).where("isRead", "==", false);

        try {
            const [convosSnapshot, notifsSnapshot] = await Promise.all([convosQuery.get(), notifsSnapshot.get()]);
            
            let convoUnread = 0;
            convosSnapshot.forEach(doc => {
                convoUnread += doc.data().unreadCounts?.[userId] || 0;
            });

            const notifsUnread = notifsSnapshot.size;

            await userRef.set({ totalUnreadCount: convoUnread + notifsUnread }, { merge: true });
            console.log(`Recalculated unread count for user ${userId} to ${convoUnread + notifsUnread} after conversation deletion.`);

        } catch (error) {
           console.error(`Failed to recalculate total unread count for user ${userId} after conversation deletion:`, error);
        }
    });

    await Promise.all(recalculationPromises);
});

/**
 * An HTTPS Callable function that securely fetches all conversations for the calling user.
 * This function bypasses client-side query limitations and permission issues by running
 * the query in a trusted backend environment.
 */
exports.getConversationsForUser = onCall({ region: "us-central1" }, async (request) => {
    if (!request.auth) {
        // Throwing an HttpsError so that the client side can correctly handle it.
        throw new HttpsError(
            "unauthenticated",
            "The function must be called while authenticated."
        );
    }

    const userId = request.auth.uid;

    try {
        const convosQuery = db.collection("conversations")
            .where("participantIds", "array-contains", userId)
            .orderBy("lastActivity", "desc");

        const convosSnapshot = await convosQuery.get();

        if (convosSnapshot.empty) {
            return [];
        }
        
        // Filter out conversations hidden by the user
        const visibleConvos = convosSnapshot.docs.filter(doc => {
            const hiddenFor = doc.data().hiddenFor || [];
            return !hiddenFor.includes(userId);
        });

        // Enrich conversation data with the other participant's details
        const enrichedConvos = await Promise.all(
            visibleConvos.map(async (doc) => {
                const convoData = doc.data();
                const otherUserId = convoData.participantIds.find(id => id !== userId);
                let otherUserDetails = {};

                if (otherUserId) {
                    if (convoData.participantDetails && convoData.participantDetails[otherUserId]) {
                        otherUserDetails = convoData.participantDetails[otherUserId];
                    } else {
                         // Fallback to fetching user doc directly if details are missing
                        const userDoc = await db.collection('users').doc(otherUserId).get();
                        if (userDoc.exists) {
                            const { displayName, photoURL } = userDoc.data();
                            otherUserDetails = { displayName, photoURL };
                        } else {
                             otherUserDetails = { displayName: "未知用戶", photoURL: "" };
                        }
                    }
                }
                
                return {
                    ...convoData,
                    id: doc.id,
                    otherUserDetails: {
                        uid: otherUserId,
                        ...otherUserDetails
                    }
                };
            })
        );
        
        return enrichedConvos;

    } catch (error) {
        console.error("Error fetching conversations for user:", userId, error);
        // Throw a generic error to avoid leaking implementation details.
        throw new HttpsError(
            "internal",
            "An error occurred while fetching conversations."
        );
    }
});

/**
 * A Firestore trigger that runs when a notification document is updated.
 * It recalculates the total unread count for the user if a notification is marked as read.
 */
exports.onNotificationUpdated = onDocumentUpdated("notifications/{notificationId}", async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const userId = afterData.userId;

    // Check if the 'isRead' status changed from false to true
    if (beforeData.isRead === false && afterData.isRead === true) {
        console.log(`Notification for user ${userId} marked as read. Recalculating total unread count.`);
        
        const userRef = db.collection('users').doc(userId);
        const convosQuery = db.collection("conversations").where("participantIds", "array-contains", userId);
        const notifsQuery = db.collection("notifications").where("userId", "==", userId).where("isRead", "==", false);

        try {
            const [convosSnapshot, notifsSnapshot] = await Promise.all([convosQuery.get(), notifsQuery.get()]);
            
            let convoUnread = 0;
            convosSnapshot.forEach(doc => {
                convoUnread += doc.data().unreadCounts?.[userId] || 0;
            });

            const notifsUnread = notifsSnapshot.size;

            await userRef.set({ totalUnreadCount: convoUnread + notifsUnread }, { merge: true });
            console.log(`Successfully recalculated total unread count for ${userId} to ${convoUnread + notifsUnread}.`);
        } catch (error) {
           console.error(`Failed to recalculate total unread count for user ${userId}:`, error);
        }
    }
});

    

    