'use client';

import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


export function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation();

  return (
      <div className="flex justify-center gap-2 mt-6">
          <Select onValueChange={(value: 'en' | 'zh') => setLanguage(value)} value={language}>
              <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="zh">繁體中文</SelectItem>
                  <SelectItem value="en">English</SelectItem>
              </SelectContent>
          </Select>
      </div>
  )
}
