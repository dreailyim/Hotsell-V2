
'use client';

import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Star, Heart, MessageSquare, User, Ticket, Search, Settings, Edit, Loader2, PackageCheck, Trash2, CheckCircle2, Circle, DatabaseZap, ShieldCheck, CalendarDays, BadgeCheck, ShoppingBag, Trophy, Share2, ShieldAlert } from 'lucide-react';
import { ProductCard } from '@/components/product-card';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, where, getDoc, getDocs, onSnapshot, Timestamp, orderBy, doc, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client-app';
import type { Product, Review, FullUser } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { zhHK } from 'date-fns/locale';
import Link from 'next/link';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
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
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

function ProductGridSkeleton() {
    return (
        <div className="columns-2 md:columns-2 lg:columns-3 gap-2 md:gap-4 lg:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="mb-4 break-inside-avoid">
                    <div className="flex flex-col space-y-3">
                        <Skeleton className="h-[125px] w-full rounded-xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function ProductGrid({ 
    products, 
    loading, 
    emptyMessage,
    isManaging,
    selectedProducts,
    onToggleSelect,
}: { 
    products: Product[], 
    loading: boolean, 
    emptyMessage: string,
    isManaging?: boolean;
    selectedProducts?: Set<string>;
    onToggleSelect?: (id: string) => void;
}) {
    if (loading) {
      return <ProductGridSkeleton />;
    }
    if (products.length === 0) {
        return (
             <div className="text-center text-muted-foreground py-16">
                <p>{emptyMessage}</p>
             </div>
        )
    }
    return (
        <div className="columns-2 md:columns-2 lg:columns-3 gap-2 md:gap-4 lg:gap-6">
            {products.map((product) => (
                <div key={product.id} className="relative mb-4 break-inside-avoid" onClick={() => isManaging && onToggleSelect?.(product.id)}>
                    <ProductCard product={product} />
                    {isManaging && (
                        <div className="absolute inset-0 bg-black/30 rounded-lg flex items-center justify-center cursor-pointer">
                           {selectedProducts?.has(product.id) ? (
                                <CheckCircle2 className="h-8 w-8 text-white bg-primary rounded-full" />
                            ) : (
                                <Circle className="h-8 w-8 text-white/70" />
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}

const tabItems = [
    { value: 'products', icon: Ticket, label: '產品' },
    { value: 'reviews', icon: MessageSquare, label: '評價' },
    { value: 'about', icon: User, label: '關於我' },
];

const ownProfileTabItems = [
    { value: 'products', icon: Ticket, label: '產品' },
    { value: 'favorites', icon: Heart, label: '最愛' },
    { value: 'reviews', icon: MessageSquare, label: '評價' },
    { value: 'about', icon: User, label: '關於我' },
];

// Dedicated component to manage the indicator's state and animation.
// This is more robust as its effect is directly tied to the presence of the tabsListRef.
function TabIndicator({ tabsListRef, activeTab }: { tabsListRef: React.RefObject<HTMLDivElement>, activeTab: string }) {
    const [indicatorStyle, setIndicatorStyle] = useState({
      left: '0px',
      width: '0px',
      opacity: 0,
    });
  
    const updateIndicator = useCallback(() => {
        if (tabsListRef.current) {
          const activeTabNode = tabsListRef.current.querySelector<HTMLButtonElement>(`[data-state="active"]`);
          if (activeTabNode) {
            setIndicatorStyle({
              left: `${activeTabNode.offsetLeft}px`,
              width: `${activeTabNode.offsetWidth}px`,
              opacity: 1,
            });
          }
        }
    }, [tabsListRef]);


    useEffect(() => {
      // Run the update on mount and whenever the active tab or the ref changes.
      // A small timeout helps ensure the DOM has painted.
      const timeoutId = setTimeout(updateIndicator, 100);
      
      window.addEventListener('resize', updateIndicator);
      
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('resize', updateIndicator);
      };
    }, [activeTab, updateIndicator]);
  
    return (
      <div
        className="absolute h-full rounded-full bg-gradient-to-br from-orange-500 to-red-600 transition-all duration-300 ease-in-out"
        style={indicatorStyle}
      />
    );
}


export default function UserProfilePage() {
  const { user: currentUser } = useAuth();
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const { toast } = useToast();
  
  const [profileUser, setProfileUser] = useState<FullUser | null>(null);
  const [userProducts, setUserProducts] = useState<Product[]>([]);
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsAsBuyer, setReviewsAsBuyer] = useState<Review[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingUserProducts, setLoadingUserProducts] = useState(true);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [loadingReviewsAsBuyer, setLoadingReviewsAsBuyer] = useState(true);

  const [isManaging, setIsManaging] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isProcessing, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState('');
  
  const isOwnProfile = currentUser?.uid === userId;
  
  const currentTabItems = useMemo(() => {
    return isOwnProfile ? ownProfileTabItems : tabItems;
  }, [isOwnProfile]);

  const [activeTab, setActiveTab] = useState('products');
  const tabsListRef = useRef<HTMLDivElement>(null);


  // Effect to set active tab from URL param (if any) once, on mount.
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        const tab = searchParams.get('tab');
        if (tab && currentTabItems.some(t => t.value === tab)) {
            setActiveTab(tab);
        }
    }
  }, [currentTabItems]);


  useEffect(() => {
    if (!userId) return;

    setLoadingProfile(true);
    const userDocRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            setProfileUser(docSnap.data() as FullUser);
        } else {
            console.error("User not found!");
            setProfileUser(null);
        }
        setLoadingProfile(false);
    }, (error) => {
        console.error("Error fetching user profile:", error);
        setLoadingProfile(false);
    });

    return () => unsubscribe();
  }, [userId]);


  const getFormattedTime = (timestamp: Review['createdAt']) => {
    if (!timestamp) return '';
    try {
      const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true, locale: zhHK });
    } catch (error) {
      console.error("Error formatting date:", error, "with value:", timestamp);
      return '';
    }
  };

  const getFormattedDate = (timestamp: FullUser['createdAt'] | undefined) => {
    if (!timestamp || typeof timestamp !== 'string') return '未知';
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return '未知';
        }
        return format(date, 'yyyy年M月d日');
    } catch (error) {
        console.error("Error formatting date:", error);
        return '日期無效';
    }
}

  const fetchFavoriteProducts = useCallback(async () => {
    if (!userId) return;
     setLoadingFavorites(true);
      try {
        const productsRef = collection(db, 'products');
        const q = query(productsRef, where('favoritedBy', 'array-contains', userId));
        const querySnapshot = await getDocs(q);
        const productsData = querySnapshot.docs.map(doc => {
            const data = doc.data();
            const createdAt = data.createdAt instanceof Timestamp 
            ? data.createdAt.toDate().toISOString() 
            : new Date().toISOString();

            return {
            id: doc.id,
            ...data,
            createdAt,
            } as Product;
        });
        setFavoriteProducts(productsData);
    } catch (error) {
         console.error("Error fetching favorite products:", error);
    } finally {
        setLoadingFavorites(false);
    }
  }, [userId]);

  const fetchReviews = useCallback(async (ratedUserId: string) => {
      setLoadingReviews(true);
      try {
          const reviewsRef = collection(db, 'reviews');
          const q = query(reviewsRef, where('ratedUserId', '==', ratedUserId), orderBy('createdAt', 'desc'));
          const unsubscribe = onSnapshot(q, (snapshot) => {
              const reviewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
              setReviews(reviewsData);
              setLoadingReviews(false);
          });
          return unsubscribe;
      } catch (error) {
          console.error("Error fetching reviews:", error);
          setLoadingReviews(false);
      }
  }, []);

  const fetchReviewsAsBuyer = useCallback(async (reviewerId: string) => {
    setLoadingReviewsAsBuyer(true);
    try {
        const reviewsRef = collection(db, 'reviews');
        const q = query(reviewsRef, where('reviewerId', '==', reviewerId), where('reviewerRole', '==', 'buyer'));
        const querySnapshot = await getDocs(q);
        const reviewsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
        setReviewsAsBuyer(reviewsData);
    } catch (error) {
        console.error("Error fetching reviews as buyer:", error);
    } finally {
        setLoadingReviewsAsBuyer(false);
    }
  }, []);


  // Fetch user's own products
  useEffect(() => {
    if (!userId) return;
    
    setLoadingUserProducts(true);
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('sellerId', '==', userId), orderBy('createdAt', 'desc'));

    const unsubscribeProducts = onSnapshot(q, (querySnapshot) => {
      const productsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const createdAt = data.createdAt instanceof Timestamp 
          ? data.createdAt.toDate().toISOString() 
          : new Date().toISOString();

        return {
          id: doc.id,
          ...data,
          createdAt,
        } as Product;
      });
      setUserProducts(productsData);
      setLoadingUserProducts(false);
    }, (error) => {
        console.error("Error fetching user products:", error);
        setLoadingUserProducts(false);
    });
    
    return () => unsubscribeProducts();
  }, [userId]);
  
  // Fetch data based on active tab
  useEffect(() => {
    if (!userId) return;
    let unsubscribe: (() => void) | undefined;
  
    if (activeTab === 'reviews') {
      fetchReviews(userId).then(unsub => unsubscribe = unsub);
    }
    if (activeTab === 'favorites' && isOwnProfile) {
      fetchFavoriteProducts();
    }
    if (activeTab === 'about') {
      fetchReviewsAsBuyer(userId);
    }
  
    return () => {
      unsubscribe && unsubscribe();
    };
  }, [activeTab, isOwnProfile, userId, fetchReviews, fetchFavoriteProducts, fetchReviewsAsBuyer]);

  const filteredUserProducts = useMemo(() => {
    if (!searchTerm) {
      return userProducts;
    }
    return userProducts.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [userProducts, searchTerm]);

  // --- Derived data for 'About' tab ---
  const soldCount = useMemo(() => {
    return userProducts.filter(p => p.status === 'sold').length;
  }, [userProducts]);

  const reviewsGivenCount = useMemo(() => {
      return reviewsAsBuyer.length;
  }, [reviewsAsBuyer]);

  const getCreditRating = (rating?: number, reviewCount?: number): { label: string; icon: React.ElementType; color: string } => {
    const safeRating = rating || 0;
    const safeReviewCount = reviewCount || 0;
    if (safeReviewCount === 0) return { label: '新用戶', icon: ShieldCheck, color: 'text-gray-500' };
    if (safeRating >= 4.8 && safeReviewCount >= 20) return { label: '頂級賣家', icon: Trophy, color: 'text-amber-400' };
    if (safeRating >= 4.5 && safeReviewCount >= 5) return { label: '優秀', icon: BadgeCheck, color: 'text-blue-500' };
    if (safeRating >= 4.0) return { label: '良好', icon: BadgeCheck, color: 'text-green-500' };
    return { label: '普通', icon: ShieldCheck, color: 'text-gray-500' };
  };
  const creditRating = getCreditRating(profileUser?.averageRating, profileUser?.reviewCount);

  // --- Management Mode Handlers ---
  const handleToggleSelection = (productId: string) => {
    setSelectedProducts(prev => {
        const newSet = new Set(prev);
        if (newSet.has(productId)) {
            newSet.delete(productId);
        } else {
            newSet.add(productId);
        }
        return newSet;
    });
  };

  const handleSelectAll = () => {
    const productsToSelect = filteredUserProducts;
    if (selectedProducts.size === productsToSelect.length) {
        setSelectedProducts(new Set());
    } else {
        setSelectedProducts(new Set(productsToSelect.map(p => p.id)));
    }
  };
  
  const handleBulkAction = (action: 'sold' | 'delete') => {
    if (selectedProducts.size === 0) return;

    startTransition(async () => {
        const batch = writeBatch(db);
        const productIds = Array.from(selectedProducts);

        try {
            if (action === 'sold') {
                productIds.forEach(id => {
                    const productRef = doc(db, 'products', id);
                    batch.update(productRef, { status: 'sold' });
                });
                await batch.commit();
                toast({ title: `已將 ${productIds.length} 件產品標示為已售出` });
            } else if (action === 'delete') {
                 productIds.forEach(id => {
                    const productRef = doc(db, 'products', id);
                    batch.delete(productRef);
                });
                await batch.commit();
                toast({ title: `已成功刪除 ${productIds.length} 件產品` });
            }
            
            // Exit management mode and clear selection
            setIsManaging(false);
            setSelectedProducts(new Set());

        } catch (error: any) {
            console.error(`Error performing bulk ${action}:`, error);
            toast({ title: '操作失敗', description: error.message, variant: 'destructive' });
        }
    });
  };

  const handleBackfillSearchData = () => {
    if (!currentUser || !isOwnProfile) return;

    startTransition(async () => {
        toast({ title: "開始更新產品數據...", description: "這可能需要幾秒鐘，請稍候。" });
        const productsRef = collection(db, 'products');
        const q = query(productsRef, where('sellerId', '==', currentUser.uid));
        
        try {
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                toast({ title: "沒有需要更新的產品" });
                return;
            }

            const batch = writeBatch(db);
            let updatedCount = 0;

            querySnapshot.forEach(productDoc => {
                const productData = productDoc.data() as Product;
                // Only update if the field is missing
                if (productData.name && !productData.name_lowercase) {
                    batch.update(productDoc.ref, { name_lowercase: productData.name.toLowerCase() });
                    updatedCount++;
                }
            });

            if (updatedCount > 0) {
                await batch.commit();
                toast({ title: "更新成功！", description: `已成功為 ${updatedCount} 件產品啟用搜尋功能。`, className: "bg-green-100 dark:bg-green-800" });
            } else {
                toast({ title: "無需更新", description: "您所有的產品都已經支援搜尋功能了。" });
            }

        } catch (error: any) {
            console.error("Error backfilling product data:", error);
            toast({ title: "更新失敗", description: error.message, variant: 'destructive' });
        }
    });
  };


  if (loadingProfile) {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    )
  }

  if (!profileUser) {
     return (
        <div className="flex min-h-screen items-center justify-center text-center">
            <div>
                 <h1 className="text-2xl font-bold">找不到用戶</h1>
                 <p className="text-muted-foreground">此用戶可能不存在。</p>
            </div>
        </div>
    )
  }

   const ManagementFooter = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-white/10 z-50 md:hidden">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <Button variant="ghost" onClick={handleSelectAll} className="rounded-full">
            {selectedProducts.size === filteredUserProducts.length ? '取消全選' : '全選'}
        </Button>
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                className="rounded-full"
                onClick={() => handleBulkAction('sold')}
                disabled={isProcessing || selectedProducts.size === 0}
            >
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                已售出 ({selectedProducts.size})
            </Button>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button
                        variant="destructive"
                        className="rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity"
                        disabled={isProcessing || selectedProducts.size === 0}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        刪除 ({selectedProducts.size})
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>確定要刪除嗎？</AlertDialogTitle>
                        <AlertDialogDescription>
                            此操作無法復原，將會永久刪除您選取的 ${selectedProducts.size} 件產品。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => handleBulkAction('delete')}
                            className="bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity"
                        >
                            確認刪除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
      </div>
    </div>
  );
  
  return (
    <>
      <Header title={isOwnProfile ? "我的" : (profileUser.displayName || '用戶檔案')} showBackButton={!isOwnProfile} showSettingsButton={isOwnProfile} />
      <div className={cn("container mx-auto px-4 md:px-6 py-4", isManaging && 'pb-24')}>
        
        <div className="mb-4">
            <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                    <Avatar className="h-14 w-14 flex-shrink-0">
                        <AvatarImage src={profileUser.photoURL || undefined} alt={profileUser.displayName || '使用者頭像'} />
                        <AvatarFallback>{profileUser.displayName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h2 className="text-base font-bold">{profileUser.displayName || '使用者'}</h2>
                        <div className="flex items-center gap-1 mt-1">
                            <div className="flex items-center text-yellow-400">
                                {Array.from({ length: 5 }).map((_, i) => (
                                <Star 
                                    key={i} 
                                    className={cn(
                                        "h-4 w-4", 
                                        (profileUser.averageRating || 0) > i ? 'fill-current' : 'text-gray-300 dark:text-gray-600'
                                    )} 
                                />
                                ))}
                            </div>
                            <span className="text-xs font-bold">{(profileUser.averageRating || 0).toFixed(1)}</span>
                            <span className="text-xs text-muted-foreground">({profileUser.reviewCount || 0})</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{profileUser.aboutMe || '未填寫個人簡介'}</p>
                    </div>
                </div>
                 {!isOwnProfile && (
                    <div className="flex flex-col items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full bg-muted/50"
                            onClick={() => toast({ title: '已複製用戶檔案連結！' })}
                        >
                            <Share2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full bg-muted/50"
                            onClick={() => toast({ title: '感謝您的舉報，我們會盡快處理。' })}
                        >
                            <ShieldAlert className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                )}
            </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-center mb-6">
            <div className="relative rounded-full bg-muted/50 p-2 backdrop-blur-sm shadow-inner">
                <TabsList className="relative inline-flex h-auto p-0 bg-transparent" ref={tabsListRef}>
                    <TabIndicator tabsListRef={tabsListRef} activeTab={activeTab} />
                    {currentTabItems.map((item) => (
                        <TabsTrigger
                            key={item.value}
                            value={item.value}
                            className="relative z-10 h-14 w-14 flex flex-col items-center justify-center gap-1 rounded-full text-xs font-medium data-[state=active]:bg-transparent data-[state=active]:text-primary-foreground dark:data-[state=active]:text-black"
                        >
                            <item.icon className="h-5 w-5" />
                            <span>{item.label}</span>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </div>
          </div>
          
          <TabsContent value="products">
            {isOwnProfile && (
                <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="搵下我有啲咩產品先" 
                            className="pl-10 rounded-full h-9 text-sm" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="ghost" className="rounded-full" onClick={() => { setIsManaging(!isManaging); setSelectedProducts(new Set()); }}>
                        {isManaging ? '取消' : '管理'}
                    </Button>
                </div>
            )}
             <ProductGrid 
                products={filteredUserProducts} 
                loading={loadingUserProducts} 
                emptyMessage={searchTerm ? `找不到關於「${searchTerm}」的產品` : (isOwnProfile ? "您尚未刊登任何商品" : "此用戶尚未刊登任何商品")}
                isManaging={isManaging}
                selectedProducts={selectedProducts}
                onToggleSelect={handleToggleSelection}
            />
          </TabsContent>
          
          {isOwnProfile && (
              <TabsContent value="favorites">
                 <ProductGrid 
                    products={favoriteProducts} 
                    loading={loadingFavorites} 
                    emptyMessage="您尚未收藏任何商品"
                />
              </TabsContent>
          )}

          <TabsContent value="reviews">
             {loadingReviews ? (
                <div className="space-y-4 max-w-2xl mx-auto">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="p-px rounded-xl border-gradient-effect"><div className="relative rounded-xl bg-background/30 backdrop-blur-sm shadow-xl p-4"><Skeleton className="h-24 w-full" /></div></div>
                    ))}
                </div>
             ) : reviews.length === 0 ? (
                 <div className="text-center text-muted-foreground py-16">
                    <p>{isOwnProfile ? "您尚未收到任何評價" : "此用戶尚未收到任何評價"}</p>
                </div>
             ) : (
                <div className="space-y-4 max-w-2xl mx-auto">
                {reviews.map((review) => (
                    <div key={review.id} className="p-px rounded-xl border-gradient-effect">
                        <div className="relative rounded-xl bg-background/30 backdrop-blur-sm shadow-xl p-4">
                            <div className="flex items-start gap-3">
                                <Avatar className="h-10 w-10 flex-shrink-0">
                                    <AvatarImage src={review.reviewerAvatar || undefined} alt={review.reviewerName || ''} />
                                    <AvatarFallback className="text-xs">{review.reviewerName?.charAt(0) || 'R'}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">{review.reviewerName}</span>
                                        {review.reviewerRole && (
                                            <Badge variant={review.reviewerRole === 'buyer' ? 'default' : 'outline'} className="px-1.5 py-0 text-[10px] h-4">
                                                {review.reviewerRole === 'buyer' ? '買家' : '賣家'}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5 text-yellow-400">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <Star key={i} className={cn("h-3 w-3", i < review.rating ? 'fill-current' : 'text-muted-foreground/30')} />
                                        ))}
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground flex-shrink-0">{getFormattedTime(review.createdAt)}</p>
                            </div>
                            <p className="text-sm mt-3 ml-13">{review.comment}</p>
                            
                            {review.productName && review.productImage && (
                                <Link href={`/products/${review.productId}`} className="mt-3 ml-13 flex items-center gap-3 p-2 -m-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                    <div className="relative h-10 w-10 flex-shrink-0">
                                        <Image 
                                            src={review.productImage} 
                                            alt={review.productName}
                                            fill 
                                            className="object-cover rounded-md" 
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-medium truncate">{review.productName}</p>
                                        {typeof review.transactionPrice === 'number' && (
                                            <p className="text-xs text-muted-foreground">成交價: <span className="font-semibold text-primary">${review.transactionPrice.toLocaleString()}</span></p>
                                        )}
                                    </div>
                                </Link>
                            )}
                        </div>
                    </div>
                ))}
                </div>
             )}
          </TabsContent>
          <TabsContent value="about">
             <div className="max-w-2xl mx-auto space-y-6 text-center py-8">
                <Card>
                    <CardContent className="p-4 space-y-4">
                       <div className="grid grid-cols-2 gap-4 text-center">
                          <div className="space-y-1">
                             <creditRating.icon className={cn("mx-auto h-7 w-7", creditRating.color)} />
                             <p className="text-xs text-muted-foreground">信用評級</p>
                             <p className="font-semibold text-sm">{creditRating.label}</p>
                          </div>
                           <div className="space-y-1">
                             <CalendarDays className="mx-auto h-7 w-7 text-muted-foreground" />
                             <p className="text-xs text-muted-foreground">加入日期</p>
                             <p className="font-semibold text-sm">{getFormattedDate(profileUser.createdAt)}</p>
                          </div>
                       </div>
                       <Separator />
                       <div className="grid grid-cols-2 gap-4 text-center">
                           <div className="space-y-1">
                             <PackageCheck className="mx-auto h-7 w-7 text-muted-foreground" />
                             <p className="text-xs text-muted-foreground">成功售出</p>
                             <p className="font-semibold text-sm">{loadingUserProducts ? <Loader2 className="h-5 w-5 mx-auto animate-spin" /> : `${soldCount} 件`}</p>
                          </div>
                           <div className="space-y-1">
                             <ShoppingBag className="mx-auto h-7 w-7 text-muted-foreground" />
                             <p className="text-xs text-muted-foreground">給出好評</p>
                             <p className="font-semibold text-sm">{loadingReviewsAsBuyer ? <Loader2 className="h-5 w-5 mx-auto animate-spin" /> : `${reviewsGivenCount} 次`}</p>
                          </div>
                       </div>
                        <Separator />
                        <div className="space-y-2 p-2 text-center">
                            <p className="text-xs text-muted-foreground">個人簡介</p>
                            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{profileUser.aboutMe || (isOwnProfile ? '您沒有留下任何關於我的資訊。' : '此用戶沒有留下任何關於我的資訊。')}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      {isOwnProfile && isManaging && <ManagementFooter />}
    </>
  );
}
