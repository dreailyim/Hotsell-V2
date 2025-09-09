'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Star, Heart, MessageSquare, User, Ticket, Search, Settings, Edit, Loader2 } from 'lucide-react';
import { ProductCard } from '@/components/product-card';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, where, getDoc, getDocs, onSnapshot, Timestamp, orderBy, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client-app';
import type { Product, Review, FullUser } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { zhHK } from 'date-fns/locale';
import Link from 'next/link';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';

function ProductGridSkeleton() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col space-y-3">
                    <Skeleton className="h-[125px] w-full rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function ProductGrid({ products, loading, emptyMessage }: { products: Product[], loading: boolean, emptyMessage: string }) {
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
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {products.map((product) => (
            <ProductCard key={product.id} product={product} />
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
  
  const [profileUser, setProfileUser] = useState<FullUser | null>(null);
  const [userProducts, setUserProducts] = useState<Product[]>([]);
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingUserProducts, setLoadingUserProducts] = useState(true);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  
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

  const fetchReviews = useCallback(async () => {
      if (!userId) return;
      setLoadingReviews(true);
      try {
          const reviewsRef = collection(db, 'reviews');
          const q = query(reviewsRef, where('ratedUserId', '==', userId), orderBy('createdAt', 'desc'));
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
  }, [userId]);


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
  
  // Fetch favorites or reviews only when the respective tab is active
  useEffect(() => {
    if (activeTab === 'reviews') {
        const unsubscribePromise = fetchReviews();
        return () => {
            unsubscribePromise?.then(unsub => unsub && unsub());
        }
    }
    if (activeTab === 'favorites' && isOwnProfile) {
        fetchFavoriteProducts();
    }
  }, [activeTab, isOwnProfile, fetchReviews, fetchFavoriteProducts]);

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
  
  return (
    <>
      <Header title={isOwnProfile ? "我的" : (profileUser.displayName || '用戶檔案')} showBackButton={!isOwnProfile} showSettingsButton={isOwnProfile} />
      <div className="container mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center gap-4 mb-6">
             <Avatar className="h-20 w-20">
                <AvatarImage src={profileUser.photoURL || undefined} alt={profileUser.displayName || '使用者頭像'} />
                <AvatarFallback>{profileUser.displayName?.charAt(0) || 'U'}</AvatarFallback>
             </Avatar>
             <div className="flex flex-col justify-center flex-1">
                <h2 className="text-lg font-bold">{profileUser.displayName || '使用者'}</h2>
                <p className="text-sm text-muted-foreground truncate">{profileUser.aboutMe || '未填寫個人簡介'}</p>
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
             </div>
             {isOwnProfile && (
                <Button asChild variant="outline" size="icon" className="rounded-full">
                  <Link href="/profile/settings">
                    <Edit className="h-4 w-4" />
                  </Link>
                </Button>
             )}
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
                        <Input placeholder="搵下我有啲咩產品先" className="pl-10 rounded-full" />
                    </div>
                    <Button variant="ghost" className="rounded-full">管理</Button>
                </div>
            )}
             <ProductGrid 
                products={userProducts} 
                loading={loadingUserProducts} 
                emptyMessage={isOwnProfile ? "您尚未刊登任何商品" : "此用戶尚未刊登任何商品"}
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
                        <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
                    ))}
                </div>
             ) : reviews.length === 0 ? (
                 <div className="text-center text-muted-foreground py-16">
                    <p>{isOwnProfile ? "您尚未收到任何評價" : "此用戶尚未收到任何評價"}</p>
                </div>
             ) : (
                <div className="space-y-4 max-w-2xl mx-auto">
                {reviews.map((review) => (
                    <Card key={review.id}>
                        <CardContent className="p-4 space-y-4">
                            <div className="flex gap-4">
                                <Avatar>
                                    <AvatarImage src={review.reviewerAvatar || undefined} alt={review.reviewerName || ''} />
                                    <AvatarFallback>{review.reviewerName?.charAt(0) || 'R'}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                    <p className="font-semibold">{review.reviewerName}</p>
                                    <p className="text-xs text-muted-foreground">{getFormattedTime(review.createdAt)}</p>
                                    </div>
                                    <div className="flex items-center gap-1 mt-1 text-yellow-400">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'fill-current' : ''}`} />
                                    ))}
                                    </div>
                                    <p className="text-sm mt-2">{review.comment}</p>
                                </div>
                            </div>
                            
                            {review.productName && review.productImage && (
                                <>
                                    <Separator />
                                    <Link href={`/products/${review.productId}`} className="flex items-center gap-3 p-2 -m-2 rounded-lg hover:bg-muted/50 transition-colors">
                                        <div className="relative h-12 w-12 flex-shrink-0">
                                            <Image 
                                                src={review.productImage} 
                                                alt={review.productName} 
                                                fill 
                                                className="object-cover rounded-md" 
                                                data-ai-hint="product image"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium truncate">{review.productName}</p>
                                            {typeof review.transactionPrice === 'number' && (
                                                <p className="text-xs text-muted-foreground">成交價: <span className="font-semibold text-primary">${review.transactionPrice.toLocaleString()}</span></p>
                                            )}
                                        </div>
                                    </Link>
                                </>
                            )}
                        </CardContent>
                    </Card>
                ))}
                </div>
             )}
          </TabsContent>
          <TabsContent value="about">
             <div className="max-w-2xl mx-auto text-center py-8">
              <p className="text-muted-foreground whitespace-pre-wrap">{profileUser.aboutMe || (isOwnProfile ? '您沒有留下任何關於我的資訊。' : '此用戶沒有留下任何關於我的資訊。')}</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
