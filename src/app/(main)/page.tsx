
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
import { useTranslation } from '@/hooks/use-translation';
import { useAuth } from '@/hooks/use-auth';

// Define the type for a banner
type Banner = {
  id: string;
  src: string;
  alt: string;
  titleKey: 'home.banner.main.title';
  descriptionKey: 'home.banner.main.description';
  href: string;
  dataAiHint: string;
  createdAt: Timestamp;
};


function ProductGridSkeleton() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4 lg:gap-6 items-start">
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
  const { t } = useTranslation();
  const { user } = useAuth();
  
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
              { 
                src: "https://picsum.photos/seed/hotsell-freedom/1200/400", 
                alt: "HotSell - Realize the freedom of buying and selling", 
                titleKey: "home.banner.main.title", 
                descriptionKey: "home.banner.main.description", 
                dataAiHint: "market freedom", 
                href: "/list" 
              },
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
              where('name_lowercase', '>=', searchTermLower),
              where('name_lowercase', '<=', searchTermLower + '\uf8ff')
          );
        } else {
          q = query(productsRef, orderBy('createdAt', 'desc'), limit(20));
        }

        const querySnapshot = await getDocs(q);
        const productsData = querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Client-side filtering for visibility
            if (data.visibility === 'hidden') {
                return null;
            }
            const createdAt = data.createdAt instanceof Timestamp 
                ? data.createdAt.toDate().toISOString() 
                : new Date().toISOString();
            
            return {
                id: doc.id,
                ...data,
                createdAt,
            } as Product;
        }).filter((p): p is Product => p !== null);

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
         <h2 className="text-xl font-bold">{t('home.search_results')}</h2>
         <Button variant="link" asChild>
            <Link href="/">{t('home.clear_search')}</Link>
         </Button>
       </div>
        {loadingProducts ? (
          <ProductGridSkeleton />
        ) : products.length > 0 ? (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-2 md:gap-4 lg:gap-6">
            {products.map(product => (
              <div key={product.id} className="mb-4 break-inside-avoid">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-16 flex flex-col items-center gap-4">
            <Search className="h-16 w-16 text-muted-foreground/50" />
            <p className="font-semibold text-lg">{t('home.no_results_for').replace('{searchTerm}', searchTerm || '')}</p>
            <p>{t('home.try_other_keywords')}</p>
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
                                      <h2 className="text-xl md:text-3xl font-bold">{t(banner.titleKey as any)}</h2>
                                      <p className="text-sm md:text-lg mt-2">{t(banner.descriptionKey as any)}</p>
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
        <h2 className="text-xl font-bold mb-4">{t('home.latest_products')}</h2>
        {loadingProducts ? (
          <ProductGridSkeleton />
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-2 md:gap-4 lg:gap-6">
            {products.map(product => (
              <div key={product.id} className="mb-4 break-inside-avoid">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );

  return (
    <>
      <Header showSearch showUserAvatar={!!user} />
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
