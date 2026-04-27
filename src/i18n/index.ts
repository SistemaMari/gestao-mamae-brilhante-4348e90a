import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ptBR from './locales/pt-BR.json';
import enUS from './locales/en-US.json';
import es from './locales/es.json';

export const SUPPORTED_LANGUAGES = ['pt-BR', 'en-US', 'es'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const LANGUAGE_META: Record<SupportedLanguage, { label: string; flag: string; short: string }> = {
  'pt-BR': { label: 'Português (Brasil)', flag: '🇧🇷', short: 'PT' },
  'en-US': { label: 'English (US)', flag: '🇺🇸', short: 'EN' },
  'es':    { label: 'Español',         flag: '🇪🇸', short: 'ES' },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'pt-BR': { translation: ptBR },
      'en-US': { translation: enUS },
      'es':    { translation: es },
    },
    fallbackLng: 'pt-BR',
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    nonExplicitSupportedLngs: true,
    load: 'currentOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'app.lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });

// Helper para sincronizar idioma com Supabase profile
export function normalizeLang(value: string | null | undefined): SupportedLanguage {
  if (!value) return 'pt-BR';
  const v = value.toLowerCase();
  if (v.startsWith('en')) return 'en-US';
  if (v.startsWith('es')) return 'es';
  return 'pt-BR';
}

export default i18n;
