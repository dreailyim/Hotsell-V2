
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
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client-app';
import { useRouter } from 'next/navigation';


type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [seller, setSeller] = useState<FullUser | null>(null);
  
  const [isFavorited, setIsFavorited] = useState(false);
  
  // Effect to set initial favorited state from product data when it loads or user changes
  useEffect(() => {
    if (user && product) {
      setIsFavorited(product.favoritedBy?.includes(user.uid));
    }
  }, [product, user]);


  useEffect(() => {
    if (!product.sellerId) return;
    
    const sellerRef = doc(db, 'users', product.sellerId);
    const unsubscribe = onSnapshot(sellerRef, (docSnap) => {
      if (docSnap.exists()) {
        setSeller(docSnap.data() as FullUser);
      } else {
        // Fallback to data on product if seller doc not found
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
  }, [product.sellerId, product.sellerName, product.sellerAvatar]);


  const handleFavoriteToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Use direct check to auth object to prevent race conditions with async state
    const currentUser = auth.currentUser;

    if (!currentUser) {
        toast({ title: "請先登入", description: "您需要登入才能收藏商品。", variant: "destructive" });
        router.push('/login');
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
            favoritedBy: arrayUnion(currentUser.uid),
          });
        } else {
          await updateDoc(productRef, {
            favoritedBy: arrayRemove(currentUser.uid),
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
    const shareData = {
      title: product.name,
      text: `來看看這個超讚的商品：${product.name}`,
      url: `${window.location.origin}/products/${id}`,
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


  if (!product?.id) {
    return (
        <div className="flex flex-col space-y-3">
            <Skeleton className="h-[125px] w-full rounded-xl" />
            <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
            </div>
        </div>
    )
  }
  
  const { id, name, price, image, images, favorites, status, condition, originalPrice } = product;
  
  const safeImage = images?.[0] || image || 'https://picsum.photos/600/400';
  const safeName = name || '無標題商品';
  
  const safeSellerName = seller?.displayName || product.sellerName || '匿名賣家';
  const sellerAvatar = seller?.photoURL || product.sellerAvatar;
  const isDiscounted = typeof originalPrice === 'number' && typeof price === 'number' && price < originalPrice;


  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg group flex flex-col border-none shadow-md bg-card">
        <div className="relative aspect-square w-full">
            <Link href={`/products/${id}`} aria-label={safeName}>
              <Image
                src={safeImage}
                alt={safeName}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                data-ai-hint="product image"
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                onError={(e) => { e.currentTarget.src = 'https://picsum.photos/600/400'; }}
              />
            </Link>
            <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
                {isDiscounted && (
                  <Badge className="text-xs px-2 py-0.5 font-semibold z-10 bg-destructive text-destructive-foreground">
                      特價中
                  </Badge>
                )}
                {status && (
                    <Badge
                        className={cn(
                        'text-xs px-2 py-0.5 font-semibold z-10',
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
                <span>{product.favorites || 0}</span>
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
        <CardContent className="p-3 space-y-2">
          <Link href={`/products/${id}`} aria-label={safeName} className="space-y-1">
            <h3 className="font-semibold truncate text-base">{safeName}</h3>
            
            <div className="flex justify-between items-center">
              <div className="flex items-baseline gap-2">
                 <p className={cn(
                    "text-lg font-bold",
                    isDiscounted ? "text-[hsl(var(--sale-price))]" : "text-primary"
                 )}>
                    ${(price || 0).toLocaleString()}
                </p>
                {isDiscounted && originalPrice && (
                  <p className="text-sm text-muted-foreground line-through">
                    ${originalPrice.toLocaleString()}
                  </p>
                )}
              </div>
              {condition && <div className="text-[10px] border border-muted-foreground/50 rounded-full px-1.5 py-0.5 text-muted-foreground">{condition}</div>}
            </div>
          </Link>

          <div className="flex justify-between items-center pt-1">
             <Link href={`/profile/${product.sellerId}`} className="flex items-center gap-2 min-w-0">
                <Avatar className="h-6 w-6">
                    <AvatarImage src={sellerAvatar || undefined} alt={safeSellerName} />
                    <AvatarFallback className="text-xs">{safeSellerName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground font-medium truncate">{safeSellerName}</span>
             </Link>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                <span className="font-bold text-xs text-foreground">
                  {(seller?.averageRating || 0).toFixed(1)}
                </span>
             </div>
          </div>

        </CardContent>
    </Card>
  );
}
