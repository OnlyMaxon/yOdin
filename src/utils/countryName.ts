import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { COUNTRY_NAMES } from '../data/countryNames';
import { COUNTRIES } from '../data/countries';

const BY_NAME = new Map(COUNTRIES.map((c) => [c.name, c]));

// Country names are stored, not displayed, in English: the name string is
// copied into every post as `authorNationality`, and both the Firestore query
// and the Algolia facet match on it. Translating it in place would split old
// content from new, so the translation happens here instead — at the moment a
// name reaches the screen, looked up by the ISO code that travels with it.
//
// Anything without a translation falls back to the stored name: English has no
// table at all (it *is* the stored name), and the generator drops entries a
// language spells the same way.
export function countryName(
  code: string | undefined | null,
  stored: string | undefined | null,
  language: string,
): string {
  const fallback = stored ?? '';
  if (!code) return fallback;
  // Tolerate a regional tag ('pt-BR'); the tables are keyed by base language.
  return COUNTRY_NAMES[language.split('-')[0]]?.[code] ?? fallback;
}

// Hook form for components: re-renders with the rest of the UI on a language
// change, because useTranslation subscribes to it.
export function useCountryName() {
  const { i18n } = useTranslation();
  return useCallback(
    (code: string | undefined | null, stored: string | undefined | null) =>
      countryName(code, stored, i18n.language),
    [i18n.language],
  );
}

// For the places that hold only the stored name and no code — the selected
// nationality chips above the feed and the forum. A map lookup, because the
// alternative at those call sites was scanning all 242 countries per chip.
export function useStoredCountryName() {
  const { i18n } = useTranslation();
  return useCallback(
    (stored: string) => countryName(BY_NAME.get(stored)?.code, stored, i18n.language),
    [i18n.language],
  );
}
