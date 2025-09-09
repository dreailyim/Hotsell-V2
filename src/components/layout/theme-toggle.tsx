
'use client';

import { Moon, Sun, Laptop } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const themeOptions = [
  { theme: 'light', label: '淺色', icon: Sun },
  { theme: 'dark', label: '深色', icon: Moon },
  { theme: 'system', label: '系統', icon: Laptop },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-3 gap-4">
      {themeOptions.map((option) => (
        <div key={option.theme} className="flex flex-col items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className={cn(
              'h-16 w-16 rounded-full border-2 transition-all',
              theme === option.theme
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border'
            )}
            onClick={() => setTheme(option.theme)}
          >
            <option.icon className="h-6 w-6" />
          </Button>
           <span className={cn(
               "text-sm",
                theme === option.theme ? 'font-semibold text-primary' : 'text-muted-foreground'
           )}>
            {option.label}
          </span>
        </div>
      ))}
    </div>
  );
}
