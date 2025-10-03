
'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client-app';
import type { Product } from '@/lib/types';
import { Header } from '@/components/layout/header';
import { ProductCard } from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Flame } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';

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


export default function HotPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const fetchHotProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const productsRef = collection(db, 'products');
        const q = query(productsRef, orderBy('favorites', 'desc'), limit(20));
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
      } catch (err) {
        console.error("Error fetching hot products: ", err);
        setError(t('hot.error'));
      } finally {
        setLoading(false);
      }
    };
    fetchHotProducts();
  }, [t]);

  return (
    <>
      <Header title={t('header.title.hot')} showUserAvatar />
      <main className="container mx-auto px-4 md:px-6 py-6">
        {loading ? (
          <ProductGridSkeleton />
        ) : error ? (
            <div className="text-center text-destructive py-16">
                <p>{error}</p>
            </div>
        ) : products.length === 0 ? (
          <div className="text-center text-muted-foreground py-16 flex flex-col items-center gap-4">
             <Flame className="h-16 w-16 text-muted-foreground/50" />
             <p className="font-semibold text-lg">{t('hot.no_products_title')}</p>
             <p>{t('hot.no_products_description')}</p>
          </div>
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
}
