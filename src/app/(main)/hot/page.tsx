
'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client-app';
import type { Product } from '@/lib/types';
import { Header } from '@/components/layout/header';
import { ProductCard } from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Flame } from 'lucide-react';

function ProductGridSkeleton() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
        setError("無法載入熱賣商品，請稍後再試。");
      } finally {
        setLoading(false);
      }
    };
    fetchHotProducts();
  }, []);

  return (
    <>
      <Header title="熱賣商品" showUserAvatar />
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
             <p className="font-semibold text-lg">暫時沒有熱賣商品</p>
             <p>快去發掘和收藏您喜歡的商品吧！</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
