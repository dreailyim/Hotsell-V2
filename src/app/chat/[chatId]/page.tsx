
'use client';

import { useState, useEffect, useRef, useCallback, useTransition } from 'react';
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
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, doc, updateDoc, writeBatch, setDoc, where, getDocs, limit } from 'firebase/firestore';
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

    const handleSubmit = () => {
        const priceNum = parseFloat(newBidPrice);
        if (isNaN(priceNum) || priceNum <= 0) {
             toast({ title: "請輸入有效的出價金額。", variant: "destructive" });
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
                    {isReBid ? '重新出價' : '出價'}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>您想出價多少？</AlertDialogTitle>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="bid-price" className="text-right">價格</Label>
                            <Input id="bid-price" type="number" value={newBidPrice} onChange={(e) => setNewBidPrice(e.target.value)} className="col-span-3"/>
                        </div>
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-full">取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmit} disabled={disabled} className="rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity">
                       {disabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '確認出價'}
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
      toast({ title: "請給予評分", variant: 'destructive' });
      return;
    }
     if (comment.trim().length < 5) {
      toast({ title: "評論內容過短", description: "請輸入至少5個字。", variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      
      const ratedUserId = participantIds.find(p => p !== user.uid);
      if (!ratedUserId) throw new Error("找不到被評價的用戶");

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

      toast({ title: "評價已成功送出！", description: "感謝您的反饋。" });
      setOpen(false);
      setHasReviewed(true); // Update state immediately
      setRating(0);
      setComment('');

    } catch (e: any) {
      console.error("Error submitting review:", e);
      toast({ title: "評價送出失敗", description: e.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
   if (hasReviewed) {
      return (
        <Button className="h-8 rounded-full px-3 text-xs bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed" disabled>
            <Star className="mr-1 h-4 w-4" />
            已評價
        </Button>
      )
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
            <Button
              className="h-8 rounded-full px-3 mr-1.5 text-xs bg-gradient-to-r from-blue-500 to-cyan-400 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity"
            >
              <Star className="mr-1 h-4 w-4" />
              留下評價
            </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>為這次交易留下評價</AlertDialogTitle>
            <AlertDialogDescription>您的反饋對賣家和其他買家都非常重要。</AlertDialogDescription>
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
                placeholder="分享您的交易體驗..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[100px]"
            />
            </div>
            <AlertDialogFooter className="sm:flex-col sm:space-x-0 sm:gap-2">
            <AlertDialogAction 
                onClick={handleSubmitReview} 
                disabled={isSubmitting}
                className="w-full rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity"
                >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '送出評價'}
            </AlertDialogAction>
            <AlertDialogCancel className="w-full rounded-full mt-0">稍後再說</AlertDialogCancel>
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
    if (trimmedText === '' || authLoading || !user || !conversationId) return;
    
    const convoRef = doc(db, 'conversations', conversationId);
    const messagesColRef = collection(convoRef, 'messages');
    
    try {
      const batch = writeBatch(db);
      
      // 1. Add the new message document
      const newMessageRef = doc(messagesColRef);
      batch.set(newMessageRef, {
        text: trimmedText,
        senderId: user.uid,
        timestamp: serverTimestamp(),
      });
      
      // 2. Update the parent conversation document
      batch.update(convoRef, {
          lastMessage: { text: trimmedText, senderId: user.uid, timestamp: serverTimestamp() },
          lastActivity: serverTimestamp(),
      });

      await batch.commit();

      if (text === message) {
          setMessage('');
      }
      setError(null);
    } catch (error: any) {
      console.error("Error sending message:", error);
      setError(`訊息傳送失敗: ${error.message}`);
    }
  }, [user, conversationId, message, authLoading]);
  
  
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
    // Listener for the conversation document itself
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
            setError("找不到此對話。");
        }
        setLoading(false);
    }, (err) => {
        console.error("Error listening to conversation document: ", err);
        setError(`無法讀取對話資訊: ${err.message}`);
        setLoading(false);
    });


    // Listener for messages subcollection
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
      setError(`無法讀取訊息: ${err.message}`);
    });

    return () => {
        convoUnsubscribe();
        messagesUnsubscribe();
    };
  }, [user, conversationId, authLoading]);

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
                  toast({ title: "操作失敗", description: "找不到對話 ID。", variant: "destructive" });
                  return;
              }
              
              const convoRef = doc(db, 'conversations', convoId);
              let autoMessage = '';
              let newStatus: Conversation['bidStatus'] = 'pending';
              
              switch (action) {
                  case 'accept': {
                      if (!currentBidPrice) return;
                      autoMessage = `賣家已接受您的出價 $${currentBidPrice}，交易成立！`;
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
                      autoMessage = `賣家拒絕了您的出價 $${currentBidPrice}。`;
                      newStatus = 'declined';
                      await updateDoc(convoRef, { bidStatus: newStatus });
                      break;

                  case 'cancel':
                      if (!currentBidPrice) return;
                      autoMessage = `我已取消出價 $${currentBidPrice}。`;
                      newStatus = 'cancelled';
                      await updateDoc(convoRef, { bidStatus: newStatus });
                      break;
                  
                  case 'bid': {
                      const priceNum = payload as number;
                      if (!priceNum || priceNum <= 0) {
                          toast({ title: "請輸入有效的出價金額。", variant: "destructive" });
                          return;
                      }
                      autoMessage = `你好，我出價 $${priceNum}。`;
                      newStatus = 'pending';
                      await updateDoc(convoRef, { bidStatus: newStatus, bidPrice: priceNum, bidderId: user.uid });
                      break;
                  }
              }

              if (autoMessage) {
                  await sendMessage(autoMessage);
              }
              
              toast({ title: "操作成功！" });
          } catch (e: any) {
              console.error("Error handling bid action:", e);
              toast({ title: "操作失敗", description: e.message, variant: "destructive" });
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
        return (
          hasCurrentUserReviewed ? (
            <Button asChild className="h-8 rounded-full px-3 text-xs bg-gradient-to-r from-purple-500 to-indigo-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity">
              <Link href={`/profile/${otherUserId}?tab=reviews`}>
                <MessageSquareQuote className="mr-1 h-4 w-4" />
                查看評價
              </Link>
            </Button>
          ) : (
            <ReviewDialog conversationData={conversation} />
          )
        );
      }
      
       const renderReviewStatusText = () => {
        if (hasCurrentUserReviewed && hasOtherUserReviewed) {
          return <p className="text-xs text-muted-foreground mt-1">對方已對你評價</p>;
        }
        if (hasCurrentUserReviewed && !hasOtherUserReviewed) {
          return <p className="text-xs text-muted-foreground mt-1 animate-pulse">等待對方評價...</p>;
        }
        if (!hasCurrentUserReviewed && hasOtherUserReviewed) {
          return <p className="text-xs text-blue-500 mt-1 animate-pulse">對方俾咗評價你喇，爭你咋！</p>;
        }
        return <p className="text-xs text-muted-foreground mt-1">交易已完成，快啲評價對方啦！</p>;
      };


      return (
        <div className="sticky top-[56px] z-10 w-full border-b bg-background/80 backdrop-blur-sm">
          <div className="container mx-auto flex items-center justify-between gap-3 p-2">
            <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={() => router.push(`/products/${product.id}`)}>
              <div className="relative h-12 w-12 flex-shrink-0">
                  <Image src={product.image} alt={product.name} fill className="object-cover rounded-md" />
              </div>
              <div className="truncate">
                <p className="font-semibold text-sm truncate">{product.name}</p>
                <p className="text-xs text-green-600 font-bold">已售出 ${finalPrice?.toLocaleString()}</p>
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
                        取消出價
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
                        className="h-8 rounded-full px-4 text-xs bg-gradient-to-r from-red-500 to-pink-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity"
                        onClick={() => handleBidAction('decline', { conversationId: conversation.id, bidPrice: bidPrice })}
                        disabled={isBidActionPending}
                    >
                        拒絕
                    </Button>
                    <Button
                        className="h-8 rounded-full px-4 text-xs bg-gradient-to-r from-green-500 to-teal-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity"
                        onClick={() => handleBidAction('accept', { conversationId: conversation.id, bidPrice: bidPrice })}
                        disabled={isBidActionPending}
                    >
                        接受
                    </Button>
                </div>
            );
        }
        return null;
    }
    
    const renderBidStatusText = () => {
        const buyerName = otherUser?.displayName || '買家';
        if (bidStatus === 'pending') {
            if (isSeller) {
                return <p className="text-xs text-muted-foreground mt-1">{buyerName} 已出價 <span className='font-bold text-primary'>${bidPriceDisplay}</span></p>;
            }
            if (bidderId === user.uid) {
                return <p className="text-xs text-muted-foreground mt-1">你已出價 <span className='font-bold text-primary'>${bidPriceDisplay}</span></p>;
            }
        }
        if (bidStatus === 'declined' && bidderId === user.uid) {
             return <p className="text-xs text-destructive mt-1">賣家已拒絕你 <span className='font-bold'>${bidPriceDisplay}</span> 的出價</p>;
        }
        return null;
    }


    // Default view when no special status
    return (
      <div className="sticky top-[56px] z-10 w-full border-b bg-background/80 backdrop-blur-sm">
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
        <Header title="讀取中..." showBackButton />
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
        <Header title="錯誤" showBackButton />
        <div className="flex-1 flex items-center justify-center p-4">
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>無法載入對話</AlertTitle>
                <AlertDescription>{error || '請確認您有權限瀏覽此對話，或返回上一頁。'}</AlertDescription>
            </Alert>
        </div>
      </div>
    );
  }

  const hasStickyHeader = conversation?.product?.status === 'sold';
  const chatPaddingTop = hasStickyHeader ? 'pt-[92px]' : 'pt-4';
  const headerHeight = 56; // from Header component h-14
  const chatProductHeaderHeight = 68; // from ChatProductHeader p-2(8) + h-12(48) + p-2(8) + border-b(1) ~approx 68px
  const stickyTopValue = `${headerHeight}px`;

  return (
    <div className="flex flex-col h-screen">
      <Header title={otherUser?.displayName || "對話"} showBackButton />
      <ChatProductHeader />

      <div className={cn("flex-1 overflow-y-auto p-4 space-y-4", hasStickyHeader && "pt-4")}>
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>錯誤</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!loading && messages.length === 0 && !error && (
          <div className="text-center text-muted-foreground py-16">
            <p>這裏沒有訊息。</p>
            <p>快來傳送您的第一則訊息吧！</p>
          </div>
        )}
        {messages.map((msg, index) => {
          const isCurrentUser = msg.senderId === user?.uid;
          const showAvatar = !isCurrentUser && otherUser && (index === 0 || messages[index - 1]?.senderId !== msg.senderId);

          return (
            <div key={msg.id} className={cn("flex items-end gap-2", isCurrentUser ? "justify-end" : "justify-start")}>
              {!isCurrentUser && (
                <Avatar className={cn("h-8 w-8", showAvatar ? 'opacity-100' : 'opacity-0')}>
                   {otherUser && <AvatarImage src={otherUser.photoURL || undefined} />}
                   {otherUser && <AvatarFallback>{otherUser.displayName?.charAt(0) || 'U'}</AvatarFallback>}
                </Avatar>
              )}
              <div className={cn(
                "max-w-xs md:max-w-md lg:max-w-lg rounded-2xl px-4 py-2 text-sm",
                isCurrentUser
                  ? "bg-primary text-primary-foreground rounded-br-none"
                  : "bg-muted text-secondary-foreground rounded-bl-none"
              )}>
                <p className="whitespace-pre-wrap break-words">{msg.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-background/50 backdrop-blur-sm border-t p-2">
        <form onSubmit={handleSubmit} className="container mx-auto flex items-center gap-2 px-4">
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" asChild>
            <Label htmlFor="file-upload">
              <Plus className="h-5 w-5" />
            </Label>
          </Button>
          <input id="file-upload" type="file" className="hidden" />
          <div className="relative flex-1">
            <Input
              placeholder="輸入訊息..."
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
