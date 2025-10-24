
'use client';

import { Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel';
import Link from 'next/link';
import { useTranslation } from '@/hooks/use-translation';
import { Header } from '@/components/layout/header';
import { ProductCard } from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client-app';
import type { Product } from '@/lib/types';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

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

function SearchResults({ searchTerm }: { searchTerm: string }) {
    const { t } = useTranslation();
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            const productsRef = collection(db, 'products');
            const q = query(
                productsRef,
                where('name_lowercase', '>=', searchTerm.toLowerCase()),
                where('name_lowercase', '<=', searchTerm.toLowerCase() + '\uf8ff'),
                orderBy('name_lowercase'),
                limit(20)
            );
            const querySnapshot = await getDocs(q);
            const productsData = querySnapshot.docs.map(doc => {
                const data = doc.data();
                if (data.visibility === 'hidden') return null;
                return {
                    id: doc.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
                } as Product;
            }).filter((p): p is Product => p !== null);
            setProducts(productsData);
            setLoading(false);
        };

        if (searchTerm) {
            fetchProducts();
        } else {
            setProducts([]);
            setLoading(false);
        }
    }, [searchTerm]);

    if (loading) {
        return <ProductGridSkeleton />;
    }
    
    if (products.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-16">
                <p className="text-lg font-semibold">{t('home.no_results_for').replace('{searchTerm}', searchTerm)}</p>
                <p>{t('home.try_other_keywords')}</p>
            </div>
        );
    }

    return (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-2 md:gap-4 lg:gap-6">
            {products.map(product => (
                <div key={product.id} className="mb-4 break-inside-avoid">
                    <ProductCard product={product} />
                </div>
            ))}
        </div>
    );
}


function LatestItems() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const productsRef = collection(db, 'products');
      const q = query(
        productsRef,
        where('visibility', '==', 'public'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const querySnapshot = await getDocs(q);
      const productsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        } as Product;
      });
      setProducts(productsData);
      setLoading(false);
    };

    fetchProducts();
  }, []);

  return (
    <section>
      <h2 className="text-2xl font-bold mb-4">{t('home.latest_products')}</h2>
      {loading ? (
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
    </section>
  );
}

const banners = [
  {
    titleKey: "home_banner_title",
    descriptionKey: "home_banner_description",
    href: "/list"
  }
];

export default function HomePage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchTerm = searchParams.get('q') || '';
  const { user } = useAuth();
  
  return (
    <>
      <Header showSearch showUserAvatar />
      <main className="container mx-auto px-4 md:px-6 py-6 space-y-8">
        {!searchTerm && (
          <Carousel
            className="w-full"
            opts={{
              loop: true,
            }}
          >
            <CarouselContent>
              {banners.map((banner, index) => (
                 <CarouselItem key={index}>
                  <div className="relative w-full h-48 md:h-64 lg:h-80 overflow-hidden rounded-2xl bg-gradient-to-tr from-primary/80 via-primary to-orange-500/80 p-8 flex items-center justify-center">
                    <Flame className="absolute text-white/10 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] animate-pulse" />
                    <div className="relative text-center text-primary-foreground z-10">
                      <h2 className="text-5xl font-extrabold tracking-tighter [text-shadow:_0_3px_5px_rgb(0_0_0_/_30%)]">{t(banner.titleKey as any)}</h2>
                      <p className="mt-2 text-lg font-medium [text-shadow:_0_2px_3px_rgb(0_0_0_/_30%)]">{t(banner.descriptionKey as any)}</p>
                      <Button asChild className="mt-6 rounded-full bg-background text-primary hover:bg-background/90 font-bold">
                        <Link href={banner.href}>{t('nav.list')}</Link>
                      </Button>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        )}
        
        {searchTerm ? (
            <section>
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">{t('home.search_results')}</h2>
                    <Button variant="link" onClick={() => router.push('/')}>{t('home.clear_search')}</Button>
                </div>
                <SearchResults searchTerm={searchTerm} />
            </section>
        ) : (
            <LatestItems />
        )}
      </main>
    </>
  );
}
