'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'en' | 'zh';

export interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
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
    if (storedLang && storedLang !== language) {
      setLanguage(storedLang);
    }
  }, [language]);

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
  }, [language])

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};
