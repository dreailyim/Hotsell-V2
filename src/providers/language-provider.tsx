'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { en } from '@/i18n/en';
import { zh } from '@/i18n/zh';

export type Language = 'en' | 'zh';

const translations = { en, zh };
type TranslationKey = keyof typeof en | keyof typeof zh;

export interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const getInitialLanguage = (): Language => {
  if (typeof window !== 'undefined') {
    const storedLang = localStorage.getItem('app-language') as Language;
    if (storedLang && ['en', 'zh'].includes(storedLang)) {
      return storedLang;
    }
    const browserLang = navigator.language.toLowerCase();
    return browserLang.includes('zh') ? 'zh' : 'en';
  }
  return 'zh'; // Default for server-side
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    const storedLang = localStorage.getItem('app-language') as Language;
    if (storedLang) {
      setLanguage(storedLang);
    }
    // Empty dependency array ensures this runs only once on mount
  }, []);

  const handleSetLanguage = (newLanguage: Language) => {
    setLanguage(newLanguage);
    if (typeof window !== 'undefined') {
      localStorage.setItem('app-language', newLanguage);
      document.documentElement.lang = newLanguage;
    }
  };

  useEffect(() => {
     if (typeof window !== 'undefined') {
        document.documentElement.lang = language;
     }
  }, [language]);

  // The `t` function is now memoized and will only be a new function instance
  // when the `language` state changes. This is crucial for hooks that depend on `t`.
  const t = useCallback((key: TranslationKey): string => {
    return translations[language][key] || translations['en'][key] || String(key);
  }, [language]);

  const contextValue = useMemo(() => ({
    language,
    setLanguage: handleSetLanguage,
    t,
  }), [language, t]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};
