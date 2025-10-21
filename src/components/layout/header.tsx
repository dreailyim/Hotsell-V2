
'use client';

import Link from 'next/link';
import { ArrowLeft, Settings, Search as SearchIcon, X, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { Logo } from '../logo';

type HeaderProps = {
  showSearch?: boolean;
  title?: string;
  showBackButton?: boolean;
  backHref?: string; // New prop to specify a fixed back destination
  showSettingsButton?: boolean;
  showUserAvatar?: boolean;
};

function Search() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');

  // Update search term if URL changes
  useEffect(() => {
    setSearchTerm(searchParams.get('q') || '');
  }, [searchParams]);
  
  useEffect(() => {
    // Only apply debounce on the home page
    if (pathname !== '/') return;

    const debounceTimeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (searchTerm) {
        params.set('q', searchTerm);
      } else {
        params.delete('q');
      }
      router.replace(`${pathname}?${params.toString()}`);
    }, 300); // 300ms delay

    return () => clearTimeout(debounceTimeout);
  }, [searchTerm, pathname, router, searchParams]);

  // Don't show search bar on pages other than homepage for this filtering implementation
  if (pathname !== '/') {
    return null;
  }

  return (
      <div className="relative w-full max-w-xs">
        <SearchIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('header.search_placeholder')}
          className="w-full rounded-full pl-10 pr-10 h-8 text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
           <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full"
              onClick={() => setSearchTerm('')}
            >
              <X className="h-4 w-4" />
           </Button>
        )}
      </div>
  );
}


export function Header({
  showSearch = false,
  title,
  showBackButton = false,
  backHref,
  showSettingsButton = false,
  showUserAvatar = false,
}: HeaderProps) {
  const router = useRouter();
  const { user } = useAuth();

  const handleBackClick = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };
  
  const renderRightContent = () => {
    if (showSettingsButton && user) {
       return (
        <Link href="/profile/settings">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
            <Settings className="h-5 w-5" />
          </Button>
        </Link>
      )
    }
    if (showUserAvatar && user) {
      return (
        <Link href="/profile/settings">
          <Avatar className="h-7 w-7 cursor-pointer">
            <AvatarImage src={user.photoURL || undefined} alt={user.displayName || '用戶頭像'} />
            <AvatarFallback>{user.displayName?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
        </Link>
      )
    }
    // For visitors
    if (!user && showUserAvatar) {
       return (
         <Link href="/login">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                <LogIn className="h-5 w-5" />
            </Button>
         </Link>
       )
    }

    return null;
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-background/30 backdrop-blur-sm">
      <div className="container mx-auto flex h-12 items-center justify-between px-4 md:px-6">
        {/* Left Section */}
        <div className="flex items-center" style={{ width: '60px' }}>
          {showBackButton ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={handleBackClick}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
             <div className="flex items-center gap-2">
                <Logo className="h-7 w-7" />
            </div>
          )}
        </div>

        {/* Center Section */}
        <div className="flex-1 flex items-center justify-center">
          {showSearch ? <Search /> : (title && <h1 className="whitespace-nowrap text-lg font-bold">{title}</h1>)}
        </div>

        {/* Right Section */}
        <div className="flex items-center justify-end" style={{ width: '60px' }}>
          {renderRightContent()}
        </div>
      </div>
    </header>
  );
}
