
'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { collection, query, getDocs, orderBy, limit, where, startAt, endAt, writeBatch, Timestamp, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client-app';
import type { Product } from '@/lib/types';
import { Header } from '@/components/layout/header';
import { ProductCard } from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Define the type for a banner
type Banner = {
  id: string;
  src: string;
  alt: string;
  title: string;
  description: string;
  href: string;
  dataAiHint: string;
  createdAt: Timestamp;
};


function ProductGridSkeleton() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-start">
            {Array.from({ length: 8 }).map((_, i) => (
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

function HomePageContent() {
  const searchParams = useSearchParams();
  const searchTerm = searchParams.get('q');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loadingBanners, setLoadingBanners] = useState(true);

  const plugin = useRef(
    Autoplay({ delay: 3000, stopOnInteraction: true })
  );

  // --- Seed initial banners if the collection is empty ---
  const seedBanners = async () => {
      const bannersRef = collection(db, 'banners');
      const q = query(bannersRef, limit(1));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
          console.log("Banners collection is empty. Seeding initial data...");
          const batch = writeBatch(db);
          const defaultBanners = [
              { src: "https://picsum.photos/seed/ad1/1200/400", alt: "Special promotion on electronics", title: "電子產品特賣", description: "相機、手機、筆電，應有盡有！", dataAiHint: "electronics sale", href: "/hot" },
              { src: "https://picsum.photos/seed/ad2/1200/400", alt: "New fashion arrivals", title: "時尚新品到著", description: "換季大減價，立即選購！", dataAiHint: "fashion clothes", href: "/" },
              { src: "https://picsum.photos/seed/ad3/1200/400", alt: "Home goods clearance", title: "家居好物清貨", description: "為您的家增添一份溫馨。", dataAiHint: "home decor", href: "/" },
          ];

          defaultBanners.forEach(banner => {
              const docRef = doc(collection(db, 'banners'));
              batch.set(docRef, { ...banner, createdAt: Timestamp.now() });
          });

          await batch.commit();
          console.log("Default banners have been seeded.");
          return true; // Indicates that seeding happened
      }
      return false; // Seeding was not needed
  };

  // --- Fetch Banners from Firestore ---
  useEffect(() => {
    const fetchBanners = async () => {
        setLoadingBanners(true);
        try {
            await seedBanners();
            const bannersRef = collection(db, 'banners');
            const q = query(bannersRef, orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const bannersData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Banner));
            setBanners(bannersData);
        } catch (error) {
            console.error("Error fetching banners: ", error);
        } finally {
            setLoadingBanners(false);
        }
    };
    fetchBanners();
  }, []);

  // --- Fetch Products ---
  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const productsRef = collection(db, 'products');
        let q;

        if (searchTerm) {
          const searchTermLower = searchTerm.toLowerCase();
          q = query(productsRef, 
              orderBy('name_lowercase'), 
              startAt(searchTermLower), 
              endAt(searchTermLower + '\uf8ff')
          );
        } else {
          q = query(productsRef, orderBy('createdAt', 'desc'), limit(20));
        }

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
        setProducts(productsData);
      } catch (error) {
        console.error("Error fetching products: ", error);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProducts();
  }, [searchTerm]);

  const renderSearchResults = () => (
     <main className="container mx-auto px-4 md:px-6 py-4">
       <div className="flex justify-between items-center mb-4">
         <h2 className="text-xl font-bold">搜尋結果</h2>
         <Button variant="link" asChild>
            <Link href="/">清除搜尋</Link>
         </Button>
       </div>
        {loadingProducts ? (
          <ProductGridSkeleton />
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-start">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-16 flex flex-col items-center gap-4">
            <Search className="h-16 w-16 text-muted-foreground/50" />
            <p className="font-semibold text-lg">找不到「{searchTerm}」的相關商品</p>
            <p>試試其他關鍵字吧！</p>
          </div>
        )}
      </main>
  );

  const renderDefaultView = () => (
    <>
        <div className="container mx-auto px-4 md:px-6 py-3">
        {loadingBanners ? (
            <Skeleton className="w-full aspect-[3/1] rounded-lg" />
        ) : (
            <Carousel 
                plugins={[plugin.current]}
                className="w-full"
                onMouseEnter={plugin.current.stop}
                onMouseLeave={plugin.current.reset}
                >
                <CarouselContent>
                    {banners.map((banner) => (
                    <CarouselItem key={banner.id}>
                        <Link href={banner.href || '#'} passHref>
                          <div className="p-1 cursor-pointer">
                          <Card className="overflow-hidden">
                              <CardContent className="relative flex aspect-[3/1] items-center justify-center p-0">
                                  <Image 
                                      src={banner.src}
                                      alt={banner.alt}
                                      fill
                                      className="object-cover"
                                      data-ai-hint={banner.dataAiHint}
                                  />
                                  <div className="absolute inset-0 bg-black/50 flex flex-col justify-center items-center text-white p-4 text-center">
                                      <h2 className="text-xl md:text-3xl font-bold">{banner.title}</h2>
                                      <p className="text-sm md:text-lg mt-2">{banner.description}</p>
                                  </div>
                              </CardContent>
                          </Card>
                          </div>
                        </Link>
                    </CarouselItem>
                    ))}
                </CarouselContent>
                {banners.length > 1 && (
                    <>
                        <CarouselPrevious className="absolute left-4 hidden sm:flex" />
                        <CarouselNext className="absolute right-4 hidden sm:flex" />
                    </>
                )}
            </Carousel>
        )}
      </div>
       <main className="container mx-auto px-4 md:px-6 py-3">
        <h2 className="text-xl font-bold mb-4">最新上架</h2>
        {loadingProducts ? (
          <ProductGridSkeleton />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-start">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
    </>
  );

  return (
    <>
      <Header showSearch showUserAvatar />
      {searchTerm ? renderSearchResults() : renderDefaultView()}
    </>
  );
}


export default function HomePage() {
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <HomePageContent />
    </Suspense>
  )
}
