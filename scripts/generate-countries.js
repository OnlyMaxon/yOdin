#!/usr/bin/env node
/**
 * Regenerates src/data/countries.ts.
 *
 * Nationality is the single biggest node in the app: it drives registration,
 * the Feed and Forum filters, the Algolia facet and the recommendation boost.
 * A country missing from the list is a person who cannot say where they are
 * from, so the list has to be complete rather than curated by hand — that is
 * how Belarus came to be absent for the first month of release.
 *
 * Two rules make this safe to re-run:
 *
 * 1. PINNED holds the entries as they shipped, and they are reproduced
 *    verbatim. The stored value is the country *name* — it is copied into
 *    every post, comment, question and reply as `authorNationality`, and the
 *    Firestore query and the Algolia facet both filter on that string.
 *    Renaming an existing entry would split old content from new, so the
 *    shipped names are never regenerated, only the new ones are.
 * 2. Everything else comes from ICU (CLDR), the same database iOS and Android
 *    use for their own region pickers, so no one here is authoring a name for
 *    a contested place.
 *
 * The output is one alphabetical list. The registration and profile pickers
 * render the array as it stands, so the order written here is the order on
 * screen.
 *
 *     node scripts/generate-countries.js
 */
const fs = require('fs');
const path = require('path');

// The list exactly as it shipped. This is not display order: it exists so the
// names and codes that are already written into live documents are reproduced
// verbatim rather than regenerated from ICU (which calls CZ "Czechia" and AE
// "United Arab Emirates", where this app shipped "Czech Republic" and "UAE").
const PINNED = [
  ['AZ', 'Azerbaijan'], ['RU', 'Russia'], ['TR', 'Turkey'], ['UA', 'Ukraine'],
  ['GE', 'Georgia'], ['AM', 'Armenia'], ['KZ', 'Kazakhstan'], ['UZ', 'Uzbekistan'],
  ['DE', 'Germany'], ['FR', 'France'], ['GB', 'United Kingdom'], ['US', 'United States'],
  ['IT', 'Italy'], ['ES', 'Spain'], ['PL', 'Poland'], ['NL', 'Netherlands'],
  ['SE', 'Sweden'], ['NO', 'Norway'], ['CN', 'China'], ['JP', 'Japan'],
  ['KR', 'South Korea'], ['IN', 'India'], ['IR', 'Iran'], ['IQ', 'Iraq'],
  ['SA', 'Saudi Arabia'], ['AE', 'UAE'], ['IL', 'Israel'], ['EG', 'Egypt'],
  ['BR', 'Brazil'], ['MX', 'Mexico'], ['AR', 'Argentina'], ['CA', 'Canada'],
  ['AU', 'Australia'], ['ZA', 'South Africa'], ['NG', 'Nigeria'], ['PK', 'Pakistan'],
  ['BD', 'Bangladesh'], ['RO', 'Romania'], ['HU', 'Hungary'], ['CZ', 'Czech Republic'],
  ['VN', 'Vietnam'], ['MY', 'Malaysia'], ['TH', 'Thailand'], ['ID', 'Indonesia'],
];

// Codes with no permanent civilian population: research stations, military
// bases and uninhabited islands. Nobody's nationality, and several of them
// have no flag emoji in common fonts.
const UNINHABITED = new Set([
  'AQ', // Antarctica
  'BV', // Bouvet Island
  'HM', // Heard & McDonald Islands
  'TF', // French Southern Territories
  'GS', // South Georgia & South Sandwich Islands
  'UM', // U.S. Outlying Islands
  'CP', // Clipperton Island
  'IO', // British Indian Ocean Territory (military base only)
  'SJ', // Svalbard & Jan Mayen
  'CQ', // Sark — ~500 residents, not an ISO 3166-1 code, and no flag emoji
]);

// Macro-regions, exceptionally reserved codes and CLDR's pseudo-locales.
// These are not countries and ICU still hands back a name for them.
const NOT_A_COUNTRY = new Set([
  'EU', 'EZ', 'UN', 'QO', 'XA', 'XB', 'ZZ',
  'AC', 'TA', 'DG', 'EA', 'IC',
]);

// Codes withdrawn from ISO 3166-1 that CLDR still resolves, mapped onto the
// name of whatever succeeded them. Left in, they would each appear a second
// time next to the living country — 'UK' resolves to "United Kingdom" beside
// 'GB', 'SU' to "Russia" beside 'RU'. The duplicate-name assertion below
// catches any that are added to CLDR later.
const WITHDRAWN = new Set([
  'AN', // Netherlands Antilles -> Curaçao
  'BU', // Burma -> Myanmar
  'CS', // Serbia and Montenegro -> Serbia
  'DD', // East Germany -> Germany
  'DY', // Dahomey -> Benin
  'FX', // Metropolitan France -> France
  'HV', // Upper Volta -> Burkina Faso
  'NH', // New Hebrides -> Vanuatu
  'RH', // Rhodesia -> Zimbabwe
  'SU', // Soviet Union -> Russia
  'TP', // East Timor -> Timor-Leste
  'UK', // alias of GB
  'VD', // North Vietnam -> Vietnam
  'YD', // South Yemen -> Yemen
  'YU', // Yugoslavia -> Serbia
  'ZR', // Zaire -> Congo - Kinshasa
]);

// CLDR's short form is the one a person uses for themselves — "Hong Kong"
// rather than "Hong Kong SAR China", "Palestine" rather than "Palestinian
// Territories". It is only wrong where it shortens by dropping half a country,
// which across the whole list happens exactly once.
const USE_LONG_NAME = new Set([
  'BA', // short form is just "Bosnia", which leaves out Herzegovina
]);

// Regional-indicator pairs only render as a flag where the font carries that
// sequence, and fonts follow Unicode's RGI list, which covers ISO 3166-1. XK
// (Kosovo) is a user-assigned code outside it, so on iOS and Android its flag
// may come out as two boxed letters until the vendors add it. Kept anyway: a
// large diaspora is worth more than a tidy glyph, and the name is what the
// filter and the feed actually match on.
const NOT_IN_RGI = new Set(['XK']);

function flagOf(code) {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
    .join('');
}

const shortName = new Intl.DisplayNames(['en'], { type: 'region', style: 'short' });
const longName = new Intl.DisplayNames(['en'], { type: 'region', style: 'long' });

function allIcuCodes() {
  const out = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a) + String.fromCharCode(b);
      let name;
      try {
        name = (USE_LONG_NAME.has(code) ? longName : shortName).of(code);
      } catch {
        continue;
      }
      // ICU echoes the code back when it has no name for it.
      if (!name || name === code) continue;
      out.push([code, name]);
    }
  }
  return out;
}

function build() {
  const pinnedCodes = new Set(PINNED.map(([c]) => c));

  // A shipped name is reproduced as-is, so asking for its long form would do
  // nothing at all. Say so loudly instead of ignoring it.
  for (const code of USE_LONG_NAME) {
    if (pinnedCodes.has(code)) {
      throw new Error(
        `${code} is in PINNED, so USE_LONG_NAME cannot apply to it. Renaming a ` +
          'shipped country would orphan the posts already filed under the old name.',
      );
    }
  }

  const rest = allIcuCodes()
    .filter(([code]) => !pinnedCodes.has(code))
    .filter(([code]) => !UNINHABITED.has(code) && !NOT_A_COUNTRY.has(code) && !WITHDRAWN.has(code));

  // One alphabetical list. The registration and profile pickers render the
  // array as-is, so sorting here is what puts them in order on screen; the
  // filter drawer sorts anyway and is unaffected.
  const rows = [...PINNED, ...rest]
    .sort((x, y) => x[1].localeCompare(y[1], 'en'))
    .map(([code, name]) => ({ code, name, flag: flagOf(code) }));

  // The app looks a country up by name (`COUNTRIES.find(c => c.name === n)`)
  // and the Firestore filter uses the name as its key, so a duplicate name
  // would quietly point two countries at one flag and one feed.
  const seenName = new Map();
  const seenCode = new Map();
  for (const r of rows) {
    if (seenName.has(r.name)) throw new Error(`duplicate name: ${r.name} (${seenName.get(r.name)} and ${r.code})`);
    if (seenCode.has(r.code)) throw new Error(`duplicate code: ${r.code}`);
    seenName.set(r.name, r.code);
    seenCode.set(r.code, r.name);
  }

  return { rows, pinnedCount: PINNED.length, restCount: rest.length };
}

const { rows, pinnedCount, restCount } = build();

// CLDR writes apostrophes typographically (Côte d’Ivoire), so a single-quoted
// literal is safe and matches the rest of the codebase — but assert it rather
// than assume it, since a straight quote would produce a broken file.
const BACKSLASH = String.fromCharCode(92);
for (const r of rows) {
  if (r.name.includes("'") || r.name.includes(BACKSLASH)) {
    throw new Error(`name would need escaping: ${r.name}`);
  }
}

const body = rows
  .map((r) => `  { code: '${r.code}', name: '${r.name}', flag: '${r.flag}' },`)
  .join('\n');

const out = `// Generated by scripts/generate-countries.js — do not edit by hand.
// Every inhabited country and territory, in alphabetical order: the pickers in
// registration and in the profile render this array as-is.
// ${pinnedCount} of these names are reproduced exactly as the app first shipped them,
// because the name is what gets written into every post and question as
// \`authorNationality\` and is the key both the Firestore filter and the Algolia
// facet match on — renaming one would split old content away from new. The other
// ${restCount} come from ICU (CLDR), the same region database iOS and Android use.
export interface Country {
  code: string;
  name: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
${body}
];
`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'countries.ts'), out, 'utf8');
console.log(`countries.ts: ${rows.length} entries (${pinnedCount} shipped names kept + ${restCount} from ICU)`);

const unrendered = rows.filter((r) => NOT_IN_RGI.has(r.code));
if (unrendered.length > 0) {
  console.log(
    'flag may not render on device (outside Unicode RGI): ' +
      unrendered.map((r) => `${r.code} ${r.name}`).join(', '),
  );
}

// ---------------------------------------------------------------------------
// Localized display names.
//
// The English name above is a *key*, not a label: it is copied into every post
// as `authorNationality` and both the Firestore query and the Algolia facet
// match on it, which is why it can never be translated in place. So the
// translation lives separately, keyed by country code, and is applied only
// where a name reaches the screen. Nothing stored anywhere changes.
//
// Generated at build time rather than resolved at runtime: Hermes ships a
// partial Intl, and whether `Intl.DisplayNames` exists there depends on how
// the binary was built. Node's ICU is a known quantity, so the lookup is a
// plain object by the time the app runs.
//
// Entries identical to the English name are dropped — roughly a third of them
// in Latin-script locales — and the lookup falls back to the stored name.

const localeDir = path.join(__dirname, '..', 'src', 'locales');
const locales = fs
  .readdirSync(localeDir)
  .filter((d) => fs.statSync(path.join(localeDir, d)).isDirectory())
  .sort();

const englishByCode = new Map(rows.map((r) => [r.code, r.name]));
const tables = {};
const emptyLocales = [];

for (const locale of locales) {
  // English is the stored name by definition, so there is nothing to
  // translate — and asking ICU anyway actively makes things worse: it answers
  // 'UK' for GB in the short style, and 'Czechia' for the shipped 'Czech
  // Republic'. Showing English users a different name than the one their
  // filter matches on buys nothing.
  if (locale === 'en') continue;

  // ICU falls back to English for a locale it does not know. That would
  // produce a table of English names masquerading as translations, so check
  // the resolved locale and skip anything that did not actually resolve.
  let display;
  try {
    display = {
      short: new Intl.DisplayNames([locale], { type: 'region', style: 'short' }),
      long: new Intl.DisplayNames([locale], { type: 'region', style: 'long' }),
    };
  } catch {
    emptyLocales.push(`${locale} (unsupported by ICU)`);
    continue;
  }
  if (!display.long.resolvedOptions().locale.startsWith(locale)) {
    emptyLocales.push(`${locale} (ICU resolved to ${display.long.resolvedOptions().locale})`);
    continue;
  }

  const table = {};
  for (const [code, english] of englishByCode) {
    let name;
    try {
      name = (USE_LONG_NAME.has(code) ? display.long : display.short).of(code);
    } catch {
      continue;
    }
    if (!name || name === code || name === english) continue;
    table[code] = name;
  }
  if (Object.keys(table).length === 0) emptyLocales.push(`${locale} (no differing names)`);
  else tables[locale] = table;
}

// JSON.stringify rather than hand-built quotes: these names come from 27
// languages and will contain apostrophes the English list never had.
const namesBody = Object.entries(tables)
  .map(([locale, table]) => {
    const entries = Object.entries(table)
      .map(([code, name]) => `    ${code}: ${JSON.stringify(name)},`)
      .join('\n');
    return `  ${locale}: {\n${entries}\n  },`;
  })
  .join('\n');

const namesOut = `// Generated by scripts/generate-countries.js — do not edit by hand.
//
// Country names translated for display only. The English name in countries.ts
// stays the stored key — it is what lives in every post's \`authorNationality\`
// and what the Firestore filter and the Algolia facet match on — so nothing
// here affects what is written or queried.
//
// Keyed by language, then by country code. A code missing from a language's
// table is one whose name is the same as the English, so callers fall back to
// the stored name. Use \`countryName()\` from src/utils/countryName.ts rather
// than reading this directly.
export const COUNTRY_NAMES: Record<string, Record<string, string>> = {
${namesBody}
};
`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'countryNames.ts'), namesOut, 'utf8');

const translated = Object.entries(tables)
  .map(([l, t]) => `${l}:${Object.keys(t).length}`)
  .join(' ');
console.log(`countryNames.ts: ${Object.keys(tables).length} locales — ${translated}`);
if (emptyLocales.length > 0) console.log(`no table written for: ${emptyLocales.join(', ')}`);
