'use client';

import { useContext } from 'react';
import { LanguageContext, LanguageContextType } from '@/providers/language-provider';
import { en } from '@/i18n/en';
import { zh } from '@/i18n/zh';

const translations = {
  en,
  zh,
};

type TranslationKey = keyof typeof en | keyof typeof zh;

export const useTranslation = () => {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }

  const { language } = context;

  const t = (key: TranslationKey): string => {
    // Fallback to 'en' if a key is missing in the current language
    return translations[language][key] || translations['en'][key] || key;
  };

  return { t, language: context.language, setLanguage: context.setLanguage };
};
