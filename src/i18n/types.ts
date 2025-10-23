
import { en } from './en';
import { zh } from './zh';

// This dynamically creates a union type of all possible keys.
// It also supports nested keys with dot notation.
type PathsToStringProps<T> = T extends string ? [] : {
    [K in Extract<keyof T, string>]: [K, ...PathsToStringProps<T[K]>]
}[Extract<keyof T, string>];

type Join<T extends string[], D extends string> =
    T extends [] ? never :
    T extends [infer F] ? F :
    T extends [infer F, ...infer R] ?
    F extends string ?
    `${F}${D}${Join<Extract<R, string[]>, D>}` : never : string;

type TranslationKeys<T> = Join<PathsToStringProps<T>, '.'>

export type TranslationKey = TranslationKeys<typeof en> | TranslationKeys<typeof zh>;
