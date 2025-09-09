'use client';

import { useState, useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client-app';
import type { Product } from '@/lib/types';
import { Header } from '@/components/layout/header';
import { Skeleton } from '@/components/ui/skeleton';
import { EditListingForm } from '@/components/edit-listing-form';

function EditPageSkeleton() {
  return (
    <>
      <Header title="編輯物品" showBackButton />
      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-8">
            {/* Image Skeleton */}
            <div className="space-y-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="w-full h-64 border-2 border-dashed rounded-lg" />
            </div>
             {/* Form Skeletons */}
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </>
  );
}


export default function EditProductPage() {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const productId = Array.isArray(params.id) ? params.id[0] : params.id as string;

  useEffect(() => {
    if (!productId) return;

    const docRef = doc(db, 'products', productId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const createdAt = data.createdAt instanceof Timestamp 
            ? data.createdAt.toDate().toISOString() 
            : new Date().toISOString();

        setProduct({ 
            id: docSnap.id, 
            ...data,
            createdAt: createdAt,
        } as Product);
      } else {
        setProduct(null); // Product not found
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching product for edit:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [productId]);
  
  if (loading) {
    return <EditPageSkeleton />;
  }

  if (!product) {
    notFound();
  }

  return (
    <>
      <Header title="編輯物品" showBackButton />
      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <EditListingForm product={product} />
        </div>
      </div>
    </>
  );
}
