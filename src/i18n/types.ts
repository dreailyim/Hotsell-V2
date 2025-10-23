
import { en } from './en';
import { zh } from './zh';

// This is a simplified type definition to avoid TypeScript's "excessive stack depth" error
// with very large and deeply nested translation objects.

// It includes all top-level keys from both language files and uses template literal types
// for dynamic keys like districts and MTR stations.
export type TranslationKey = 
  keyof typeof en | 
  keyof typeof zh | 
  `category.${string}` |
  `condition.${string}` |
  `district.group.${string}` |
  `district.${string}` |
  `mtr_lines.${string}` |
  `mtr_stations.${string}`;
