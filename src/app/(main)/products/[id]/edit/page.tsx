
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client-app';
import type { Product } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/layout/header';
import { EditListingForm } from '@/components/edit-listing-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/hooks/use-translation';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/logo';

function EditPageSkeleton() {
    return (
        <div className="container mx-auto max-w-2xl px-4 md:px-6 py-8 space-y-8">
            <div className="space-y-4">
                <Skeleton className="h-8 w-1/4" />
                <Skeleton className="h-10 w-full" />
            </div>
             <div className="space-y-4">
                <Skeleton className="h-8 w-1/4" />
                <Skeleton className="h-10 w-full" />
            </div>
             <div className="space-y-4">
                <Skeleton className="h-8 w-1/4" />
                <Skeleton className="h-40 w-full" />
            </div>
        </div>
    )
}


export default function EditProductPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  const { t } = useTranslation();
  const { toast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;

    const fetchProduct = async () => {
      try {
        const productRef = doc(db, 'products', productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const data = productSnap.data();
           const createdAt = data.createdAt instanceof Timestamp 
                ? data.createdAt.toDate().toISOString() 
                : new Date().toISOString();
          const fetchedProduct = { id: productSnap.id, ...data, createdAt } as Product;

          if (user && fetchedProduct.sellerId !== user.uid) {
            setError('您沒有權限編輯此商品。');
            toast({ title: '權限不足', description: '您無法編輯不屬於您的商品。', variant: 'destructive' });
            router.push(`/products/${productId}`);
          } else {
            setProduct(fetchedProduct);
          }
        } else {
          setError('找不到此商品。');
        }
      } catch (e) {
        console.error("Error fetching product for edit:", e);
        setError('讀取商品資料時發生錯誤。');
      } finally {
        setLoading(false);
      }
    };

    if (user || !authLoading) {
        fetchProduct();
    }
  }, [productId, user, authLoading, router, toast]);

  if (loading || authLoading) {
    return (
        <>
            <Header title={t('header.title.loading')} showBackButton />
            <EditPageSkeleton />
        </>
    );
  }

  if (!user) {
    router.push('/login');
    return (
         <div className="flex h-screen items-center justify-center">
            <div className="flex flex-col items-center justify-center gap-4">
                <Logo className="h-16 w-16" />
                <p className="text-muted-foreground animate-pulse">{t('loading')}</p>
            </div>
        </div>
    );
  }
  
  if (error || !product) {
     return (
        <>
            <Header title="錯誤" showBackButton />
            <div className="container mx-auto text-center py-10">
                <p className="text-destructive">{error || '無法載入商品以進行編輯。'}</p>
            </div>
        </>
    );
  }


  return (
    <>
        <Header title={t('header.title.edit_item')} showBackButton backHref={`/products/${productId}`} />
        <div className="container mx-auto max-w-2xl px-4 md:px-6 py-8 space-y-8">
            <EditListingForm product={product} />
        </div>
    </>
  );
}
