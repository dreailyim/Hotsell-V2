'use server';

import { db } from '@/lib/firebase/client-app';
import { auth } from '@/lib/firebase/client-app';
import { doc, getDoc, writeBatch, deleteDoc, collection } from 'firebase/firestore';
import type { Conversation } from '@/lib/types';
import { revalidatePath } from 'next/cache';

type DeleteResult = {
    success: boolean;
    message: string;
    deletedCount: number;
};

/**
 * Deletes or hides conversations based on their state.
 * If both participants have hidden the conversation, it's permanently deleted.
 * Otherwise, it's hidden for the current user.
 * @param conversationIds - An array of conversation IDs to delete.
 * @returns A result object with success status and a message.
 */
export async function deleteConversationsAction(conversationIds: string[]): Promise<DeleteResult> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        return { success: false, message: '用戶未登入或認證失敗。', deletedCount: 0 };
    }
    const userId = currentUser.uid;

    const batch = writeBatch(db);
    let processedCount = 0;

    try {
        for (const convoId of conversationIds) {
            const convoRef = doc(db, 'conversations', convoId);
            const convoSnap = await getDoc(convoRef);

            if (!convoSnap.exists()) {
                console.warn(`Conversation with ID ${convoId} not found. Skipping.`);
                continue;
            }

            const conversation = convoSnap.data() as Conversation;

            // Ensure the current user is a participant
            if (!conversation.participantIds.includes(userId)) {
                console.warn(`User ${userId} is not a participant of conversation ${convoId}. Skipping.`);
                continue;
            }

            const otherParticipantId = conversation.participantIds.find(id => id !== userId);
            const isOtherParticipantHidden = conversation.hiddenFor && otherParticipantId ? conversation.hiddenFor.includes(otherParticipantId) : false;

            if (isOtherParticipantHidden) {
                // The other user has already "deleted" it, so we perform a hard delete.
                // Note: This will also delete subcollections like 'messages' if we implement that later.
                // For now, let's just delete the conversation doc. A more robust solution would involve
                // a Cloud Function to recursively delete subcollections.
                batch.delete(convoRef);
            } else {
                // This is the first user to delete, so we perform a soft delete.
                const currentHiddenFor = conversation.hiddenFor || [];
                if (!currentHiddenFor.includes(userId)) {
                     batch.update(convoRef, {
                        hiddenFor: [...currentHiddenFor, userId]
                    });
                }
            }
            processedCount++;
        }

        await batch.commit();
        
        // Revalidate the messages page to show the changes
        revalidatePath('/messages');

        return { success: true, message: `已成功處理 ${processedCount} 個對話。`, deletedCount: processedCount };

    } catch (error: any) {
        console.error("Error in deleteConversationsAction:", error);
        return { success: false, message: error.message || '刪除對話時發生未知錯誤。', deletedCount: 0 };
    }
}
