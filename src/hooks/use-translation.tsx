'use client';

import { useContext } from 'react';
import { LanguageContext, LanguageContextType } from '@/providers/language-provider';

export const useTranslation = (): Omit<LanguageContextType, 'language'> => {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }

  // We only expose `t` and `setLanguage` to consumer components.
  // The `language` state itself is handled within the provider.
  return { t: context.t, setLanguage: context.setLanguage };
};
