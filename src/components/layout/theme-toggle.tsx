
'use client';

import { Moon, Sun, Laptop } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/use-translation';

const themeOptions = [
  { theme: 'light', labelKey: 'settings.theme.light', icon: Sun },
  { theme: 'dark', labelKey: 'settings.theme.dark', icon: Moon },
  { theme: 'system', labelKey: 'settings.theme.system', icon: Laptop },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

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
            {t(option.labelKey)}
          </span>
        </div>
      ))}
    </div>
  );
}
