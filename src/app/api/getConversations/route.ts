
import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import type { Conversation, FullUser } from '@/lib/types';
import { getAuth } from 'firebase-admin/auth';

export async function GET(request: NextRequest) {
    // Initialize Firebase Admin SDK inside the function if not already initialized.
    // This ensures it only runs on the server when the function is invoked, not during build time.
    if (!admin.apps.length) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                }),
            });
        } catch (error: any) {
            console.error('Firebase admin initialization error', error.stack);
            return NextResponse.json({ error: 'Firebase initialization failed' }, { status: 500 });
        }
    }
    
    const db = admin.firestore();

    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
        }
        
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        if (!userId) {
             return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }
        
        const conversationsRef = db.collection('conversations');
        const querySnapshot = await conversationsRef
            .where('participantIds', 'array-contains', userId)
            .orderBy('lastActivity', 'desc')
            .get();

        if (querySnapshot.empty) {
            return NextResponse.json([], { status: 200 });
        }

        const userPromises: Promise<admin.firestore.DocumentSnapshot>[] = [];
        const participantIds = new Set<string>();

        querySnapshot.docs.forEach(doc => {
            const convo = doc.data() as Conversation;
            const otherUserId = convo.participantIds.find(pId => pId !== userId);
            if (otherUserId && !participantIds.has(otherUserId)) {
                participantIds.add(otherUserId);
            }
        });
        
        participantIds.forEach(id => {
             userPromises.push(db.collection('users').doc(id).get());
        });

        const userSnapshots = await Promise.all(userPromises);
        const usersCache = new Map<string, FullUser>();
        userSnapshots.forEach(snap => {
            if (snap.exists) {
                usersCache.set(snap.id, snap.data() as FullUser);
            }
        });

        const enrichedConversations = querySnapshot.docs
            .map(doc => {
                const convo = doc.data() as Conversation;

                if (convo.hiddenFor && convo.hiddenFor.includes(userId)) {
                    return null;
                }
                
                const otherUserId = convo.participantIds.find(pId => pId !== userId);
                if (!otherUserId) return null;

                const otherUserDetails = usersCache.get(otherUserId) || {
                    uid: otherUserId,
                    displayName: '用戶',
                    photoURL: '',
                };
                
                return {
                    ...convo,
                    id: doc.id,
                    otherUserDetails,
                };
            })
            .filter(Boolean);

        return NextResponse.json(enrichedConversations, { status: 200 });

    } catch (error: any) {
        console.error('Error in getConversations API route:', error);
        if (error.code === 'auth/id-token-expired') {
            return NextResponse.json({ error: 'Token expired, please re-authenticate.' }, { status: 401 });
        }
        if (error.code === 'auth/argument-error') {
             return NextResponse.json({ error: 'Unauthorized: Invalid token format' }, { status: 401 });
        }
        return NextResponse.json({ error: `Internal Server Error: ${error.message}` }, { status: 500 });
    }
}
