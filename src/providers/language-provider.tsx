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

const getStoredLanguage = (): Language | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('app-language') as Language;
  }
  return null;
};

const getBrowserLanguage = (): Language => {
   if (typeof window !== 'undefined') {
    const browserLang = navigator.language.toLowerCase();
    return browserLang.includes('zh') ? 'zh' : 'en';
  }
  return 'zh';
}


export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  // Always default to 'zh' on initial render to match the server.
  const [language, setLanguage] = useState<Language>('zh');

  // After the component has mounted, check for the actual client-side language.
  useEffect(() => {
    const storedLang = getStoredLanguage();
    if (storedLang && ['en', 'zh'].includes(storedLang)) {
      setLanguage(storedLang);
      document.documentElement.lang = storedLang;
    } else {
      const browserLang = getBrowserLanguage();
      setLanguage(browserLang);
      document.documentElement.lang = browserLang;
    }
  }, []); // Empty dependency array ensures this runs only once on mount.


  const handleSetLanguage = (newLanguage: Language) => {
    setLanguage(newLanguage);
    if (typeof window !== 'undefined') {
      localStorage.setItem('app-language', newLanguage);
      document.documentElement.lang = newLanguage;
    }
  };

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
