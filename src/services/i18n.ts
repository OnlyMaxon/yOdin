import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '../locales/en/translation.json';
import ru from '../locales/ru/translation.json';
import az from '../locales/az/translation.json';

export const SUPPORTED_LANGS = ['en', 'ru', 'az'] as const;
export type AppLang = typeof SUPPORTED_LANGS[number];
export const LANG_STORAGE_KEY = 'app_language';

const deviceLang = Localization.getLocales()[0]?.languageCode ?? 'en';
const defaultLng: AppLang = SUPPORTED_LANGS.includes(deviceLang as AppLang) ? (deviceLang as AppLang) : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
    az: { translation: az },
  },
  lng: defaultLng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: {
    useSuspense: false,
    bindI18n: 'languageChanged',
  },
});

// Apply persisted language on startup
AsyncStorage.getItem(LANG_STORAGE_KEY).then((saved) => {
  if (saved && SUPPORTED_LANGS.includes(saved as AppLang)) {
    i18n.changeLanguage(saved);
  }
});

export async function setAppLanguage(lang: AppLang) {
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(LANG_STORAGE_KEY, lang);
}

export default i18n;
