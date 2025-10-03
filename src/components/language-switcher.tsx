'use client';

import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation();

  return (
      <div className="flex justify-center gap-2 mt-6">
          <Button
              onClick={() => setLanguage('zh')}
              variant={language === 'zh' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-full"
          >
              繁體中文
          </Button>
          <Button
              onClick={() => setLanguage('en')}
              variant={language === 'en' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-full"
          >
              English
          </Button>
      </div>
  )
}
