
'use client';

import { useTransition, useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, Share2, Star } from 'lucide-react';
import type { Product, FullUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Skeleton } from './ui/skeleton';
import { Button } from './ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, increment, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client-app';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/use-translation';


type ProductCardProps = {
  product: Product;
};

// This map helps to handle both old (Chinese) and new (English) condition values from the database.
const conditionMap: { [key: string]: Product['condition'] } = {
  '全新': 'new',
  '幾乎全新': 'like_new',
  '較少使用': 'lightly_used',
  '狀況良好': 'good',
  '狀況尚可': 'fair',
  // English values map to themselves
  'new': 'new',
  'like_new': 'like_new',
  'lightly_used': 'lightly_used',
  'good': 'good',
  'fair': 'fair',
};


export function ProductCard({ product: initialProduct }: ProductCardProps) {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // --- Real-time State ---
  const [liveProduct, setLiveProduct] = useState<Product | null>(initialProduct);
  const [seller, setSeller] = useState<FullUser | null>(null);
  
  const [isFavorited, setIsFavorited] = useState(false);
  const [optimisticFavorites, setOptimisticFavorites] = useState(initialProduct.favorites || 0);

  // Effect to listen for real-time updates on the product itself.
  // This solves the stale data issue when a product is updated elsewhere.
  useEffect(() => {
    if (!initialProduct?.id) return;
    const productRef = doc(db, 'products', initialProduct.id);
    const unsubscribe = onSnapshot(productRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const createdAt = data.createdAt instanceof Timestamp 
            ? data.createdAt.toDate().toISOString() 
            : new Date().toISOString();
        const updatedProduct = { id: docSnap.id, ...data, createdAt } as Product;
        setLiveProduct(updatedProduct);
      } else {
        // The product has been deleted.
        setLiveProduct(null);
      }
    });
    return () => unsubscribe();
  }, [initialProduct.id]);

  // Effect for setting favorited state and favorite count based on the live product data.
  useEffect(() => {
    if (user && liveProduct) {
      setIsFavorited(liveProduct.favoritedBy?.includes(user.uid));
      setOptimisticFavorites(liveProduct.favorites || 0);
    }
  }, [liveProduct, user]);


  // Effect for fetching the seller's real-time information.
  useEffect(() => {
    if (!liveProduct?.sellerId) return;
    
    const sellerRef = doc(db, 'users', liveProduct.sellerId);
    const unsubscribe = onSnapshot(sellerRef, (docSnap) => {
      if (docSnap.exists()) {
        setSeller(docSnap.data() as FullUser);
      } else {
        // Fallback to data on product if seller doc not found
        setSeller({
            uid: liveProduct.sellerId,
            displayName: liveProduct.sellerName,
            photoURL: liveProduct.sellerAvatar || null,
            email: null,
            createdAt: ''
        });
      }
    });

    return () => unsubscribe();
  }, [liveProduct?.sellerId, liveProduct?.sellerName, liveProduct?.sellerAvatar]);


  const handleFavoriteToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
        toast({ title: "請先登入", description: "您需要登入才能收藏商品。", variant: "destructive" });
        router.push('/login');
        return;
    }
    
    if (!liveProduct) return;

    const productRef = doc(db, 'products', liveProduct.id);
    const newFavoritedState = !isFavorited;
    const originalFavorites = optimisticFavorites;
    
    // Optimistic UI update for both state and count
    setIsFavorited(newFavoritedState);
    setOptimisticFavorites(prev => newFavoritedState ? prev + 1 : prev - 1);


    startTransition(async () => {
      try {
        if (newFavoritedState) {
          await updateDoc(productRef, {
            favoritedBy: arrayUnion(currentUser.uid),
            favorites: increment(1),
          });
        } else {
          await updateDoc(productRef, {
            favoritedBy: arrayRemove(currentUser.uid),
            favorites: increment(-1),
          });
        }
      } catch (error: any) {
        // Revert UI on error
        setIsFavorited(!newFavoritedState);
        setOptimisticFavorites(originalFavorites);
        console.error('Error toggling favorite status:', error);
        toast({ title: '操作失敗', description: "請檢查您的網絡連線或稍後再試。", variant: 'destructive' });
      }
    });
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!liveProduct) return;
    const shareData = {
      title: liveProduct.name,
      text: `來看看這個超讚的商品：${liveProduct.name}`,
      url: `${window.location.origin}/products/${liveProduct.id}`,
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


  if (!liveProduct) {
    // If liveProduct becomes null (e.g., deleted), render nothing.
    return null;
  }
  
  const { id, name, price, image, images, favorites, status, condition, originalPrice } = liveProduct;
  
  const safeImage = images?.[0] || image || 'https://picsum.photos/600/400';
  const safeName = name || '無標題商品';
  
  const safeSellerName = seller?.displayName || liveProduct.sellerName || '匿名賣家';
  const sellerAvatar = seller?.photoURL || liveProduct.sellerAvatar;
  const isDiscounted = typeof originalPrice === 'number' && typeof price === 'number' && price < originalPrice;
  const conditionKey = (condition && conditionMap[condition as keyof typeof conditionMap]) || condition;


  return (
    <Card className="w-full h-full flex flex-col overflow-hidden transition-all hover:shadow-lg group border-none shadow-md bg-card">
        <div className="relative w-full overflow-hidden aspect-square">
            <Link href={`/products/${id}`} aria-label={safeName}>
              <Image
                src={safeImage}
                alt={safeName}
                width={400}
                height={400}
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                data-ai-hint="product image"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/600/400'; }}
              />
            </Link>
            <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
                {isDiscounted && (
                  <Badge className="text-[10px] px-1.5 py-0.5 font-semibold z-10 bg-destructive text-destructive-foreground">
                      特價中
                  </Badge>
                )}
                {status && (
                    <Badge
                        className={cn(
                        'text-[10px] px-1.5 py-0.5 font-semibold z-10',
                        status === 'sold' && 'bg-destructive text-destructive-foreground',
                        status === 'reserved' && 'bg-gradient-to-br from-blue-500 to-cyan-400 text-primary-foreground dark:text-black'
                        )}
                    >
                        {status === 'sold' ? '已售出' : '已預留'}
                    </Badge>
                )}
            </div>
            
            <button
                onClick={handleFavoriteToggle}
                disabled={isPending || authLoading}
                className={cn(
                    "absolute top-2 right-2 flex items-center justify-center gap-1 rounded-full bg-black/40 text-white text-xs font-bold transition-colors h-7 px-2",
                    "hover:bg-black/60",
                    isFavorited && "text-red-500",
                    (isPending || authLoading) && "animate-pulse"
                )}
                aria-label={isFavorited ? "取消收藏" : "加入收藏"}
            >
                <Heart className={cn("h-4 w-4", isFavorited && "fill-current")} />
                <span>{optimisticFavorites}</span>
            </button>
            
            <div className="absolute bottom-2 right-2">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
                    onClick={handleShare}
                >
                    <Share2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
        <CardContent className="p-3 flex-1 flex flex-col justify-between">
            <div>
                <h3 className="font-semibold truncate text-sm">{safeName}</h3>
                <div className="mt-1">
                  <div className="flex justify-between items-center">
                      <p className={cn("text-base font-bold leading-tight", isDiscounted ? "text-[hsl(var(--sale-price))]" : "text-primary")}>
                          ${(price || 0).toLocaleString()}
                      </p>
                       {conditionKey && <div className="text-[10px] border border-muted-foreground/50 rounded-full px-1.5 py-0.5 text-muted-foreground flex-shrink-0">{t(`condition.${conditionKey}` as any)}</div>}
                  </div>
                  {isDiscounted && originalPrice && (
                      <p className="text-[10px] text-muted-foreground line-through">
                          ${originalPrice.toLocaleString()}
                      </p>
                  )}
                </div>
            </div>

            <div className="flex w-full justify-between items-center pt-2">
                 <Link href={`/profile/${liveProduct.sellerId}`} className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-6 w-6">
                        <AvatarImage src={sellerAvatar || undefined} alt={safeSellerName} width={24} height={24} />
                        <AvatarFallback className="text-xs">{safeSellerName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-[11px] text-muted-foreground font-medium truncate">{safeSellerName}</span>
                </Link>
                <div className="flex items-center gap-1 text-muted-foreground">
                    <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                    <span className="font-bold text-[10px] text-foreground">
                    {(seller?.averageRating || 0).toFixed(1)}
                    </span>
                </div>
            </div>

        </CardContent>
    </Card>
  );
}
