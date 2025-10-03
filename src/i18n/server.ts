import { createI18nServer } from 'next-international/server';

export const { getI18n, getScopedI18n, getStaticParams, getCurrentLocale } = createI18nServer({
  en: () => import('./en').then(m => m.default),
  zh: () => import('./zh').then(m => m.default),
});
