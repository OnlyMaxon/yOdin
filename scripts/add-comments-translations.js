// One-off: merge comments.* keys into all locale files.
// Run: node scripts/add-comments-translations.js
const fs = require('fs');
const path = require('path');

const T = {
  en: { title: 'Comments', placeholder: 'Write a comment...', empty: 'No comments yet. Be the first!' },
  ru: { title: 'Комментарии', placeholder: 'Написать комментарий...', empty: 'Пока нет комментариев. Будьте первым!' },
  az: { title: 'Şərhlər', placeholder: 'Şərh yazın...', empty: 'Hələ şərh yoxdur. İlk siz olun!' },
  zh: { title: '评论', placeholder: '写评论...', empty: '暂无评论，来发表第一条吧！' },
  es: { title: 'Comentarios', placeholder: 'Escribe un comentario...', empty: 'Aún no hay comentarios. ¡Sé el primero!' },
  ar: { title: 'التعليقات', placeholder: 'اكتب تعليقًا...', empty: 'لا توجد تعليقات بعد. كن أول من يعلّق!' },
  hi: { title: 'टिप्पणियाँ', placeholder: 'टिप्पणी लिखें...', empty: 'अभी कोई टिप्पणी नहीं। पहले बनें!' },
  pt: { title: 'Comentários', placeholder: 'Escreva um comentário...', empty: 'Ainda não há comentários. Seja o primeiro!' },
  fr: { title: 'Commentaires', placeholder: 'Écrire un commentaire...', empty: 'Pas encore de commentaires. Soyez le premier !' },
  de: { title: 'Kommentare', placeholder: 'Kommentar schreiben...', empty: 'Noch keine Kommentare. Sei der Erste!' },
  tr: { title: 'Yorumlar', placeholder: 'Yorum yaz...', empty: 'Henüz yorum yok. İlk sen ol!' },
  ja: { title: 'コメント', placeholder: 'コメントを書く...', empty: 'まだコメントがありません。最初のコメントをしましょう！' },
  ko: { title: '댓글', placeholder: '댓글 작성...', empty: '아직 댓글이 없습니다. 첫 댓글을 남겨보세요!' },
  it: { title: 'Commenti', placeholder: 'Scrivi un commento...', empty: 'Ancora nessun commento. Sii il primo!' },
  pl: { title: 'Komentarze', placeholder: 'Napisz komentarz...', empty: 'Brak komentarzy. Bądź pierwszy!' },
  uk: { title: 'Коментарі', placeholder: 'Написати коментар...', empty: 'Поки немає коментарів. Будьте першим!' },
  id: { title: 'Komentar', placeholder: 'Tulis komentar...', empty: 'Belum ada komentar. Jadilah yang pertama!' },
  nl: { title: 'Reacties', placeholder: 'Schrijf een reactie...', empty: 'Nog geen reacties. Wees de eerste!' },
  vi: { title: 'Bình luận', placeholder: 'Viết bình luận...', empty: 'Chưa có bình luận nào. Hãy là người đầu tiên!' },
  fa: { title: 'نظرات', placeholder: 'نظر بنویسید...', empty: 'هنوز نظری نیست. اولین نفر باشید!' },
  ro: { title: 'Comentarii', placeholder: 'Scrie un comentariu...', empty: 'Încă nu există comentarii. Fii primul!' },
  cs: { title: 'Komentáře', placeholder: 'Napsat komentář...', empty: 'Zatím žádné komentáře. Buďte první!' },
  sv: { title: 'Kommentarer', placeholder: 'Skriv en kommentar...', empty: 'Inga kommentarer än. Bli först!' },
  he: { title: 'תגובות', placeholder: 'כתוב תגובה...', empty: 'אין עדיין תגובות. היו הראשונים!' },
  th: { title: 'ความคิดเห็น', placeholder: 'เขียนความคิดเห็น...', empty: 'ยังไม่มีความคิดเห็น มาเป็นคนแรกกัน!' },
  ms: { title: 'Komen', placeholder: 'Tulis komen...', empty: 'Belum ada komen. Jadilah yang pertama!' },
  bn: { title: 'মন্তব্য', placeholder: 'মন্তব্য লিখুন...', empty: 'এখনও কোনো মন্তব্য নেই। প্রথম হোন!' },
};

const localesDir = path.join(__dirname, '..', 'src', 'locales');
let updated = 0;
for (const [lang, comments] of Object.entries(T)) {
  const file = path.join(localesDir, lang, 'translation.json');
  if (!fs.existsSync(file)) { console.error(`MISSING: ${file}`); process.exitCode = 1; continue; }
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  json.comments = { ...(json.comments ?? {}), ...comments };
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
  updated++;
}
console.log(`Updated ${updated} locale files.`);