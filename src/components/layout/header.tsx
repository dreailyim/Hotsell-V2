'use client';

import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search } from './search';

type HeaderProps = {
  showSearch?: boolean;
  title?: string;
  showBackButton?: boolean;
  showSettingsButton?: boolean;
  showUserAvatar?: boolean;
};

export function Header({
  showSearch = false,
  title,
  showBackButton = false,
  showSettingsButton = false,
  showUserAvatar = false,
}: HeaderProps) {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b-0 bg-background/50 backdrop-blur-sm">
      <div className="container mx-auto flex h-14 items-center px-4 md:px-6">
        {/* Left Section */}
        <div className="flex w-1/5 justify-start">
          {showBackButton && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          )}
        </div>

        {/* Center Section */}
        <div className="flex w-3/5 items-center justify-center">
          {showSearch && <Search />}
          {!showSearch && title && (
            <h1 className="whitespace-nowrap text-xl font-bold">{title}</h1>
          )}
        </div>

        {/* Right Section */}
        <div className="flex w-1/5 items-center justify-end">
          {showSettingsButton && (
            <Link href="/profile/settings">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
                <Settings className="h-6 w-6" />
              </Button>
            </Link>
          )}
          {showUserAvatar && user && (
             <Link href="/profile">
              <Avatar className="h-8 w-8 cursor-pointer">
                <AvatarImage src={user.photoURL || undefined} alt={user.displayName || '用戶頭像'} />
                <AvatarFallback>{user.displayName?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
