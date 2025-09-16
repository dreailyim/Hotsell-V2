
const {onRequest} = require("firebase-functions/v2/https");
const {onCall} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const next = require("next");

// Set the function region to match your project's configuration.
const {setGlobalOptions} = require("firebase-functions/v2");
setGlobalOptions({ region: "us-central1" });


const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev, conf: { distDir: ".next" } });
const handle = nextApp.getRequestHandler();

// Initialize Firebase Admin SDK only if it hasn't been initialized yet.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

// Main web API that serves the Next.js app
exports.webApi = onRequest((req, res) => {
  return nextApp.prepare().then(() => handle(req, res));
});

// Callable function to get user conversations
exports.getConversations = onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const uid = request.auth.uid;

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
                 otherUserDetails = convo.participantDetails[otherUserId];
            } else if (otherUserId) {
                // Fallback to fetch from 'users' collection if not in convo details
                 try {
                    const userDoc = await db.collection('users').doc(otherUserId).get();
                    if (userDoc.exists) {
                        const { displayName, photoURL } = userDoc.data();
                        otherUserDetails = { displayName, photoURL };
                    }
                } catch (e) {
                    console.error(`Failed to fetch user details for ${otherUserId}`, e);
                }
            }
            return { ...convo, otherUserDetails };
        });

        const enrichedConvos = await Promise.all(enrichedConvosPromises);
        return enrichedConvos;

    } catch (error) {
        console.error('Error fetching conversations:', error);
        throw new functions.https.HttpsError('internal', 'Could not fetch conversations.');
    }
});
