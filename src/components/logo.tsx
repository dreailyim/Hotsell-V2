
'use client';

import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
};

export function Logo({ className }: LogoProps) {
  return (
    <Flame className={cn('text-primary animate-burn', className)} />
  );
}
