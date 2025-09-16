
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * Recursively converts Firestore Timestamps to ISO strings.
 * @param {any} data The data to convert.
 * @returns {any} The converted data.
 */
function convertTimestamps(data) {
  if (data === null || data === undefined) {
    return data;
  }
  if (typeof data.toDate === 'function') { // Cheaper check for Timestamp
    return data.toDate().toISOString();
  }
  if (Array.isArray(data)) {
    return data.map(convertTimestamps);
  }
  if (typeof data === 'object') {
    const res = {};
    for (const key in data) {
      res[key] = convertTimestamps(data[key]);
    }
    return res;
  }
  return data;
}

exports.getConversations = functions.https.onCall(async (data, context) => {
    // DEBUG STEP 1: Return hardcoded data to isolate the problem.
    // If this works, the problem is with the Firestore query or data processing.
    // If this fails, the problem is with the function setup/deployment itself.
    return [
        {
            id: "debug-convo-1",
            participantIds: ["user1", "user2"],
            participantDetails: {
                user1: { displayName: "偵錯用戶一號", photoURL: "https://i.pravatar.cc/150?u=debug1" },
                user2: { displayName: "偵錯用戶二號", photoURL: "https://i.pravatar.cc/150?u=debug2" }
            },
            product: {
                id: "debug-prod-1",
                name: "偵錯專用產品",
                image: "https://picsum.photos/seed/debug/200/200",
                price: 999,
                sellerId: "user2",
            },
            lastMessage: {
                text: "這是一則偵錯訊息。",
                senderId: "user2",
                timestamp: new Date().toISOString(),
            },
            lastActivity: new Date().toISOString(),
            unreadCounts: { user1: 1 },
            otherUserDetails: {
                uid: "user2",
                displayName: "偵錯用戶二號",
                photoURL: "https://i.pravatar.cc/150?u=debug2"
            }
        }
    ];

    /*
    // Original Code - Temporarily Disabled
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const uid = context.auth.uid;

    try {
        const conversationsRef = db.collection('conversations');
        const snapshot = await conversationsRef.where('participantIds', 'array-contains', uid).orderBy('lastActivity', 'desc').get();

        if (snapshot.empty) {
            return [];
        }

        const convosData = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(convo => !convo.hiddenFor || !convo.hiddenFor.includes(uid));

        const enrichedConvosPromises = convosData.map(async (convo) => {
            const otherUserId = convo.participantIds.find(pId => pId !== uid);
            let otherUserDetails = null;

            if (otherUserId && convo.participantDetails && convo.participantDetails[otherUserId]) {
                 otherUserDetails = { uid: otherUserId, ...convo.participantDetails[otherUserId] };
            } else if (otherUserId) {
                try {
                    const userDoc = await db.collection('users').doc(otherUserId).get();
                    if (userDoc.exists) {
                        const { displayName, photoURL } = userDoc.data();
                        otherUserDetails = { uid: otherUserId, displayName, photoURL };
                    }
                } catch (e) {
                    console.error(`Failed to fetch user details for ${otherUserId}`, e);
                }
            }
            return { ...convo, otherUserDetails };
        });

        const enrichedConvos = await Promise.all(enrichedConvosPromises);
        
        // Convert all timestamps before returning
        return convertTimestamps(enrichedConvos);

    } catch (error) {
        console.error('Error fetching conversations:', error);
        throw new functions.https.HttpsError('internal', 'Could not fetch conversations.');
    }
    */
});
