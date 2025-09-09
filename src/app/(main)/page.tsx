
'use client';

import { useEffect, useState, useRef } from 'react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
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

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const plugin = useRef(
    Autoplay({ delay: 3000, stopOnInteraction: true })
  );

  const adBanners = [
    { src: "https://picsum.photos/seed/ad1/1200/400", alt: "Special promotion on electronics", title: "電子產品特賣", description: "相機、手機、筆電，應有盡有！", dataAiHint: "electronics sale" },
    { src: "https://picsum.photos/seed/ad2/1200/400", alt: "New fashion arrivals", title: "時尚新品到著", description: "換季大減價，立即選購！", dataAiHint: "fashion clothes" },
    { src: "https://picsum.photos/seed/ad3/1200/400", alt: "Home goods clearance", title: "家居好物清貨", description: "為您的家增添一份溫馨。", dataAiHint: "home decor" },
  ]

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const productsRef = collection(db, 'products');
        const q = query(productsRef, orderBy('createdAt', 'desc'), limit(20));
        const querySnapshot = await getDocs(q);
        const productsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(productsData);
      } catch (error) {
        console.error("Error fetching products: ", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  return (
    <>
      <Header showSearch />
       <div className="container mx-auto px-4 md:px-6 py-6">
        <Carousel 
            plugins={[plugin.current]}
            className="w-full"
            onMouseEnter={plugin.current.stop}
            onMouseLeave={plugin.current.reset}
            >
            <CarouselContent>
                {adBanners.map((banner, index) => (
                <CarouselItem key={index}>
                    <div className="p-1">
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
                </CarouselItem>
                ))}
            </CarouselContent>
            <CarouselPrevious className="absolute left-4 hidden sm:flex" />
            <CarouselNext className="absolute right-4 hidden sm:flex" />
        </Carousel>
      </div>

      <main className="container mx-auto px-4 md:px-6 pb-6">
        {loading ? (
          <ProductGridSkeleton />
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
