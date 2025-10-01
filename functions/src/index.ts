
'use strict';

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// Define the type directly in the file as it cannot be imported from the frontend.
type SystemNotification = {
    id: string;
    userId: string;
    type: 'new_favorite' | 'item_sold_to_other' | 'price_drop' | 'new_listing_success' | 'item_sold' | 'new_review' | 'new_message';
    message: string;
    isRead: boolean;
    createdAt: Timestamp | admin.firestore.FieldValue;
    relatedData?: {
        click_action?: string;
        conversationId?: string;
        productId?: string;
        productName?: string;
        productImage?: string;
        actorId?: string;
        actorName?: string;
        price?: number;
    };
};


admin.initializeApp();

const db = admin.firestore();
const fcm = admin.messaging();

/**
 * Sends a push notification to a specific user.
 * @param {string} userId The ID of the user to send the notification to.
 * @param {admin.messaging.Notification} notification The notification payload.
 * @param {string | undefined} link The deep link for the notification.
 */
async function sendPushNotification(userId: string, notification: admin.messaging.Notification, link?: string) {
    const userSnap = await db.collection('users').doc(userId).get();
    const userData = userSnap.data();

    if (!userData || !userData.fcmTokens?.length) {
        console.log(`[Push] User ${userId} has no FCM tokens.`);
        return;
    }

    const tokens: string[] = userData.fcmTokens;

    const payload: admin.messaging.MulticastMessage = {
        notification,
        tokens: tokens,
        webpush: {
            fcmOptions: {
                link: link,
            },
            notification: {
                tag: link, // Use link as tag to group notifications
            }
        },
        data: {
            click_action: link || '/',
        }
    };
    
    const response = await fcm.sendEachForMulticast(payload);

    // Cleanup invalid tokens
    const tokensToRemove: Promise<any>[] = [];
    response.responses.forEach((result, index) => {
        const error = result.error;
        if (error) {
            console.error(`[Push] Failure sending to ${tokens[index]}:`, error);
            if (['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'].includes(error.code)) {
                tokensToRemove.push(
                    db.collection('users').doc(userId).update({
                        fcmTokens: admin.firestore.FieldValue.arrayRemove(tokens[index])
                    })
                );
            }
        }
    });

    return Promise.all(tokensToRemove);
}


// Kept your original functions to prevent deletion
export const getConversations = functions
  .region('asia-east2')
  .https.onCall((data, context) => {
    console.log('getConversations was called, but is currently a placeholder.');
    return { conversations: [] };
  });

export const helloWorld = functions
  .region('asia-east2')
  .https.onCall((data, context) => {
    console.log('helloWorld function was called');
    return {
      message: 'Hello from asia-east2!',
    };
  });

// --- CORRECTED onNewMessage FUNCTION ---
export const onNewMessage = functions
  .region('asia-east2')
  .firestore.document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const messageData = snapshot.data();
    if (!messageData) {
      console.log('No data associated with the event');
      return;
    }
    const { conversationId } = context.params;
    const senderId = messageData.senderId;
    const convoRef = db.collection('conversations').doc(conversationId);
    const convoSnap = await convoRef.get();
    const convoData = convoSnap.data();

    if (!convoData) {
      console.log(`[${conversationId}] Conversation not found.`);
      return;
    }

    const recipientId = convoData.participantIds.find(
      (id: string) => id !== senderId
    );
    if (!recipientId) {
      console.log(`[${conversationId}] Recipient not found.`);
      return;
    }
    
    const senderName =
      convoData.participantDetails[senderId]?.displayName || '有人';
      
    const notification: admin.messaging.Notification = {
        title: `來自 ${senderName} 的新訊息`,
        body: messageData.text || '傳送了一則訊息給您',
        imageUrl: convoData.participantDetails[senderId]?.photoURL || undefined,
    };
    
    return sendPushNotification(recipientId, notification, `/chat/${conversationId}`);
  });

// Kept your other original functions
export const createNotificationOnUpdate = functions
  .region('asia-east2')
  .firestore.document('{collectionId}/{docId}')
  .onUpdate(async (change, context) => {
    const { collectionId, docId } = context.params;
    const before = change.before.data();
    const after = change.after.data();

    if (!before || !after) {
      console.log('No data change found in event.');
      return;
    }

    const batch = db.batch();
    const pushPromises: Promise<any>[] = [];


    if (collectionId === 'products') {
      const product = after;
      const productId = docId;

      const oldFavoritedBy: string[] = before.favoritedBy || [];
      const newFavoritedBy: string[] = after.favoritedBy || [];
      const newLikerId = newFavoritedBy.find(
        (id) => !oldFavoritedBy.includes(id)
      );

      if (newLikerId) {
        const likerSnap = await db.collection('users').doc(newLikerId).get();
        const likerName = likerSnap.data()?.displayName || 'Someone';
        const notificationId = `${product.sellerId}_favorite_${productId}_${newLikerId}`;
        const notificationRef = db
          .collection('notifications')
          .doc(notificationId);
        
        const notificationData: SystemNotification = {
          id: notificationId,
          userId: product.sellerId,
          type: 'new_favorite',
          message: `${likerName} 收藏了您的商品「${product.name}」。`,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          relatedData: {
            productId: productId,
            productName: product.name,
            productImage: product.image,
            actorId: newLikerId,
            actorName: likerName,
            click_action: `/products/${productId}`
          },
        };
        batch.set(notificationRef, notificationData);
        pushPromises.push(sendPushNotification(product.sellerId, {
            title: '有人收藏了您的商品！',
            body: notificationData.message,
            imageUrl: product.image
        }, `/products/${productId}`));
      }

      if (before.price > after.price) {
        const favoritedByIds: string[] = after.favoritedBy || [];
        for (const userId of favoritedByIds) {
          if (userId === product.sellerId) continue;
          const notificationId = `${userId}_pricedrop_${productId}`;
          const notificationRef = db
            .collection('notifications')
            .doc(notificationId);
          
          const notificationData: SystemNotification = {
            id: notificationId,
            userId: userId,
            type: 'price_drop',
            message: `您收藏的商品「${product.name}」已降價至 $${after.price}！`,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            relatedData: {
              productId: productId,
              productName: product.name,
              productImage: product.image,
              price: after.price,
              click_action: `/products/${productId}`
            },
          };
          batch.set(notificationRef, notificationData);
          pushPromises.push(sendPushNotification(userId, {
            title: '您收藏的商品降價了！',
            body: notificationData.message,
            imageUrl: product.image,
          }, `/products/${productId}`));
        }
      }

      if (before.status !== 'sold' && after.status === 'sold') {
        const notificationId = `${product.sellerId}_sold_${productId}`;
        const notificationRef = db
          .collection('notifications')
          .doc(notificationId);
        
        const notificationData: SystemNotification = {
          id: notificationId,
          userId: product.sellerId,
          type: 'item_sold',
          message: `恭喜！您的商品「${product.name}」已成功售出。`,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          relatedData: {
            productId: productId,
            productName: product.name,
            productImage: product.image,
            click_action: `/products/${productId}`
          },
        };
        batch.set(notificationRef, notificationData);
        pushPromises.push(sendPushNotification(product.sellerId, {
            title: '您的商品已售出！',
            body: notificationData.message,
            imageUrl: product.image,
        }, `/products/${productId}`));
      }
    }
    
    await batch.commit();
    return Promise.all(pushPromises);
  });

export const onNewReview = functions
  .region('asia-east2')
  .firestore.document('reviews/{reviewId}')
  .onCreate(async (snapshot, context) => {
    const review = snapshot.data();
    if (!review) {
      console.log('No review data associated with the event');
      return;
    }
    const batch = db.batch();
    const ratedUserId = review.ratedUserId;
    const ratedUserRef = db.collection('users').doc(ratedUserId);

    try {
        const userDoc = await ratedUserRef.get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const currentReviewCount = userData?.reviewCount || 0;
            const currentAverageRating = userData?.averageRating || 0;

            const newReviewCount = currentReviewCount + 1;
            const newAverageRating =
                (currentAverageRating * currentReviewCount + review.rating) /
                newReviewCount;

            batch.update(ratedUserRef, {
                reviewCount: newReviewCount,
                averageRating: newAverageRating,
            });
        }
    } catch (error) {
        console.error(`Failed to update user rating for ${ratedUserId}:`, error);
        // Continue to create the notification even if rating update fails
    }
    
    // Determine reviewer role
    let reviewerRole = 'buyer'; // Default to buyer
    try {
        const productRef = db.collection('products').doc(review.productId);
        const productSnap = await productRef.get();
        if (productSnap.exists) {
            const product = productSnap.data();
            if (product && product.sellerId === review.reviewerId) {
                reviewerRole = 'seller';
            }
        }
    } catch(e) {
        console.error("Could not determine reviewer role:", e);
    }
    
    // Update the review itself with the role
    batch.update(snapshot.ref, { reviewerRole: reviewerRole });

    const notificationId = `${ratedUserId}_newreview_${snapshot.id}`;
    const notificationRef = db.collection('notifications').doc(notificationId);
    const notificationData: SystemNotification = {
        id: notificationId,
        userId: ratedUserId,
        type: 'new_review',
        message: `${review.reviewerName} 給了您一個 ${review.rating} 星評價。`,
        isRead: false,
        createdAt: review.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        relatedData: {
            productId: review.productId,
            productName: review.productName,
            productImage: review.productImage,
            actorId: review.reviewerId,
            actorName: review.reviewerName,
            click_action: `/profile/${ratedUserId}?tab=reviews`,
        },
    };
    batch.set(notificationRef, notificationData);

    const pushPromise = sendPushNotification(ratedUserId, {
        title: '您收到了新的評價！',
        body: notificationData.message,
    }, `/profile/${ratedUserId}?tab=reviews`);

    await batch.commit();
    return pushPromise;
  });

export const onConversationUpdate = functions
  .region('asia-east2')
  .firestore.document('conversations/{conversationId}')
  .onUpdate(async (change, context) => {
    const { conversationId } = context.params;
    const newValue = change.after.data();

    if (!newValue) {
      console.log('No new data for conversation update.');
      return;
    }

    const hiddenFor: string[] = newValue.hiddenFor || [];
    const participantIds: string[] = newValue.participantIds || [];
    const isHiddenForAll =
      participantIds.length > 0 &&
      participantIds.every((id: string) => hiddenFor.includes(id));
      
    if (isHiddenForAll) {
      console.log(
        `[${conversationId}] Deleting conversation and its messages.`
      );
      const conversationRef = db.collection('conversations').doc(conversationId);
      const messagesRef = conversationRef.collection('messages');
      
      // Delete all sub-collection messages
      const messagesSnap = await messagesRef.get();
      const deleteBatch = db.batch();
      messagesSnap.docs.forEach((doc) => deleteBatch.delete(doc.ref));
      await deleteBatch.commit();
      
      // Delete the conversation document itself
      return conversationRef.delete();
    }
    return null;
  });


/**
 * Triggered when a user is deleted from Firebase Authentication.
 * Cleans up all associated user data from Firestore.
 */
export const onUserDelete = functions
  .region('asia-east2')
  .auth.user()
  .onDelete(async (user) => {
    const userId = user.uid;
    console.log(`[${userId}] User account deletion triggered. Cleaning up data...`);
    const batch = db.batch();

    // 1. Delete the user's profile document
    const userDocRef = db.collection('users').doc(userId);
    batch.delete(userDocRef);

    // 2. Delete all products listed by the user
    const productsQuery = db.collection('products').where('sellerId', '==', userId);
    const productsSnap = await productsQuery.get();
    productsSnap.forEach((doc) => {
      console.log(`[${userId}] Deleting product: ${doc.id}`);
      batch.delete(doc.ref);
    });

    // 3. Remove user from `favoritedBy` arrays of all products
    const favoritedQuery = db.collection('products').where('favoritedBy', 'array-contains', userId);
    const favoritedSnap = await favoritedQuery.get();
    favoritedSnap.forEach((doc) => {
        console.log(`[${userId}] Removing favorite from product: ${doc.id}`);
        batch.update(doc.ref, {
            favoritedBy: admin.firestore.FieldValue.arrayRemove(userId),
            favorites: admin.firestore.FieldValue.increment(-1),
        });
    });

    // 4. Delete all reviews written by the user
    const reviewsQuery = db.collection('reviews').where('reviewerId', '==', userId);
    const reviewsSnap = await reviewsQuery.get();
    reviewsSnap.forEach((doc) => {
      console.log(`[${userId}] Deleting review: ${doc.id}`);
      batch.delete(doc.ref);
    });
    
    // 5. Delete all notifications for the user
    const notificationsQuery = db.collection('notifications').where('userId', '==', userId);
    const notificationsSnap = await notificationsQuery.get();
    notificationsSnap.forEach((doc) => {
      console.log(`[${userId}] Deleting notification: ${doc.id}`);
      batch.delete(doc.ref);
    });

    try {
      await batch.commit();
      console.log(`[${userId}] Successfully cleaned up all data.`);
    } catch (error) {
      console.error(`[${userId}] Error during data cleanup:`, error);
    }
  });

    

    
