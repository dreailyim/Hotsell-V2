
'use client';

import { Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/hooks/use-translation';
import Link from 'next/link';

import { Header } from '@/components/layout/header';
import { ProductCard } from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import { Flame } from 'lucide-react';

// Define the type for a banner
type Banner = {
  id: string;
  titleKey: 'home_banner_title';
  descriptionKey: 'home_banner_description';
  href: string;
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
  
  // --- Static Banner Data ---
  const banners: Banner[] = [
    {
      id: 'static-banner-1',
      titleKey: "home_banner_title",
      descriptionKey: "home_banner_description",
      href: "/list",
    }
  ];

  const plugin = useRef(
    Autoplay({ delay: 3000, stopOnInteraction: true })
  );

  const renderDefaultView = () => (
    <>
        <div className="container mx-auto px-4 md:px-6 py-3">
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
                              <CardContent className="relative flex aspect-[3/1] items-center justify-center p-0 bg-gradient-to-br from-orange-400 via-red-500 to-red-600">
                                  <Flame className="absolute h-3/4 w-3/4 text-white/10" />
                                  <div className="relative z-10 flex flex-col justify-center items-center text-white p-4 text-center">
                                      <h2 className="text-3xl md:text-5xl font-bold tracking-tight drop-shadow-md">{t(banner.titleKey as any)}</h2>
                                      <p className="text-base md:text-xl mt-2 drop-shadow-sm">{t(banner.descriptionKey as any)}</p>
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
      </div>
       <main className="container mx-auto px-4 md:px-6 py-3">
        <h2 className="text-xl font-bold mb-4">{t('home.latest_products')}</h2>
        <ProductGridSkeleton />
      </main>
    </>
  );

  return (
    <>
      <Header showSearch showUserAvatar={!!user} />
      {renderDefaultView()}
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
