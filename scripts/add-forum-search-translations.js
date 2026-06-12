// One-off: merge forum.search / forum.nothingFound into all locale files.
// Run: node scripts/add-forum-search-translations.js
const fs = require('fs');
const path = require('path');

const T = {
  en: { search: 'Search questions', nothingFound: 'Nothing found' },
  ru: { search: 'Поиск по вопросам', nothingFound: 'Ничего не найдено' },
  az: { search: 'Suallarda axtarış', nothingFound: 'Heç nə tapılmadı' },
  zh: { search: '搜索问题', nothingFound: '未找到结果' },
  es: { search: 'Buscar preguntas', nothingFound: 'No se encontró nada' },
  ar: { search: 'البحث في الأسئلة', nothingFound: 'لم يتم العثور على شيء' },
  hi: { search: 'सवाल खोजें', nothingFound: 'कुछ नहीं मिला' },
  pt: { search: 'Buscar perguntas', nothingFound: 'Nada encontrado' },
  fr: { search: 'Rechercher des questions', nothingFound: 'Aucun résultat' },
  de: { search: 'Fragen suchen', nothingFound: 'Nichts gefunden' },
  tr: { search: 'Sorularda ara', nothingFound: 'Sonuç bulunamadı' },
  ja: { search: '質問を検索', nothingFound: '見つかりませんでした' },
  ko: { search: '질문 검색', nothingFound: '검색 결과 없음' },
  it: { search: 'Cerca domande', nothingFound: 'Nessun risultato' },
  pl: { search: 'Szukaj pytań', nothingFound: 'Nic nie znaleziono' },
  uk: { search: 'Пошук за питаннями', nothingFound: 'Нічого не знайдено' },
  id: { search: 'Cari pertanyaan', nothingFound: 'Tidak ada hasil' },
  nl: { search: 'Vragen zoeken', nothingFound: 'Niets gevonden' },
  vi: { search: 'Tìm câu hỏi', nothingFound: 'Không tìm thấy gì' },
  fa: { search: 'جستجوی سوال‌ها', nothingFound: 'چیزی یافت نشد' },
  ro: { search: 'Caută întrebări', nothingFound: 'Nu s-a găsit nimic' },
  cs: { search: 'Hledat otázky', nothingFound: 'Nic nenalezeno' },
  sv: { search: 'Sök frågor', nothingFound: 'Inget hittades' },
  he: { search: 'חיפוש שאלות', nothingFound: 'לא נמצא דבר' },
  th: { search: 'ค้นหาคำถาม', nothingFound: 'ไม่พบผลลัพธ์' },
  ms: { search: 'Cari soalan', nothingFound: 'Tiada hasil ditemui' },
  bn: { search: 'প্রশ্ন খুঁজুন', nothingFound: 'কিছু পাওয়া যায়নি' },
};

const localesDir = path.join(__dirname, '..', 'src', 'locales');
let updated = 0;
for (const [lang, forumAdditions] of Object.entries(T)) {
  const file = path.join(localesDir, lang, 'translation.json');
  if (!fs.existsSync(file)) { console.error(`MISSING: ${file}`); process.exitCode = 1; continue; }
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  json.forum = { ...(json.forum ?? {}), ...forumAdditions };
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
  updated++;
}
console.log(`Updated ${updated} locale files.`);