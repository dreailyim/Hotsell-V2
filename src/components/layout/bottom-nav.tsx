
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Flame, PlusCircle, MessageCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { useUnreadCount } from '@/hooks/use-unread-count';

const navItems = [
  { href: '/', icon: Home, label: '主頁' },
  { href: '/hot', icon: Flame, label: '熱賣' },
  { href: '/list', icon: PlusCircle, label: '刊登' },
  { href: '/messages', icon: MessageCircle, label: '訊息' },
  { href: '/profile', icon: User, label: '我的' },
];

export function BottomNav() {
  const pathname = usePathname();
  const scrollDirection = useScrollDirection();
  const totalUnreadCount = useUnreadCount();

  const [indicatorStyle, setIndicatorStyle] = useState({
    left: '0px',
    width: '0px',
    opacity: 0,
  });
  const navRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const activeIndex = navItems.findIndex(
      (item) =>
        (pathname === '/' && item.href === '/') ||
        (item.href !== '/' && pathname.startsWith(item.href))
    );

    if (activeIndex !== -1 && itemsRef.current[activeIndex]) {
      const activeButton = itemsRef.current[activeIndex] as HTMLAnchorElement;
      const { offsetLeft, offsetWidth } = activeButton;
      
      setIndicatorStyle({
        left: `${offsetLeft}px`,
        width: `${offsetWidth}px`,
        opacity: 1,
      });
    }
  }, [pathname]);

  return (
    <nav
      className={cn(
        'fixed bottom-4 left-1/2 z-40 -translate-x-1/2 transform transition-transform duration-300 md:hidden',
        scrollDirection === 'down' ? 'translate-y-32' : 'translate-y-0'
      )}
    >
      <div className="relative flex items-center gap-2 rounded-full bg-background/50 p-2 shadow-xl backdrop-blur-sm ring-1 ring-inset ring-white/20" ref={navRef}>
        <div 
          className="absolute h-14 w-14 rounded-full bg-gradient-to-br from-orange-500 to-red-600 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={indicatorStyle}
        />

        {navItems.map((item, index) => {
          const isActive =
            (pathname === '/' && item.href === '/') ||
            (item.href !== '/' && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={(el) => (itemsRef.current[index] = el)}
              className={cn(
                'relative z-10 flex h-14 w-14 flex-col items-center justify-center rounded-full transition-colors gap-1',
                isActive
                  ? 'text-primary-foreground dark:text-black'
                  : 'text-muted-foreground hover:text-foreground/80'
              )}
            >
              {item.href === '/messages' && totalUnreadCount > 0 && (
                 <span className="absolute top-1 right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              )}
              <item.icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
