'use client';

import { createI18nClient } from 'next-international/client';

// The error "Element type is invalid" is often caused by a mismatch in how dynamic imports
// are handled, especially with default exports. Explicitly mapping the resolved module
// to its `default` property ensures that createI18nClient receives the correct module content.
export const { useI18n, useScopedI18n, I18nProvider, useChangeLocale, useCurrentLocale } = createI18nClient({
  en: () => import('./en'),
  zh: () => import('./zh'),
});
