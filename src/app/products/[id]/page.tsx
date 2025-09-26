'use client';

import { useState, useEffect, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, Timestamp, updateDoc, deleteDoc, getDoc, arrayUnion, arrayRemove, increment, collection, serverTimestamp, setDoc, addDoc, writeBatch, where, query, getDocs, deleteField } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client-app';
import type { Product, FullUser, Conversation } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { zhHK } from 'date-fns/locale';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Heart,
  Share2 as Share,
  MessageCircle,
  Pencil,
  Archive,
  HandHeart,
  Trash2,
  Loader2,
  Package,
  PersonStanding,
  Truck,
  HandCoins,
  RefreshCw,
  Clock,
  Star,
} from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { cn } from '@/lib/utils';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';


// Reusable BidDialog component for initial bids and re-bids
function BidDialog({
  initialPrice,
  onBid,
  disabled,
}: {
  initialPrice: number;
  onBid: (newPrice: number) => void;
  disabled: boolean;
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
        <Button
          className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 p-2 text-xs text-primary-foreground dark:text-black shadow-md transition-colors hover:opacity-90 gap-1 active:scale-95"
          disabled={disabled}
        >
          <HandCoins className="h-5 w-5" />
          <span>出價</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>您想出價多少？</AlertDialogTitle>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bid-price" className="text-right">價格</Label>
              <Input id="bid-price" type="number" value={newBidPrice} onChange={(e) => setNewBidPrice(e.target.value)} className="col-span-3" />
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction onClick={handleSubmit} disabled={disabled} className="bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity">
            {disabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '確認出價'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const scrollDirection = useScrollDirection();
  const productId = Array.isArray(params.id) ? params.id[0] : params.id as string;
  
  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<FullUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isFavorited, setIsFavorited] = useState(false);

  // Effect to set initial favorited state from product data when it loads or user changes
  useEffect(() => {
    if (user && product) {
      setIsFavorited(product.favoritedBy?.includes(user.uid) ?? false);
    }
  }, [product, user]);

  // Effect 1: Solely for fetching and setting product data.
  useEffect(() => {
    if (!productId) return;

    setLoading(true);
    const docRef = doc(db, 'products', productId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const createdAt = data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString();

        const fetchedProduct: Product = {
            id: docSnap.id,
            ...data,
            createdAt: createdAt,
        };
        setProduct(fetchedProduct);
      } else {
        setProduct(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching product:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [productId]);

  // Effect 2: Fetch seller's latest info in real-time
  useEffect(() => {
    if (!product?.sellerId) return;

    const sellerRef = doc(db, 'users', product.sellerId);
    const unsubscribe = onSnapshot(sellerRef, (docSnap) => {
        if (docSnap.exists()) {
            setSeller(docSnap.data() as FullUser);
        } else {
            // Fallback if seller document is somehow deleted
            setSeller({
                uid: product.sellerId,
                displayName: product.sellerName,
                photoURL: product.sellerAvatar || null,
                email: null,
                createdAt: ''
            });
        }
    });

    return () => unsubscribe();
  }, [product?.sellerId, product?.sellerName, product?.sellerAvatar]);


  const postedTime = (): string => {
    if (!product?.createdAt) return '';
    try {
      const date = typeof product.createdAt === 'string'
        ? new Date(product.createdAt)
        : (product.createdAt as unknown as Timestamp).toDate();
      return formatDistanceToNow(date, { addSuffix: true, locale: zhHK });
    } catch (error) {
      console.error("Error formatting date:", error);
      return '';
    }
  };


  const handleStatusUpdate = (status: 'reserved' | 'sold' | null) => {
    if (!product || !user) return;
    
    startTransition(async () => {
      const productRef = doc(db, 'products', product.id);
      try {
        const updatePayload: { status?: 'reserved' | 'sold' | any } = {};
        if (status === null) {
          updatePayload.status = deleteField();
        } else {
          updatePayload.status = status;
        }
        await updateDoc(productRef, updatePayload);
        toast({ title: '狀態已更新' });
      } catch (error: any) {
        console.error('Error updating product status:', error);
        toast({ title: '更新失敗', description: error.message, variant: 'destructive' });
      }
    });
  };

  const handleDelete = () => {
    if (!product || !user) return;

    startTransition(async () => {
      const productRef = doc(db, 'products', product.id);
      try {
        await deleteDoc(productRef);
        toast({ title: "商品已刪除" });
        router.push('/');
      } catch (e: any) {
         toast({
            title: '刪除失敗',
            description: e.message || '發生未知錯誤，請稍後再試。',
            variant: 'destructive',
        });
      }
    });
  };
  
const findOrCreateConversation = async (): Promise<string | null> => {
    if (authLoading || !user) {
        if (!authLoading) {
            toast({ title: "請先登入", variant: "destructive" });
            router.push('/login');
        }
        return null;
    }
    if (!product || !seller) return null;

    if (user.uid === product.sellerId) {
        toast({ title: "這是您自己的商品", variant: "default" });
        return null;
    }

    const conversationsRef = collection(db, "conversations");
    const q1 = query(
      conversationsRef,
      where('product.id', '==', product.id),
      where('participantIds', 'array-contains', user.uid)
    );

    try {
        const querySnapshot = await getDocs(q1);
        // More robustly find the conversation that includes both users
        const existingConvo = querySnapshot.docs.find(doc => doc.data().participantIds.includes(seller.uid));
        
        if (existingConvo) {
             // Conversation already exists
             return existingConvo.id;
        }

        // --- Create a new conversation if it doesn't exist ---
        const newConversationRef = doc(collection(db, 'conversations'));
        const messageRef = doc(collection(newConversationRef, 'messages'));
        const participantIds = [user.uid, seller.uid].sort();
        
        const batch = writeBatch(db);

        const greetingMessage = `你好，我對這件商品「${product.name}」有興趣。`;

        const conversationData: Omit<Conversation, 'id'> = {
            participantIds: participantIds,
            participantDetails: {
                [user.uid]: { displayName: user.displayName || "用戶", photoURL: user.photoURL || "" },
                [seller.uid]: { displayName: seller.displayName || "賣家", photoURL: seller.photoURL || "" },
            },
            product: {
                id: product.id,
                name: product.name,
                image: product.images?.[0] || product.image,
                price: product.price,
                sellerId: product.sellerId,
                ...(product.status && { status: product.status }),
            },
            lastMessage: {
                text: greetingMessage,
                senderId: user.uid,
                timestamp: serverTimestamp(),
            },
            lastActivity: serverTimestamp(),
            unreadCounts: { [user.uid]: 0, [seller.uid]: 1 },
        };

        batch.set(newConversationRef, conversationData);
        
        batch.set(messageRef, {
            text: greetingMessage,
            senderId: user.uid,
            timestamp: serverTimestamp(),
        });

        await batch.commit();
        return newConversationRef.id;
        
    } catch (error: any) {
        console.error("Error finding or creating conversation:", error);
        toast({
            title: "無法開始對話",
            description: error.message || '發生未知錯誤，請檢查權限設定。',
            variant: "destructive"
        });
        return null;
    }
};
  
  const handleBid = (bidPrice: number) => {
    if (authLoading || !user || !seller) return;
    startTransition(async () => {
      const conversationId = await findOrCreateConversation();
      if (!conversationId) return; // Error handled in findOrCreateConversation

      const convoRef = doc(db, 'conversations', conversationId);
      const messagesColRef = collection(convoRef, 'messages');
      const autoMessage = `你好，我出價 $${bidPrice}。`;

      try {
        const batch = writeBatch(db);
        // 1. Update conversation with bid details
        batch.update(convoRef, {
          bidStatus: 'pending',
          bidPrice: bidPrice,
          bidderId: user.uid,
          lastMessage: { text: autoMessage, senderId: user.uid, timestamp: serverTimestamp() },
          lastActivity: serverTimestamp(),
          [`unreadCounts.${seller.uid}`]: increment(1)
        });

        // 2. Add the automated bid message
        batch.set(doc(messagesColRef), {
            text: autoMessage,
            senderId: user.uid,
            timestamp: serverTimestamp(),
        });
        
        await batch.commit();
        router.push(`/chat/${conversationId}`);
      } catch (e: any) {
        console.error("Error handling bid action:", e);
        toast({ title: "出價失敗", description: e.message, variant: "destructive" });
      }
    });
  };

  const handleStartChat = () => {
    if (authLoading || !user) return;
    startTransition(async () => {
        const conversationId = await findOrCreateConversation();
        if (conversationId) {
            router.push(`/chat/${conversationId}`);
        }
    });
  };

  const handleFavoriteToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (authLoading || !user) {
        toast({ title: "請先登入", description: "您需要登入才能收藏商品。", variant: "destructive" });
        if(!authLoading) router.push('/login');
        return;
    }
    
    if (!product) return;

    const productRef = doc(db, 'products', product.id);
    const newFavoritedState = !isFavorited;
    
    // Optimistic UI update
    setIsFavorited(newFavoritedState);

    startTransition(async () => {
      try {
        if (newFavoritedState) {
          await updateDoc(productRef, {
            favoritedBy: arrayUnion(user.uid),
            favorites: increment(1),
          });
        } else {
          await updateDoc(productRef, {
            favoritedBy: arrayRemove(user.uid),
            favorites: increment(-1),
          });
        }
      } catch (error: any) {
        // Revert UI on error
        setIsFavorited(!newFavoritedState);
        console.error('Error toggling favorite status:', error);
        toast({ title: '操作失敗', description: "請檢查您的網絡連線或稍後再試。", variant: 'destructive' });
      }
    });
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating to product page
    e.stopPropagation();
    if (!product) return;
    const shareData = {
      title: product.name,
      text: `來看看這個超讚的商品：${product.name}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.error('分享失敗或被取消:', error);
      }
    } else {
       toast({ title: '分享失敗', description: '您的瀏覽器不支援分享功能。', variant: 'destructive' });
    }
  };


  if (authLoading) {
    return <ProductPageSkeleton scrollDirection={scrollDirection} />;
  }

  if (loading) {
    return <ProductPageSkeleton scrollDirection={scrollDirection} />;
  }

  if (!product) {
    notFound();
  }

  const isSeller = user?.uid === product.sellerId;
  const displayPrice = product.price ?? 0;
  const sellerDisplayName = seller?.displayName || product.sellerName;
  const sellerDisplayAvatar = seller?.photoURL || product.sellerAvatar;
  const isDiscounted = typeof product.originalPrice === 'number' && typeof displayPrice === 'number' && displayPrice < product.originalPrice;
  const productImages = product.images?.length ? product.images : [product.image];


  const SellerActionBar = () => {
    const isSold = product.status === 'sold';

    if (isSold) {
      return (
        <div className={cn(
            'fixed inset-x-0 bottom-24 z-50 flex justify-center transition-transform duration-300 md:hidden',
            scrollDirection === 'down' ? 'translate-y-full' : 'translate-y-0'
          )}>
          <div className="flex items-center gap-2 glass-morphism">
             <AlertDialog>
              <AlertDialogTrigger asChild>
                 <Button
                    className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-pink-600 p-1 text-xs text-primary-foreground dark:text-black shadow-md transition-colors hover:opacity-90 gap-1 active:scale-95"
                    disabled={isPending}
                 >
                    <Trash2 className="h-5 w-5" />
                    刪除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>確定要永久刪除嗎？</AlertDialogTitle>
                  <AlertDialogDescription>
                    此操作無法復原。這將會永久刪除您的商品資料，相關對話中的商品資訊將不會更新。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity"
                  >
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    確認刪除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
                className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-500 p-2 text-xs text-primary-foreground dark:text-black shadow-md transition-colors hover:opacity-90 gap-1 active:scale-95"
                onClick={() => handleStatusUpdate(null)}
                disabled={isPending}
            >
                {isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="h-5 w-5" />
                    <span>重刊</span>
                  </>
                )}
            </Button>
        </div>
      </div>
      );
    }

    return (
       <div className={cn(
            'fixed inset-x-0 bottom-24 z-50 flex justify-center transition-transform duration-300 md:hidden',
            scrollDirection === 'down' ? 'translate-y-full' : 'translate-y-0'
          )}>
        <div className="flex items-center gap-2">
          {/* Action buttons group */}
          <div className="flex items-center gap-2 glass-morphism">
            {/* Edit Button */}
            <Link href={`/products/${product.id}/edit`}>
              <Button
                variant="ghost"
                className="flex h-14 w-14 flex-col items-center justify-center rounded-full p-1 text-xs text-muted-foreground hover:bg-transparent hover:text-muted-foreground/80 gap-1 active:scale-95"
                disabled={isPending || isSold}
              >
                <Pencil className="h-5 w-5" />
                <span className="">編輯</span>
              </Button>
            </Link>

            {/* Reserve Button */}
            <div className="relative flex flex-col items-center justify-center">
              <Button
                variant="ghost"
                className={cn(
                  'z-10 flex h-14 w-14 flex-col items-center justify-center rounded-full p-1 text-xs text-muted-foreground hover:bg-transparent hover:text-muted-foreground/80 gap-1 active:scale-95',
                  product.status === 'reserved' && 'text-primary-foreground'
                )}
                onClick={() => handleStatusUpdate(product.status === 'reserved' ? null : 'reserved')}
                disabled={isPending || isSold}
              >
                <HandHeart className="h-5 w-5" />
                <span className="">保留</span>
              </Button>
              {product.status === 'reserved' && (
                <div className="pointer-events-none absolute inset-0 -z-0 flex items-center justify-center">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400"></div>
                </div>
              )}
            </div>

            {/* Sold Button */}
            <Button
              variant="ghost"
              className="flex h-14 w-14 flex-col items-center justify-center rounded-full p-1 text-xs text-muted-foreground hover:bg-transparent hover:text-muted-foreground/80 gap-1 active:scale-95"
              onClick={() => handleStatusUpdate('sold')}
              disabled={isPending || isSold}
            >
              {isPending && !isSold ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Archive className="h-5 w-5" />
              )}
              <span className="">{isSold ? '已售' : '售出'}</span>
            </Button>
          </div>

          {/* Delete Button */}
          <div className="glass-morphism">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-14 w-14 flex-shrink-0 rounded-full text-primary-foreground dark:text-black hover:opacity-90 transition-opacity active:scale-95"
                  disabled={isPending || isSold}
                >
                  <Trash2 className="h-5 w-5 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>確定要刪除嗎？</AlertDialogTitle>
                  <AlertDialogDescription>
                    此操作無法復原。這將會永久刪除您的商品資料。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity"
                  >
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    刪除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    );
  };


  const BuyerActionBar = () => (
     <div className={cn(
        'fixed inset-x-0 bottom-24 z-50 flex justify-center transition-transform duration-300 md:hidden',
        scrollDirection === 'down' ? 'translate-y-full' : 'translate-y-0'
      )}>
        <div className="flex items-center gap-2 glass-morphism">
           <Button
              onClick={handleStartChat}
              disabled={isPending || authLoading}
              className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 p-2 text-xs text-primary-foreground dark:text-black shadow-md transition-colors hover:opacity-90 gap-1 active:scale-95"
          >
              {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-5 w-5" />}
              <span>傾傾</span>
          </Button>
          <BidDialog initialPrice={displayPrice} onBid={handleBid} disabled={isPending || authLoading} />
        </div>
    </div>
  );

  return (
    <div className="min-h-screen">
        <Header showBackButton={true} showUserAvatar />
        <div className="relative">
          <Carousel
            className="w-full"
            opts={{
              loop: productImages.length > 1,
            }}
          >
            <CarouselContent>
              {productImages.map((image, index) => (
                <CarouselItem key={index}>
                  <div className="relative aspect-square w-full">
                    <img
                      src={image || 'https://picsum.photos/600/400'}
                      alt={`${product.name || '商品圖片'} ${index + 1}`}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {productImages.length > 1 && (
              <>
                <CarouselPrevious className="absolute left-4" />
                <CarouselNext className="absolute right-4" />
              </>
            )}
             <div className="absolute top-2 left-2 flex gap-2">
                {isDiscounted && (
                  <Badge className={cn('text-xs px-2 py-0.5 font-semibold', 'bg-destructive text-destructive-foreground')}>
                      特價中
                  </Badge>
                )}
                {product.status && (
                  <Badge
                    className={cn(
                      'text-xs px-2 py-0.5 font-semibold',
                      product.status === 'sold' && 'bg-destructive text-destructive-foreground',
                      product.status === 'reserved' && 'bg-gradient-to-br from-blue-500 to-cyan-400 text-primary-foreground'
                    )}
                  >
                    {product.status === 'sold' ? '已售出' : '已預留'}
                  </Badge>
                )}
            </div>
            <div className="absolute top-2 right-2 flex items-center gap-2">
                <button
                    onClick={handleShare}
                    className={cn(
                        "flex items-center justify-center rounded-full bg-black/40 text-white transition-colors h-7 w-7",
                        "hover:bg-black/60",
                        "active:scale-95"
                    )}
                    aria-label="分享"
                >
                    <Share className="h-4 w-4" />
                </button>
                <button
                    onClick={handleFavoriteToggle}
                    disabled={isPending || authLoading}
                    className={cn(
                        "flex items-center justify-center gap-1 rounded-full bg-black/40 text-white text-xs font-bold transition-colors h-7 px-2",
                        "hover:bg-black/60",
                        isFavorited && "text-red-500",
                        (isPending || authLoading) && "animate-pulse",
                        "active:scale-95"
                    )}
                    aria-label={isFavorited ? "取消收藏" : "加入收藏"}
                >
                    <Heart className={cn("h-4 w-4", isFavorited && "fill-current")} />
                    <span>{product.favorites || 0}</span>
                </button>
            </div>
          </Carousel>
        </div>

        <div className="container mx-auto px-4 md:px-6 py-4 pb-48">
          <p className="text-xs text-muted-foreground">{product.category}</p>
          <h1 className="text-2xl font-bold mt-1">{product.name}</h1>
          <div className="flex items-baseline gap-4 mt-2">
              <p className={cn("text-3xl font-bold", isDiscounted ? "text-[hsl(var(--sale-price))]" : "text-primary")}>
                  ${displayPrice.toLocaleString()}
              </p>
              {isDiscounted && product.originalPrice && (
                <p className="text-xl text-muted-foreground line-through">
                  ${product.originalPrice.toLocaleString()}
                </p>
              )}
          </div>

          <Separator className="my-4" />

          <h2 className="text-base font-semibold text-muted-foreground">商品詳情</h2>
          <div className="mt-2 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4">
                  <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <div>
                          <p className="text-muted-foreground text-xs">狀況</p>
                          <p className="font-medium">{product.condition}</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                          <p className="text-muted-foreground text-xs">刊登時間</p>
                          <p className="font-medium">{postedTime()}</p>
                      </div>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4">
                  <div className="flex items-center gap-2">
                      {(product.shippingMethods || []).includes('面交') && <PersonStanding className="h-4 w-4 text-muted-foreground" />}
                      {!(product.shippingMethods || []).includes('面交') && (product.shippingMethods || []).length > 0 && <Truck className="h-4 w-4 text-muted-foreground" />}
                      <div>
                          <p className="text-muted-foreground text-xs">交收方式</p>
                          <p className="font-medium">{(product.shippingMethods || []).join('、')}</p>
                      </div>
                  </div>
                  {(product.shippingMethods || []).includes('面交') && product.pickupLocation && (
                      <div className="flex items-center gap-2">
                          <div className="w-4 h-4"></div>
                          <div>
                              <p className="text-muted-foreground text-xs">地點</p>
                              <p className="font-medium">{product.pickupLocation}</p>
                          </div>
                      </div>
                  )}
              </div>
          </div>


          <Separator className="my-4" />

          <div className="flex justify-between items-center">
            <Link href={`/profile/${product.sellerId}`} className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={sellerDisplayAvatar || undefined} alt={sellerDisplayName || '賣家頭像'} />
                <AvatarFallback>{sellerDisplayName?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">{sellerDisplayName}</p>
                <div className="flex items-center gap-1 text-muted-foreground">
                    <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                    <span className="font-bold text-xs text-foreground">
                        {(seller?.averageRating || 0).toFixed(1)}
                    </span>
                    <span className="text-xs">({seller?.reviewCount || 0})</span>
                </div>
              </div>
            </Link>
            <Button asChild variant="outline" size="sm">
              <Link href={`/profile/${product.sellerId}`}>
                查看賣場
              </Link>
            </Button>
          </div>

          <Separator className="my-4" />

          <h2 className="text-base font-semibold text-muted-foreground">商品描述</h2>
          <p className="mt-2 text-foreground/80 leading-normal whitespace-pre-wrap text-sm">
            {product.description}
          </p>

        </div>

        {isSeller ? <SellerActionBar /> : <BuyerActionBar />}
    </div>
  );
}

function ProductPageSkeleton({ scrollDirection }: { scrollDirection: 'up' | 'down' | null }) {
  return (
    <div className="min-h-screen">
      <Header showBackButton />
      <Skeleton className="relative aspect-square w-full" />
      <div className="container mx-auto px-4 md:px-6 py-8">
        <Skeleton className="h-4 w-1/4 mb-2" />
        <Skeleton className="h-8 w-3/4 mb-4" />
        <Skeleton className="h-10 w-1/2 mb-6" />
        <Separator className="my-6" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Separator className="my-6" />
        <Skeleton className="h-6 w-1/3 mb-4" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
