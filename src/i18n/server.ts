import { createI18nServer } from 'next-international/server';
import { en } from './en';
import { zh } from './zh';

export const { getI18n, getScopedI18n, getStaticParams, getCurrentLocale } = createI18nServer({
  en: () => import('./en'),
  zh: () => import('./zh'),
});
