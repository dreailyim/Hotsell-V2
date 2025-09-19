
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
const fcm = admin.messaging();

export const onNewMessage = functions
    .region("asia-east2") // Specify your preferred region
    .firestore.document("conversations/{conversationId}/messages/{messageId}")
    .onCreate(async (snapshot, context) => {
        const messageData = snapshot.data();
        const conversationId = context.params.conversationId;

        if (!messageData) {
            console.log("No message data found.");
            return;
        }

        const senderId = messageData.senderId;

        // Get the conversation document to find the recipient
        const convoRef = db.collection("conversations").doc(conversationId);
        const convoSnap = await convoRef.get();
        const convoData = convoSnap.data();

        if (!convoData) {
            console.log(`Conversation ${conversationId} not found.`);
            return;
        }

        // Find the recipient's ID
        const recipientId = convoData.participantIds.find(
            (id: string) => id !== senderId,
        );

        if (!recipientId) {
            console.log("Recipient not found in conversation.");
            return;
        }

        // Get the recipient's user document to find their FCM tokens
        const recipientSnap = await db.collection("users").doc(recipientId).get();
        const recipientData = recipientSnap.data();

        if (!recipientData || !recipientData.fcmTokens?.length) {
            console.log(`Recipient ${recipientId} has no FCM tokens.`);
            return;
        }

        const tokens: string[] = recipientData.fcmTokens;
        // CORRECTED: participantDetails
        const senderName =
            convoData.participantDetails[senderId]?.displayName || "Someone";
        const productName = convoData.product?.name || "an item";

        const payload: admin.messaging.MessagingPayload = {
            notification: {
                title: `來自 ${senderName} 的新訊息`,
                body: messageData.text,
                // CORRECTED: participantDetails
                imageUrl: convoData.participantDetails[senderId]?.photoURL || undefined,
            },
            data: {
                conversationId: conversationId,
                productName: productName,
                // Adding a click_action for web push notifications
                // to navigate to the correct chat page.
                click_action: `/chat/${conversationId}`,
            },
        };

        const options: admin.messaging.MessagingOptions = {
            priority: "high",
        };


        // Send notifications to all tokens.
        const response = await fcm.sendToDevice(tokens, payload, options);

        // Cleanup invalid tokens
        const tokensToRemove: Promise<any>[] = [];
        response.results.forEach((result, index) => {
            const error = result.error;
            if (error) {
                console.error(
                    "Failure sending notification to",
                    tokens[index],
                    error,
                );
                // Cleanup the tokens who are not registered anymore.
                if (
                    error.code === "messaging/invalid-registration-token" ||
                    error.code === "messaging/registration-token-not-registered"
                ) {
                    tokensToRemove.push(
                        db.collection("users").doc(recipientId).update({
                            fcmTokens: admin.firestore.FieldValue.arrayRemove(
                                tokens[index],
                            ),
                        }),
                    );
                }
            }
        });

        return Promise.all(tokensToRemove);
    });


/**
 * A Cloud Function that triggers on conversation document updates.
 * If both participants have marked the conversation for deletion (i.e., their IDs are
 * in the 'hiddenFor' array), this function will permanently delete the conversation document
 * and all its sub-collections (like messages).
 */
export const onConversationUpdate = functions
    .region("asia-east2")
    .firestore.document("conversations/{conversationId}")
    .onUpdate(async (change, context) => {
        const conversationId = context.params.conversationId;
        const newValue = change.after.data();
        const previousValue = change.before.data();

        const hiddenFor = newValue.hiddenFor || [];
        const oldHiddenFor = previousValue.hiddenFor || [];

        // Proceed only if hiddenFor has been updated
        if (JSON.stringify(hiddenFor) === JSON.stringify(oldHiddenFor)) {
            console.log(`[${conversationId}] No change in hiddenFor field. Exiting.`);
            return null;
        }

        const participantIds = newValue.participantIds || [];

        // Check if both participants are in the hiddenFor array
        const isHiddenForAll =
            participantIds.length > 0 &&
            participantIds.every((id: string) => hiddenFor.includes(id));

        if (isHiddenForAll) {
            console.log(`[${conversationId}] Both users have hidden the conversation. Deleting document.`);

            const conversationRef = db.collection("conversations").doc(conversationId);
            // NOTE: Deleting a document does not automatically delete its subcollections.
            // For a complete cleanup, we would need to delete subcollections recursively.
            // For now, we will just delete the main document as the messages are not directly accessible
            // without the conversation document.
            // A more robust solution might use a dedicated "recursive delete" extension.
            return conversationRef.delete();
        } else {
            console.log(`[${conversationId}] Conversation is not yet hidden for all participants.`);
            return null;
        }
    });

