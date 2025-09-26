'use strict';

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import type { Product, Review } from '../../src/lib/types'; // Import types

admin.initializeApp();

const db = admin.firestore();
const fcm = admin.messaging();

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

    const recipientSnap = await db.collection('users').doc(recipientId).get();
    const recipientData = recipientSnap.data();
    if (!recipientData || !recipientData.fcmTokens?.length) {
      console.log(`[${recipientId}] Recipient has no FCM tokens.`);
      return;
    }
    const tokens: string[] = recipientData.fcmTokens;
    const senderName =
      convoData.participantDetails[senderId]?.displayName || '有人';
      
    // The type is correctly set to MulticastMessage
    const payload: admin.messaging.MulticastMessage = {
      notification: {
        title: `來自 ${senderName} 的新訊息`,
        body: messageData.text || '傳送了一則訊息給您',
        imageUrl: convoData.participantDetails[senderId]?.photoURL || undefined,
      },
      data: {
        click_action: `/chat/${conversationId}`,
      },
      webpush: {
        notification: {
            tag: conversationId, 
        },
        fcmOptions: {
          link: `/chat/${conversationId}`,
        },
      },
      tokens: tokens,
    };
    
    const response = await fcm.sendEachForMulticast(payload);
    
    const tokensToRemove: Promise<any>[] = [];
    response.responses.forEach((result, index) => {
      const error = result.error;
      if (error) {
        console.error('Failure sending notification to', tokens[index], error);
        if (
          error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered'
        ) {
          tokensToRemove.push(
            db.collection('users').doc(recipientId).update({
              fcmTokens: admin.firestore.FieldValue.arrayRemove(tokens[index]),
            })
          );
        }
      }
    });
    return Promise.all(tokensToRemove);
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
        batch.set(notificationRef, {
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
          },
        });
      }

      if (before.price > after.price) {
        const favoritedByIds: string[] = after.favoritedBy || [];
        for (const userId of favoritedByIds) {
          if (userId === product.sellerId) continue;
          const notificationId = `${userId}_pricedrop_${productId}`;
          const notificationRef = db
            .collection('notifications')
            .doc(notificationId);
          batch.set(notificationRef, {
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
            },
          });
        }
      }

      if (before.status !== 'sold' && after.status === 'sold') {
        const notificationId = `${product.sellerId}_sold_${productId}`;
        const notificationRef = db
          .collection('notifications')
          .doc(notificationId);
        batch.set(notificationRef, {
          userId: product.sellerId,
          type: 'item_sold',
          message: `恭喜！您的商品「${product.name}」已成功售出。`,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          relatedData: {
            productId: productId,
            productName: product.name,
            productImage: product.image,
          },
        });
      }
    }

    return batch.commit();
  });

export const onNewReview = functions
  .region('asia-east2')
  .firestore.document('reviews/{reviewId}')
  .onCreate(async (snapshot, context) => {
    const review = snapshot.data() as Review;
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
    let reviewerRole: 'buyer' | 'seller' = 'buyer'; // Default to buyer
    try {
        const productRef = db.collection('products').doc(review.productId);
        const productSnap = await productRef.get();
        if (productSnap.exists) {
            const product = productSnap.data() as Product;
            if (product.sellerId === review.reviewerId) {
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
    batch.set(notificationRef, {
        userId: ratedUserId,
        type: 'new_review',
        message: `${review.reviewerName} 給了您一個 ${review.rating} 星評價。`,
        isRead: false,
        createdAt:
        review.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        relatedData: {
        productId: review.productId,
        productName: review.productName,
        productImage: review.productImage,
        actorId: review.reviewerId,
        actorName: review.reviewerName,
        },
    });

    return batch.commit();
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
      const messagesSnap = await messagesRef.get();
      const deleteBatch = db.batch();
      messagesSnap.docs.forEach((doc) => deleteBatch.delete(doc.ref));
      await deleteBatch.commit();
      return conversationRef.delete();
    }
    return null;
  });