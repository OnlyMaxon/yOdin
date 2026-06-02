import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import en from '../locales/en/translation.json';
import ru from '../locales/ru/translation.json';
import az from '../locales/az/translation.json';
import zh from '../locales/zh/translation.json';
import es from '../locales/es/translation.json';
import ar from '../locales/ar/translation.json';
import hi from '../locales/hi/translation.json';
import pt from '../locales/pt/translation.json';
import fr from '../locales/fr/translation.json';
import de from '../locales/de/translation.json';
import tr from '../locales/tr/translation.json';
import ja from '../locales/ja/translation.json';
import ko from '../locales/ko/translation.json';
import it from '../locales/it/translation.json';
import pl from '../locales/pl/translation.json';
import uk from '../locales/uk/translation.json';
import id from '../locales/id/translation.json';
import nl from '../locales/nl/translation.json';
import vi from '../locales/vi/translation.json';
import fa from '../locales/fa/translation.json';
import ro from '../locales/ro/translation.json';
import cs from '../locales/cs/translation.json';
import sv from '../locales/sv/translation.json';
import he from '../locales/he/translation.json';
import th from '../locales/th/translation.json';
import ms from '../locales/ms/translation.json';
import bn from '../locales/bn/translation.json';

const RTL_LANGS: readonly string[] = ['ar', 'he', 'fa'];

export const SUPPORTED_LANGS = [
  'en', 'ru', 'az', 'zh', 'es', 'ar', 'hi', 'pt', 'fr', 'de',
  'tr', 'ja', 'ko', 'it', 'pl', 'uk', 'id', 'nl', 'vi', 'fa',
  'ro', 'cs', 'sv', 'he', 'th', 'ms', 'bn',
] as const;
export type AppLang = typeof SUPPORTED_LANGS[number];
export const LANG_STORAGE_KEY = 'app_language';

const deviceLang = Localization.getLocales()[0]?.languageCode ?? 'en';
const defaultLng: AppLang = SUPPORTED_LANGS.includes(deviceLang as AppLang) ? (deviceLang as AppLang) : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
    az: { translation: az },
    zh: { translation: zh },
    es: { translation: es },
    ar: { translation: ar },
    hi: { translation: hi },
    pt: { translation: pt },
    fr: { translation: fr },
    de: { translation: de },
    tr: { translation: tr },
    ja: { translation: ja },
    ko: { translation: ko },
    it: { translation: it },
    pl: { translation: pl },
    uk: { translation: uk },
    id: { translation: id },
    nl: { translation: nl },
    vi: { translation: vi },
    fa: { translation: fa },
    ro: { translation: ro },
    cs: { translation: cs },
    sv: { translation: sv },
    he: { translation: he },
    th: { translation: th },
    ms: { translation: ms },
    bn: { translation: bn },
  },
  lng: defaultLng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: {
    useSuspense: false,
    bindI18n: 'languageChanged',
  },
});

export async function initLanguage(): Promise<void> {
  const saved = await AsyncStorage.getItem(LANG_STORAGE_KEY);
  const activeLang = (saved && SUPPORTED_LANGS.includes(saved as AppLang))
    ? (saved as AppLang)
    : (i18n.language as AppLang);
  if (saved && SUPPORTED_LANGS.includes(saved as AppLang)) {
    await i18n.changeLanguage(activeLang);
  }
  const isRTL = RTL_LANGS.includes(activeLang);
  I18nManager.allowRTL(isRTL);
  I18nManager.forceRTL(isRTL);
}

export async function setAppLanguage(lang: AppLang): Promise<boolean> {
  const wasRTL = I18nManager.isRTL;
  const willBeRTL = RTL_LANGS.includes(lang);
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(LANG_STORAGE_KEY, lang);
  I18nManager.allowRTL(willBeRTL);
  I18nManager.forceRTL(willBeRTL);
  return wasRTL !== willBeRTL;
}

export default i18n;
