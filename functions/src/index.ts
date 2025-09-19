
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
      const senderName =
        convoData.participantDetails[senderId]?.displayName || "Someone";
      const productName = convoData.product?.name || "an item";

      const payload: admin.messaging.MessagingPayload = {
        notification: {
          title: `來自 ${senderName} 的新訊息`,
          body: messageData.text,
          click_action: `https://hotsell.dpdns.org/chat/${conversationId}`,
          icon: convoData.participantDetails[senderId]?.photoURL || "/logo.png",
        },
        webpush: {
          fcmOptions: {
            link: `https://hotsell.dpdns.org/chat/${conversationId}`,
          },
          notification: {
            tag: conversationId, // Group notifications by conversation
          },
        },
        data: {
          conversationId: conversationId,
          productName: productName,
        },
      };

      // Send notifications to all tokens.
      const response = await fcm.sendToDevice(tokens, payload);

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
                  fcmTokens: admin.firestore.FieldValue.arrayRemove(tokens[index]),
                }),
            );
          }
        }
      });

      return Promise.all(tokensToRemove);
    });
