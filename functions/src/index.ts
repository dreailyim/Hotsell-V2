
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
const fcm = admin.messaging();

// By removing .region("asia-east2"), this function will deploy to the default region (e.g., us-central1),
// which must be the same region as the Firestore database for the trigger to work.
export const onNewMessage = functions
    .firestore.document("conversations/{conversationId}/messages/{messageId}")
    .onCreate(async (snapshot, context) => {
        const messageData = snapshot.data();
        const {conversationId, messageId} = context.params;

        if (!messageData) {
            console.log("No message data found.");
            return;
        }

        const senderId = messageData.senderId;

        const convoRef = db.collection("conversations").doc(conversationId);
        const convoSnap = await convoRef.get();
        const convoData = convoSnap.data();

        if (!convoData) {
            console.log(`[${conversationId}] Conversation not found.`);
            return;
        }

        const recipientId = convoData.participantIds.find(
            (id: string) => id !== senderId,
        );

        if (!recipientId) {
            console.log(`[${conversationId}] Recipient not found.`);
            return;
        }

        // --- Create System Notification ---
        const notificationRef = db.collection("notifications").doc(`${recipientId}_${messageId}`);
        const senderNameForNotif = convoData.participantDetails[senderId]?.displayName || "Someone";
        await notificationRef.set({
            userId: recipientId,
            type: "new_message",
            message: `您在「${convoData.product?.name || "一個商品"}」的對話中收到了來自 ${senderNameForNotif} 的新訊息。`,
            isRead: false,
            createdAt: messageData.timestamp || admin.firestore.FieldValue.serverTimestamp(),
            relatedData: {
                conversationId: conversationId,
                productId: convoData.product?.id,
                productName: convoData.product?.name,
                productImage: convoData.product?.image,
                actorId: senderId,
                actorName: senderNameForNotif,
            },
        });

        // --- Send Push Notification ---
        const recipientSnap = await db.collection("users").doc(recipientId).get();
        const recipientData = recipientSnap.data();

        if (!recipientData || !recipientData.fcmTokens?.length) {
            console.log(`[${recipientId}] Recipient has no FCM tokens.`);
            return;
        }

        const tokens: string[] = recipientData.fcmTokens;
        const senderNameForPush = convoData.participantDetails[senderId]?.displayName || "Someone";

        const payload: admin.messaging.MessagingPayload = {
            notification: {
                title: `來自 ${senderNameForPush} 的新訊息`,
                body: messageData.text,
                imageUrl: convoData.participantDetails[senderId]?.photoURL || undefined,
            },
            data: {
                conversationId: conversationId,
                click_action: `/chat/${conversationId}`,
            },
        };

        const response = await fcm.sendToDevice(tokens, payload);

        const tokensToRemove: Promise<any>[] = [];
        response.results.forEach((result, index) => {
            const error = result.error;
            if (error) {
                console.error("Failure sending notification to", tokens[index], error);
                if (
                    error.code === "messaging/invalid-registration-token" ||
                    error.code === "messaging/registration-token-not-registered"
                ) {
                    tokensToRemove.push(
                        db.collection("users").doc(recipientId).update({
                            fcmTokens: admin.firestore.FieldValue.arrayRemove(tokens[index]),
                        }),
                    );
                }
            }
        });

        return Promise.all(tokensToRemove);
    });

export const createNotificationOnUpdate = functions.firestore
    .document("{collectionId}/{docId}")
    .onUpdate(async (change, context) => {
        const {collectionId, docId} = context.params;
        const before = change.before.data();
        const after = change.after.data();
        const batch = db.batch();

        // --- Logic for Product Updates ---
        if (collectionId === "products") {
            const product = after;
            const productId = docId;

            // 1. Favorited by someone
            const oldFavoritedBy: string[] = before.favoritedBy || [];
            const newFavoritedBy: string[] = after.favoritedBy || [];
            const newLikerId = newFavoritedBy.find((id) => !oldFavoritedBy.includes(id));

            if (newLikerId) {
                const likerSnap = await db.collection("users").doc(newLikerId).get();
                const likerName = likerSnap.data()?.displayName || "Someone";
                const notificationId = `${product.sellerId}_favorite_${productId}_${newLikerId}`;
                const notificationRef = db.collection("notifications").doc(notificationId);

                batch.set(notificationRef, {
                    userId: product.sellerId,
                    type: "new_favorite",
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

            // 2. Price drop
            if (before.price > after.price) {
                const favoritedByIds: string[] = after.favoritedBy || [];
                for (const userId of favoritedByIds) {
                    if (userId === product.sellerId) continue; // Don't notify seller
                    const notificationId = `${userId}_pricedrop_${productId}`;
                    const notificationRef = db.collection("notifications").doc(notificationId);
                    batch.set(notificationRef, {
                        userId: userId,
                        type: "price_drop",
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

            // 3. Item sold
            if (before.status !== "sold" && after.status === "sold") {
                const notificationId = `${product.sellerId}_sold_${productId}`;
                const notificationRef = db.collection("notifications").doc(notificationId);
                batch.set(notificationRef, {
                    userId: product.sellerId,
                    type: "item_sold",
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

        // --- Logic for New Reviews ---
        if (collectionId === "reviews") {
            // This assumes reviews are only created, not updated.
            // For simplicity, we'll use the onUpdate hook here.
            // A more robust solution would use onCreate for reviews.
            const review = after;
            const notificationId = `${review.ratedUserId}_newreview_${docId}`;
            const notificationRef = db.collection("notifications").doc(notificationId);

            batch.set(notificationRef, {
                userId: review.ratedUserId,
                type: "new_review",
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
        }

        return batch.commit();
    });

export const onConversationUpdate = functions
    .firestore.document("conversations/{conversationId}")
    .onUpdate(async (change, context) => {
        const conversationId = context.params.conversationId;
        const newValue = change.after.data();

        // Deletion Logic
        const hiddenFor = newValue.hiddenFor || [];
        const participantIds = newValue.participantIds || [];
        const isHiddenForAll =
            participantIds.length > 0 &&
            participantIds.every((id: string) => hiddenFor.includes(id));

        if (isHiddenForAll) {
            console.log(`[${conversationId}] Deleting conversation and its messages.`);
            const conversationRef = db.collection("conversations").doc(conversationId);
            // This is a simplified recursive delete. For production, an extension is recommended.
            const messagesRef = conversationRef.collection("messages");
            const messagesSnap = await messagesRef.get();
            const deleteBatch = db.batch();
            messagesSnap.docs.forEach((doc) => deleteBatch.delete(doc.ref));
            await deleteBatch.commit();
            return conversationRef.delete();
        }

        return null;
    });
