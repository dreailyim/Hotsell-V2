'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onConversationUpdate = exports.onNewReview = exports.createNotificationOnUpdate = exports.onNewMessage = exports.helloWorld = exports.getConversations = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
const fcm = admin.messaging();
// Placeholder for getConversations to prevent deletion.
// Kept as V1 function to avoid upgrade conflicts.
exports.getConversations = functions
    .region('us-central1')
    .https.onCall((data, context) => {
    console.log('getConversations was called, but is currently a placeholder.');
    // This function needs its original implementation.
    // For now, it returns an empty array to avoid breaking client-side code.
    return { conversations: [] };
});
// A simple callable function for testing backend connectivity.
exports.helloWorld = functions
    .region('asia-east2')
    .https.onCall((data, context) => {
    console.log('helloWorld function was called');
    return {
        message: 'Hello from asia-east2!',
    };
});
exports.onNewMessage = functions
    .region('asia-east2')
    .firestore.document('conversations/{conversationId}/messages/{messageId}')
    .onCreate(async (snapshot, context) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
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
    const recipientId = convoData.participantIds.find((id) => id !== senderId);
    if (!recipientId) {
        console.log(`[${conversationId}] Recipient not found.`);
        return;
    }
    // --- Create System Notification ---
    const notificationRef = db.collection('notifications').doc(); // Auto-generate ID
    const senderNameForNotif = ((_a = convoData.participantDetails[senderId]) === null || _a === void 0 ? void 0 : _a.displayName) || 'Someone';
    await notificationRef.set({
        userId: recipientId,
        type: 'new_message',
        message: `您在「${((_b = convoData.product) === null || _b === void 0 ? void 0 : _b.name) || '一個商品'}」的對話中收到了來自 ${senderNameForNotif} 的新訊息。`,
        isRead: false,
        createdAt: messageData.timestamp || admin.firestore.FieldValue.serverTimestamp(),
        relatedData: {
            conversationId: conversationId,
            productId: (_c = convoData.product) === null || _c === void 0 ? void 0 : _c.id,
            productName: (_d = convoData.product) === null || _d === void 0 ? void 0 : _d.name,
            productImage: (_e = convoData.product) === null || _e === void 0 ? void 0 : _e.image,
            actorId: senderId,
            actorName: senderNameForNotif,
        },
    });
    // --- Send Push Notification ---
    const recipientSnap = await db.collection('users').doc(recipientId).get();
    const recipientData = recipientSnap.data();
    if (!recipientData || !((_f = recipientData.fcmTokens) === null || _f === void 0 ? void 0 : _f.length)) {
        console.log(`[${recipientId}] Recipient has no FCM tokens.`);
        return;
    }
    const tokens = recipientData.fcmTokens;
    const senderNameForPush = ((_g = convoData.participantDetails[senderId]) === null || _g === void 0 ? void 0 : _g.displayName) || 'Someone';
    const payload = {
        notification: {
            title: `來自 ${senderNameForPush} 的新訊息`,
            body: messageData.text,
            imageUrl: ((_h = convoData.participantDetails[senderId]) === null || _h === void 0 ? void 0 : _h.photoURL) || undefined,
        },
        data: {
            conversationId: conversationId,
            click_action: `/chat/${conversationId}`,
        },
    };
    const response = await fcm.sendToDevice(tokens, payload);
    const tokensToRemove = [];
    response.results.forEach((result, index) => {
        const error = result.error;
        if (error) {
            console.error('Failure sending notification to', tokens[index], error);
            if (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered') {
                tokensToRemove.push(db.collection('users').doc(recipientId).update({
                    fcmTokens: admin.firestore.FieldValue.arrayRemove(tokens[index]),
                }));
            }
        }
    });
    return Promise.all(tokensToRemove);
});
exports.createNotificationOnUpdate = functions
    .region('asia-east2')
    .firestore.document('{collectionId}/{docId}')
    .onUpdate(async (change, context) => {
    var _a;
    const { collectionId, docId } = context.params;
    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after) {
        console.log('No data change found in event.');
        return;
    }
    const batch = db.batch();
    // --- Logic for Product Updates ---
    if (collectionId === 'products') {
        const product = after;
        const productId = docId;
        const oldFavoritedBy = before.favoritedBy || [];
        const newFavoritedBy = after.favoritedBy || [];
        const newLikerId = newFavoritedBy.find((id) => !oldFavoritedBy.includes(id));
        if (newLikerId) {
            const likerSnap = await db.collection('users').doc(newLikerId).get();
            const likerName = ((_a = likerSnap.data()) === null || _a === void 0 ? void 0 : _a.displayName) || 'Someone';
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
            const favoritedByIds = after.favoritedBy || [];
            for (const userId of favoritedByIds) {
                if (userId === product.sellerId)
                    continue;
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
exports.onNewReview = functions
    .region('asia-east2')
    .firestore.document('reviews/{reviewId}')
    .onCreate(async (snapshot, context) => {
    const review = snapshot.data();
    if (!review) {
        console.log('No review data associated with the event');
        return;
    }
    const batch = db.batch();
    const notificationId = `${review.ratedUserId}_newreview_${snapshot.id}`;
    const notificationRef = db.collection('notifications').doc(notificationId);
    batch.set(notificationRef, {
        userId: review.ratedUserId,
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
        },
    });
    return batch.commit();
});
exports.onConversationUpdate = functions
    .region('asia-east2')
    .firestore.document('conversations/{conversationId}')
    .onUpdate(async (change, context) => {
    const { conversationId } = context.params;
    const newValue = change.after.data();
    if (!newValue) {
        console.log('No new data for conversation update.');
        return;
    }
    const hiddenFor = newValue.hiddenFor || [];
    const participantIds = newValue.participantIds || [];
    const isHiddenForAll = participantIds.length > 0 &&
        participantIds.every((id) => hiddenFor.includes(id));
    if (isHiddenForAll) {
        console.log(`[${conversationId}] Deleting conversation and its messages.`);
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
//# sourceMappingURL=functions.js.map
