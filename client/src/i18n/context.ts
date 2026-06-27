import { createContext, useCallback, useContext } from 'react';
import { translations } from './translations';
import type { Lang } from './translations';

export interface LanguageCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const LanguageContext = createContext<LanguageCtx>({ lang: 'en', setLang: () => {} });

export function useLang(): LanguageCtx {
  return useContext(LanguageContext);
}

// Translator hook. t('nav.dashboard') → localized string; t(key, { name }) fills
// {name} placeholders. Falls back to English, then the key itself.
export function useT() {
  const { lang } = useLang();
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = translations[lang][key] ?? translations.en[key] ?? key;
      if (vars) {
        for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
      }
      return s;
    },
    [lang],
  );
}
