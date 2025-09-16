const {https, onCall} = require('firebase-functions');
const next = require('next');
const admin = require('firebase-admin');

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev, conf: { distDir: '.next' } });
const handle = nextApp.getRequestHandler();

// Initialize Firebase Admin SDK only if it hasn't been initialized yet.
// This is a best practice to prevent re-initialization errors in a serverless environment.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

// Main web API that serves the Next.js app
exports.webApi = https.onRequest((req, res) => {
  return nextApp.prepare().then(() => handle(req, res));
});

// Callable function to get user conversations
exports.getConversations = onCall(async (data, context) => {
    if (!context.auth) {
        throw new https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
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

            if (otherUserId) {
                try {
                    const userDoc = await db.collection('users').doc(otherUserId).get();
                    if (userDoc.exists) {
                        otherUserDetails = userDoc.data();
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
        throw new https.HttpsError('internal', 'Could not fetch conversations.');
    }
});
