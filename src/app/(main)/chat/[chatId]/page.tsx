
'use client';

import React, { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/layout/header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SendHorizonal, Plus, AlertTriangle, Package, Edit, Star, Loader2, MessageSquareQuote, HandCoins } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase/client-app';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, doc, updateDoc, writeBatch, setDoc, where, getDocs, limit, increment } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Image from 'next/image';
import Link from 'next/link';
import type { Message, Conversation, Product, FullUser } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { zhHK } from 'date-fns/locale';
import { useTranslation } from '@/hooks/use-translation';


// Reusable BidDialog component for initial bids and re-bids
function BidDialog({
    initialPrice,
    onBid,
    disabled,
    isReBid = false,
}: {
    initialPrice: number;
    onBid: (newPrice: number) => void;
    disabled: boolean;
    isReBid?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [newBidPrice, setNewBidPrice] = useState<string>(String(initialPrice));
    const { toast } = useToast();
    const { t } = useTranslation();

    const handleSubmit = () => {
        const priceNum = parseFloat(newBidPrice);
        if (isNaN(priceNum) || priceNum <= 0) {
             toast({ title: t('product_page.bid_dialog.invalid_price'), variant: "destructive" });
            return;
        }
        onBid(priceNum);
        setOpen(false); // Close dialog on submit
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                 <Button className="h-8 rounded-full px-3 text-xs bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity">
                    <HandCoins className="mr-1 h-4 w-4" />
                    {isReBid ? t('chat.rebid') : t('product_page.bid')}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('product_page.bid_dialog.title')}</AlertDialogTitle>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="bid-price" className="text-right">{t('product_page.bid_dialog.price')}</Label>
                            <Input id="bid-price" type="number" value={newBidPrice} onChange={(e) => setNewBidPrice(e.target.value)} className="col-span-3"/>
                        </div>
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmit} disabled={disabled} className="bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity">
                       {disabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('product_page.bid_dialog.confirm')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}


function ReviewDialog({
  conversationData,
}: {
  conversationData: Conversation;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const [hasReviewed, setHasReviewed] = useState(false);

  const { product, id: conversationId, participantIds, reviewStatus } = conversationData;
  const productId = product.id;

  // Check on mount if user has already reviewed
  useEffect(() => {
    // This check is the primary source of truth if available
    if (reviewStatus?.[user?.uid || '']) {
        setHasReviewed(true);
        return;
    }

    // This is a fallback check for older conversations without the `reviewStatus` field.
    if (!user || !productId || hasReviewed) return; // Don't re-check if already found
    
    const checkExistingReview = async () => {
        const reviewsRef = collection(db, 'reviews');
        const q = query(
            reviewsRef,
            where('productId', '==', productId),
            where('reviewerId', '==', user.uid),
            limit(1)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            setHasReviewed(true);
        }
    };
    checkExistingReview();
  }, [productId, user, reviewStatus, hasReviewed]);


  const handleSubmitReview = async () => {
    if (!user || !conversationId) return;
    if (rating === 0) {
      toast({ title: t('chat.review_dialog.rating_required'), variant: 'destructive' });
      return;
    }
     if (comment.trim().length < 5) {
      toast({ title: t('chat.review_dialog.comment_too_short_title'), description: t('chat.review_dialog.comment_too_short_desc'), variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      
      const ratedUserId = participantIds.find(p => p !== user.uid);
      if (!ratedUserId) throw new Error(t('chat.review_dialog.rated_user_not_found'));

      // 1. Add the new review document
      const reviewRef = doc(collection(db, 'reviews'));
      batch.set(reviewRef, {
        ratedUserId: ratedUserId,
        reviewerId: user.uid,
        reviewerName: user.displayName,
        reviewerAvatar: user.photoURL,
        productId: productId,
        productName: product.name,
        productImage: product.image,
        transactionPrice: conversationData.bidPrice || product.price, // Use bidPrice if available
        rating: rating,
        comment: comment.trim(),
        createdAt: serverTimestamp()
      });
      
      // 2. Update the conversation document with review status
      const convoRef = doc(db, 'conversations', conversationId);
      batch.update(convoRef, {
        [`reviewStatus.${user.uid}`]: true
      });

      await batch.commit();

      toast({ title: t('chat.review_dialog.submit_success_title'), description: t('chat.review_dialog.submit_success_desc') });
      setOpen(false);
      setHasReviewed(true); // Update state immediately
      setRating(0);
      setComment('');

    } catch (e: any) {
      console.error("Error submitting review:", e);
      toast({ title: t('chat.review_dialog.submit_fail_title'), description: e.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
   if (hasReviewed) {
      return (
        <Button className="h-8 rounded-full px-3 text-xs bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed" disabled>
            <Star className="mr-1 h-4 w-4" />
            {t('chat.already_reviewed')}
        </Button>
      )
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
            <Button
              className="h-8 rounded-full px-3 mr-1.5 text-xs bg-gradient-to-r from-blue-500 to-cyan-400 text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Star className="mr-1 h-4 w-4" />
              {t('chat.leave_review')}
            </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>{t('chat.review_dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('chat.review_dialog.description')}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-4 py-4">
            <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    className={cn(
                    "h-8 w-8 cursor-pointer transition-colors",
                    star <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                    )}
                    onClick={() => setRating(star)}
                />
                ))}
            </div>
            <Textarea
                placeholder={t('chat.review_dialog.comment_placeholder')}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[100px]"
            />
            </div>
            <AlertDialogFooter className="sm:flex-col sm:space-x-0 sm:gap-2">
            <AlertDialogAction 
                onClick={handleSubmitReview} 
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity"
                >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('chat.review_dialog.submit_button')}
            </AlertDialogAction>
            <AlertDialogCancel className="w-full mt-0">{t('chat.review_dialog.cancel_button')}</AlertDialogCancel>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
  )
}


export default function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();

  const conversationId = params.chatId as string;
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<FullUser | null>(null);
  const [isBidActionPending, startBidActionTransition] = useTransition();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  const sendMessage = useCallback(async (text: string) => {
    const trimmedText = text.trim();
    if (trimmedText === '' || authLoading || !user || !conversationId || !conversation) return;
    
    const otherUserId = conversation.participantIds.find(id => id !== user.uid);
    if (!otherUserId) {
        console.error("Could not find other user in conversation");
        return;
    }

    const convoRef = doc(db, 'conversations', conversationId);
    const messagesColRef = collection(convoRef, 'messages');
    
    try {
      const batch = writeBatch(db);
      
      const newMessageRef = doc(messagesColRef);
      batch.set(newMessageRef, {
        text: trimmedText,
        senderId: user.uid,
        timestamp: serverTimestamp(),
      });
      
      batch.update(convoRef, {
          lastMessage: { text: trimmedText, senderId: user.uid, timestamp: serverTimestamp() },
          lastActivity: serverTimestamp(),
          [`unreadCounts.${otherUserId}`]: increment(1),
      });

      await batch.commit();

      if (text === message) {
          setMessage('');
      }
      setError(null);
    } catch (error: any) {
      console.error("Error sending message:", error);
      setError(t('chat.send_fail_message').replace('{error_message}', error.message));
    }
  }, [user, conversationId, conversation, message, authLoading, t]);
  
  
  useEffect(() => {
    if (authLoading || !user?.uid || !conversationId) return;

    const markAsRead = async () => {
        const convoRef = doc(db, 'conversations', conversationId);
        try {
            await updateDoc(convoRef, {
                [`unreadCounts.${user.uid}`]: 0
            });
        } catch (err) {
            console.error("Error marking chat as read:", err);
        }
    };
    
    markAsRead();
  }, [user?.uid, conversationId, authLoading]);


  useEffect(() => {
    if (authLoading || !user || !conversationId) {
      return;
    }

    setLoading(true);
    const convoUnsubscribe = onSnapshot(doc(db, 'conversations', conversationId), (docSnap) => {
        if (docSnap.exists()) {
            const convoData = docSnap.data() as Omit<Conversation, 'id'>;
            setConversation({ id: docSnap.id, ...convoData });
            
            const otherUserId = convoData.participantIds.find(id => id !== user.uid);
            if (otherUserId && convoData.participantDetails[otherUserId]) {
                 const details = convoData.participantDetails[otherUserId];
                 const otherParticipant: FullUser = {
                     uid: otherUserId,
                     displayName: details.displayName,
                     photoURL: details.photoURL,
                     email: null,
                     createdAt: '',
                 }
                 setOtherUser(otherParticipant);
            }
        } else {
            setError(t('chat.conversation_not_found'));
        }
        setLoading(false);
    }, (err) => {
        console.error("Error listening to conversation document: ", err);
        setError(t('chat.load_conversation_fail').replace('{error_message}', err.message));
        setLoading(false);
    });


    const messagesColRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(messagesColRef, orderBy('timestamp', 'asc'));

    const messagesUnsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedMessages = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: (data.timestamp as Timestamp)?.toDate()?.toISOString() || new Date().toISOString(),
        } as Message;
      });
      setMessages(fetchedMessages);
    }, (err) => {
      console.error("Error listening to chat messages: ", err);
      setError(t('chat.load_messages_fail').replace('{error_message}', err.message));
    });

    return () => {
        convoUnsubscribe();
        messagesUnsubscribe();
    };
  }, [user, conversationId, authLoading, t]);

  // Handle bid actions (accept, decline, cancel, re-bid)
  const handleBidAction = (action: 'accept' | 'decline' | 'cancel' | 'bid', payload?: any) => {
      if (authLoading || !user) return;
      
      startBidActionTransition(async () => {
          try {
              let convoId: string | undefined;
              let currentBidPrice: number | undefined;
              
              if (typeof payload === 'object' && payload.conversationId) {
                  convoId = payload.conversationId;
                  currentBidPrice = payload.bidPrice;
              } else if (conversation?.id) {
                  convoId = conversation.id;
                  currentBidPrice = conversation.bidPrice;
              }

              if (!convoId) {
                  toast({ title: t('chat.action_fail'), description: t('chat.conversation_id_not_found'), variant: "destructive" });
                  return;
              }
              
              const convoRef = doc(db, 'conversations', convoId);
              let autoMessage = '';
              let newStatus: Conversation['bidStatus'] = 'pending';
              
              switch (action) {
                  case 'accept': {
                      if (!currentBidPrice) return;
                      autoMessage = t('chat.bid_accept_message').replace('{price}', String(currentBidPrice));
                      newStatus = 'accepted';
                      
                      const productRef = doc(db, 'products', conversation!.product.id);
                      const batch = writeBatch(db);
                      batch.update(productRef, { status: 'sold' });
                      batch.update(convoRef, { 
                          bidStatus: newStatus,
                          'product.status': 'sold'
                      });
                      await batch.commit();
                      break;
                  }

                  case 'decline':
                      if (!currentBidPrice) return;
                      autoMessage = t('chat.bid_decline_message').replace('{price}', String(currentBidPrice));
                      newStatus = 'declined';
                      await updateDoc(convoRef, { bidStatus: newStatus });
                      break;

                  case 'cancel':
                      if (!currentBidPrice) return;
                      autoMessage = t('chat.bid_cancel_message').replace('{price}', String(currentBidPrice));
                      newStatus = 'cancelled';
                      await updateDoc(convoRef, { bidStatus: newStatus });
                      break;
                  
                  case 'bid': {
                      const priceNum = payload as number;
                      if (!priceNum || priceNum <= 0) {
                          toast({ title: t('product_page.bid_dialog.invalid_price'), variant: "destructive" });
                          return;
                      }
                      autoMessage = t('chat.bid_initiate_message').replace('{price}', String(priceNum));
                      newStatus = 'pending';
                      await updateDoc(convoRef, { bidStatus: newStatus, bidPrice: priceNum, bidderId: user.uid });
                      break;
                  }
              }

              if (autoMessage) {
                  await sendMessage(autoMessage);
              }
              
              toast({ title: t('chat.action_success') });
          } catch (e: any) {
              console.error("Error handling bid action:", e);
              toast({ title: t('chat.action_fail'), description: e.message, variant: "destructive" });
          }
      });
  };


  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(message);
  };
  
  const getFormattedTime = (timestamp: Message['timestamp']) => {
    if (!timestamp) return '';
    try {
      const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp as string);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) {
      console.error("Error formatting time:", e, "with value:", timestamp);
      return '';
    }
  };

  const getFormattedDate = (timestamp: Message['timestamp']) => {
    if (!timestamp) return '';
    const date = new Date(timestamp as string);
    if (isToday(date)) return t('chat.today');
    if (isYesterday(date)) return t('chat.yesterday');
    return format(date, 'M月d日', { locale: zhHK });
  };

  const ChatProductHeader = () => {
    if (!conversation || !user) return null;
    
    const isSeller = user.uid === conversation.product.sellerId;
    const { product, bidStatus, bidPrice, bidderId, reviewStatus } = conversation;
    const bidPriceDisplay = bidPrice?.toLocaleString() ?? 'N/A';
    const otherUserId = conversation.participantIds.find(id => id !== user.uid);

    // This handles the final state once a deal is made or the product is sold via other means.
    if (product.status === 'sold') {
      const isAcceptedBid = bidStatus === 'accepted';
      const finalPrice = isAcceptedBid ? bidPrice : product.price;

      const hasCurrentUserReviewed = reviewStatus?.[user.uid] === true;
      const hasOtherUserReviewed = otherUserId ? reviewStatus?.[otherUserId] === true : false;
      
      const renderReviewAction = () => {
        // If current user has NOT reviewed, show "Leave Review" dialog.
        if (!hasCurrentUserReviewed) {
          return <ReviewDialog conversationData={conversation} />;
        }
        
        // If current user HAS reviewed, and other user HAS reviewed, show "View Review".
        if (hasCurrentUserReviewed && hasOtherUserReviewed) {
          return (
            <Button asChild className="h-8 rounded-full px-3 text-xs bg-gradient-to-r from-purple-500 to-indigo-600 text-primary-foreground hover:opacity-90 transition-opacity">
              <Link href={`/profile/${otherUserId}?tab=reviews`}>
                <MessageSquareQuote className="mr-1 h-4 w-4" />
                {t('chat.view_review')}
              </Link>
            </Button>
          );
        }

        // If current user HAS reviewed, but other user has NOT, show disabled "Waiting" button.
        if (hasCurrentUserReviewed && !hasOtherUserReviewed) {
          return (
            <Button className="h-8 rounded-full px-3 text-xs bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed" disabled>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                {t('chat.waiting_for_other_party')}
            </Button>
          )
        }
        
        return null;
      }
      
       const renderReviewStatusText = () => {
        let text = '';
        if (hasCurrentUserReviewed && hasOtherUserReviewed) {
          text = t('chat.review_status.both_reviewed');
        } else if (hasCurrentUserReviewed && !hasOtherUserReviewed) {
          text = t('chat.review_status.waiting_for_other');
        } else if (!hasCurrentUserReviewed && hasOtherUserReviewed) {
          text = t('chat.review_status.other_has_reviewed');
        } else {
          text = t('chat.review_status.prompt_to_review');
        }
         const textClass = cn('text-xs mt-1', {
            'text-green-600': hasCurrentUserReviewed && hasOtherUserReviewed,
            'text-muted-foreground animate-pulse': hasCurrentUserReviewed && !hasOtherUserReviewed,
            'text-blue-500 animate-pulse': !hasCurrentUserReviewed && hasOtherUserReviewed,
            'text-muted-foreground': !hasCurrentUserReviewed && !hasOtherUserReviewed,
        });

        return (
          <div className="relative flex overflow-x-hidden">
            <p className={cn(textClass, "animate-marquee whitespace-nowrap")}>
                <span className="mx-4">{text}</span>
                <span className="mx-4">{text}</span>
            </p>
          </div>
        )
      };


      return (
        <div className="sticky top-[48px] z-10 w-full border-b bg-background/80 backdrop-blur-sm">
          <div className="container mx-auto flex items-center justify-between gap-3 p-2">
            <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={() => router.push(`/products/${product.id}`)}>
              <div className="relative h-12 w-12 flex-shrink-0">
                  <Image src={product.image} alt={product.name} fill className="object-cover rounded-md" />
              </div>
              <div className="truncate">
                <p className="font-semibold text-sm truncate">{product.name}</p>
                <p className="text-xs text-green-600 font-bold">{t('chat.sold_for').replace('{price}', finalPrice?.toLocaleString() || '')}</p>
                 {renderReviewStatusText()}
              </div>
            </div>
             <div className="flex items-center gap-2">
                {renderReviewAction()}
             </div>
          </div>
        </div>
      );
    }

    const renderBuyerBidView = () => {
        if (isSeller) return null;

        if (bidderId === user.uid) { // Buyer is the current bidder
            if (bidStatus === 'pending') {
                return (
                    <Button 
                        className="h-8 rounded-full px-3 text-xs bg-gradient-to-r from-red-500 to-pink-600 text-primary-foreground hover:opacity-90 transition-opacity"
                        onClick={() => handleBidAction('cancel')} 
                        disabled={isBidActionPending}
                    >
                        {t('chat.cancel_bid')}
                    </Button>
                );
            }
            if (bidStatus === 'declined' || bidStatus === 'cancelled') {
                return (
                    <BidDialog
                        initialPrice={bidPrice || product.price || 0}
                        onBid={(newPrice) => handleBidAction('bid', newPrice)}
                        disabled={isBidActionPending}
                        isReBid={true}
                    />
                )
            }
        }
        
        // Default view for buyer: can always bid if no pending bid from them
        return (
            <BidDialog
                initialPrice={product.price || 0}
                onBid={(newPrice) => handleBidAction('bid', newPrice)}
                disabled={isBidActionPending}
            />
        )
    }

    const renderSellerBidView = () => {
         if (isSeller && bidStatus === 'pending' && conversation.id) {
            return (
                <div className='flex items-center gap-2'>
                    <Button
                        className="h-8 rounded-full px-4 text-xs bg-gradient-to-r from-red-500 to-pink-600 text-primary-foreground hover:opacity-90 transition-opacity"
                        onClick={() => handleBidAction('decline', { conversationId: conversation.id, bidPrice: bidPrice })}
                        disabled={isBidActionPending}
                    >
                        {t('chat.decline_bid')}
                    </Button>
                    <Button
                        className="h-8 rounded-full px-4 text-xs bg-gradient-to-r from-green-500 to-teal-600 text-primary-foreground hover:opacity-90 transition-opacity"
                        onClick={() => handleBidAction('accept', { conversationId: conversation.id, bidPrice: bidPrice })}
                        disabled={isBidActionPending}
                    >
                        {t('chat.accept_bid')}
                    </Button>
                </div>
            );
        }
        return null;
    }
    
    const renderBidStatusText = () => {
        const buyerName = otherUser?.displayName || t('chat.buyer');
        if (bidStatus === 'pending') {
            if (isSeller) {
                return <p className="text-xs text-muted-foreground mt-1">{t('chat.bid_status.seller_pending').replace('{buyerName}', buyerName)} <span className='font-bold text-primary'>${bidPriceDisplay}</span></p>;
            }
            if (bidderId === user.uid) {
                return <p className="text-xs text-muted-foreground mt-1">{t('chat.bid_status.buyer_pending')} <span className='font-bold text-primary'>${bidPriceDisplay}</span></p>;
            }
        }
        if (bidStatus === 'declined' && bidderId === user.uid) {
             return <p className="text-xs text-destructive mt-1">{t('chat.bid_status.declined')} <span className='font-bold'>${bidPriceDisplay}</span></p>;
        }
        return null;
    }


    // Default view when no special status
    return (
      <div className="sticky top-[48px] z-10 w-full border-b bg-background/80 backdrop-blur-sm">
         <div className="container mx-auto flex items-center justify-between gap-3 p-2">
            <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={() => router.push(`/products/${product.id}`)}>
              <div className="relative h-12 w-12 flex-shrink-0">
                  <Image src={product.image} alt={product.name} fill className="object-cover rounded-md" />
              </div>
              <div className="truncate">
                <p className="font-semibold text-sm truncate">{product.name}</p>
                {product.price && <p className="text-sm text-primary font-bold">${product.price.toLocaleString()}</p>}
                {renderBidStatusText()}
              </div>
            </div>

            <div className="flex-shrink-0">
              {isBidActionPending && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              {!isBidActionPending && (
                <>
                  { isSeller ? renderSellerBidView() : renderBuyerBidView() }
                </>
              )}
            </div>
         </div>
      </div>
    )
  }


  if (authLoading || loading) {
    return (
      <div className="flex flex-col h-screen">
        <Header title={t('header.title.loading')} showBackButton />
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-10 w-3/4 self-start rounded-lg" />
          <Skeleton className="h-10 w-3/4 self-end rounded-lg" />
          <Skeleton className="h-10 w-2/4 self-start rounded-lg" />
        </div>
      </div>
    );
  }

  if (!user || !conversation?.id) {
    // This case will be hit if the user logs out or if the conversation doesn't exist.
    // Redirecting to login might be a good fallback if there is no user.
    if (!authLoading && !user) {
        router.push('/login');
        return null;
    }
    return (
      <div className="flex flex-col h-screen">
        <Header title={t('chat.error_title')} showBackButton />
        <div className="flex-1 flex items-center justify-center p-4">
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t('chat.load_fail_title')}</AlertTitle>
                <AlertDescription>{error || t('chat.load_fail_desc')}</AlertDescription>
            </Alert>
        </div>
      </div>
    );
  }

  const hasStickyHeader = conversation?.product;
  
  return (
    <div className="flex flex-col h-screen bg-background">
      <Header title={otherUser?.displayName || t('header.title.chat')} showBackButton backHref="/messages" />
      
      {hasStickyHeader && <ChatProductHeader />}

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('chat.error_title')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!loading && messages.length === 0 && !error && (
          <div className="text-center text-muted-foreground py-16">
            <p>{t('chat.no_messages')}</p>
            <p>{t('chat.send_first_message')}</p>
          </div>
        )}
        {messages.map((msg, index) => {
          const isCurrentUser = msg.senderId === user?.uid;
          const showAvatar = !isCurrentUser && otherUser && (index === 0 || messages[index - 1]?.senderId !== msg.senderId);

          const currentMessageDate = new Date(msg.timestamp as string);
          const prevMessageDate = index > 0 ? new Date(messages[index - 1].timestamp as string) : null;
          const showDateSeparator = !prevMessageDate || !isSameDay(currentMessageDate, prevMessageDate);

          return (
            <React.Fragment key={msg.id}>
              {showDateSeparator && (
                <div className="flex justify-center my-4">
                  <div className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {getFormattedDate(msg.timestamp)}
                  </div>
                </div>
              )}
              <div className={cn("flex items-end gap-2", isCurrentUser ? "justify-end" : "justify-start")}>
                {!isCurrentUser && (
                  <Avatar className={cn("h-8 w-8", showAvatar ? 'opacity-100' : 'opacity-0')}>
                     {otherUser && <AvatarImage src={otherUser.photoURL || undefined} />}
                     {otherUser && <AvatarFallback>{otherUser.displayName?.charAt(0) || 'U'}</AvatarFallback>}
                  </Avatar>
                )}
                <div className={cn(
                  "max-w-xs md:max-w-md lg:max-w-lg rounded-2xl px-3 py-2 text-sm flex flex-col",
                  isCurrentUser
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-muted text-secondary-foreground rounded-bl-none"
                )}>
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  <span className={cn(
                      "text-xs mt-1",
                      isCurrentUser ? "self-end text-primary-foreground/70" : "self-start text-muted-foreground"
                  )}>
                    {getFormattedTime(msg.timestamp)}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-background/50 backdrop-blur-sm border-t p-2 border-white/10">
        <form onSubmit={handleSubmit} className="container mx-auto flex items-center gap-2 px-4">
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" asChild>
            <Label htmlFor="file-upload">
              <Plus className="h-5 w-5" />
            </Label>
          </Button>
          <input id="file-upload" type="file" className="hidden" />
          <div className="relative flex-1">
            <Input
              placeholder={t('chat.message_placeholder')}
              className="rounded-full pr-4"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <Button type="submit" size="icon" className="h-10 w-10 rounded-full" disabled={!message.trim()}>
            <SendHorizonal className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
