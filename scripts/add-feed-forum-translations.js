// One-off script: merges feed/forum/rank translation keys into all locale files.
// Run: node scripts/add-feed-forum-translations.js
const fs = require('fs');
const path = require('path');

const T = {
  en: {
    categories: { all: 'All', news: 'News', events: 'Events', places: 'Worth Visiting' },
    feed: { emptyPosts: 'No posts yet. Be the first!' },
    newPost: { title: 'New Post', topicPlaceholder: 'Topic', descriptionPlaceholder: 'Description', category: 'Category', addPhoto: 'Add Photo', post: 'Publish' },
    forum: { title: 'Forum', empty: 'No questions yet. Ask the first one!', answered: 'Answered', ask: 'Ask a Question' },
    discussion: { acceptedAnswer: 'Accepted answer', markHelped: 'This helped' },
    notifications: { accepted: 'accepted your answer' },
    rank: { novice: 'Novice', helper: 'Helper', expert: 'Expert', master: 'Master', guru: 'Guru', points: 'Points: {{count}}' },
    errors: { fillTitleAndDescription: 'Please fill in the topic and description.' },
  },
  ru: {
    categories: { all: 'Всё', news: 'Новости', events: 'Мероприятия', places: 'Стоит посетить' },
    feed: { emptyPosts: 'Пока нет постов. Будьте первым!' },
    newPost: { title: 'Новый пост', topicPlaceholder: 'Тема', descriptionPlaceholder: 'Описание', category: 'Категория', addPhoto: 'Добавить фото', post: 'Опубликовать' },
    forum: { title: 'Форум', empty: 'Пока нет вопросов. Задайте первый!', answered: 'Отвечено', ask: 'Задать вопрос' },
    discussion: { acceptedAnswer: 'Принятый ответ', markHelped: 'Ответ помог' },
    notifications: { accepted: 'принял(а) ваш ответ' },
    rank: { novice: 'Новичок', helper: 'Помощник', expert: 'Знаток', master: 'Мастер', guru: 'Гуру', points: 'Баллы: {{count}}' },
    errors: { fillTitleAndDescription: 'Заполните тему и описание.' },
  },
  az: {
    categories: { all: 'Hamısı', news: 'Xəbərlər', events: 'Tədbirlər', places: 'Görməyə dəyər' },
    feed: { emptyPosts: 'Hələ paylaşım yoxdur. İlk siz olun!' },
    newPost: { title: 'Yeni paylaşım', topicPlaceholder: 'Mövzu', descriptionPlaceholder: 'Təsvir', category: 'Kateqoriya', addPhoto: 'Şəkil əlavə et', post: 'Paylaş' },
    forum: { title: 'Forum', empty: 'Hələ sual yoxdur. İlk sualı siz verin!', answered: 'Cavablandı', ask: 'Sual ver' },
    discussion: { acceptedAnswer: 'Qəbul edilmiş cavab', markHelped: 'Cavab kömək etdi' },
    notifications: { accepted: 'cavabınızı qəbul etdi' },
    rank: { novice: 'Yeni başlayan', helper: 'Köməkçi', expert: 'Bilici', master: 'Usta', guru: 'Quru', points: 'Xallar: {{count}}' },
    errors: { fillTitleAndDescription: 'Mövzu və təsviri doldurun.' },
  },
  zh: {
    categories: { all: '全部', news: '新闻', events: '活动', places: '值得一去' },
    feed: { emptyPosts: '暂无帖子，来发布第一条吧！' },
    newPost: { title: '新帖子', topicPlaceholder: '主题', descriptionPlaceholder: '描述', category: '分类', addPhoto: '添加照片', post: '发布' },
    forum: { title: '论坛', empty: '暂无问题，来提出第一个吧！', answered: '已解答', ask: '提问' },
    discussion: { acceptedAnswer: '已采纳的回答', markHelped: '此回答有帮助' },
    notifications: { accepted: '采纳了你的回答' },
    rank: { novice: '新手', helper: '助人者', expert: '行家', master: '大师', guru: '大神', points: '积分：{{count}}' },
    errors: { fillTitleAndDescription: '请填写主题和描述。' },
  },
  es: {
    categories: { all: 'Todo', news: 'Noticias', events: 'Eventos', places: 'Vale la pena visitar' },
    feed: { emptyPosts: 'Aún no hay publicaciones. ¡Sé el primero!' },
    newPost: { title: 'Nueva publicación', topicPlaceholder: 'Tema', descriptionPlaceholder: 'Descripción', category: 'Categoría', addPhoto: 'Añadir foto', post: 'Publicar' },
    forum: { title: 'Foro', empty: 'Aún no hay preguntas. ¡Haz la primera!', answered: 'Respondida', ask: 'Hacer una pregunta' },
    discussion: { acceptedAnswer: 'Respuesta aceptada', markHelped: 'Me ayudó' },
    notifications: { accepted: 'aceptó tu respuesta' },
    rank: { novice: 'Novato', helper: 'Ayudante', expert: 'Experto', master: 'Maestro', guru: 'Gurú', points: 'Puntos: {{count}}' },
    errors: { fillTitleAndDescription: 'Completa el tema y la descripción.' },
  },
  ar: {
    categories: { all: 'الكل', news: 'أخبار', events: 'فعاليات', places: 'يستحق الزيارة' },
    feed: { emptyPosts: 'لا توجد منشورات بعد. كن أول من ينشر!' },
    newPost: { title: 'منشور جديد', topicPlaceholder: 'الموضوع', descriptionPlaceholder: 'الوصف', category: 'الفئة', addPhoto: 'إضافة صورة', post: 'نشر' },
    forum: { title: 'المنتدى', empty: 'لا توجد أسئلة بعد. اطرح أول سؤال!', answered: 'تمت الإجابة', ask: 'اطرح سؤالاً' },
    discussion: { acceptedAnswer: 'الإجابة المقبولة', markHelped: 'هذه الإجابة ساعدتني' },
    notifications: { accepted: 'قبل إجابتك' },
    rank: { novice: 'مبتدئ', helper: 'مساعد', expert: 'خبير', master: 'محترف', guru: 'جورو', points: 'النقاط: {{count}}' },
    errors: { fillTitleAndDescription: 'يرجى ملء الموضوع والوصف.' },
  },
  hi: {
    categories: { all: 'सभी', news: 'समाचार', events: 'कार्यक्रम', places: 'घूमने लायक' },
    feed: { emptyPosts: 'अभी कोई पोस्ट नहीं। पहले बनें!' },
    newPost: { title: 'नई पोस्ट', topicPlaceholder: 'विषय', descriptionPlaceholder: 'विवरण', category: 'श्रेणी', addPhoto: 'फोटो जोड़ें', post: 'प्रकाशित करें' },
    forum: { title: 'फ़ोरम', empty: 'अभी कोई सवाल नहीं। पहला सवाल पूछें!', answered: 'उत्तर मिला', ask: 'सवाल पूछें' },
    discussion: { acceptedAnswer: 'स्वीकृत उत्तर', markHelped: 'इससे मदद मिली' },
    notifications: { accepted: 'ने आपका उत्तर स्वीकार किया' },
    rank: { novice: 'नौसिखिया', helper: 'सहायक', expert: 'जानकार', master: 'मास्टर', guru: 'गुरु', points: 'अंक: {{count}}' },
    errors: { fillTitleAndDescription: 'कृपया विषय और विवरण भरें।' },
  },
  pt: {
    categories: { all: 'Tudo', news: 'Notícias', events: 'Eventos', places: 'Vale a pena visitar' },
    feed: { emptyPosts: 'Ainda não há publicações. Seja o primeiro!' },
    newPost: { title: 'Nova publicação', topicPlaceholder: 'Tema', descriptionPlaceholder: 'Descrição', category: 'Categoria', addPhoto: 'Adicionar foto', post: 'Publicar' },
    forum: { title: 'Fórum', empty: 'Ainda não há perguntas. Faça a primeira!', answered: 'Respondida', ask: 'Fazer uma pergunta' },
    discussion: { acceptedAnswer: 'Resposta aceita', markHelped: 'Isso ajudou' },
    notifications: { accepted: 'aceitou sua resposta' },
    rank: { novice: 'Novato', helper: 'Ajudante', expert: 'Especialista', master: 'Mestre', guru: 'Guru', points: 'Pontos: {{count}}' },
    errors: { fillTitleAndDescription: 'Preencha o tema e a descrição.' },
  },
  fr: {
    categories: { all: 'Tout', news: 'Actualités', events: 'Événements', places: 'À visiter' },
    feed: { emptyPosts: 'Pas encore de publications. Soyez le premier !' },
    newPost: { title: 'Nouvelle publication', topicPlaceholder: 'Sujet', descriptionPlaceholder: 'Description', category: 'Catégorie', addPhoto: 'Ajouter une photo', post: 'Publier' },
    forum: { title: 'Forum', empty: 'Pas encore de questions. Posez la première !', answered: 'Répondu', ask: 'Poser une question' },
    discussion: { acceptedAnswer: 'Réponse acceptée', markHelped: "Cela m'a aidé" },
    notifications: { accepted: 'a accepté votre réponse' },
    rank: { novice: 'Débutant', helper: 'Assistant', expert: 'Expert', master: 'Maître', guru: 'Gourou', points: 'Points : {{count}}' },
    errors: { fillTitleAndDescription: 'Veuillez remplir le sujet et la description.' },
  },
  de: {
    categories: { all: 'Alle', news: 'Nachrichten', events: 'Veranstaltungen', places: 'Sehenswert' },
    feed: { emptyPosts: 'Noch keine Beiträge. Sei der Erste!' },
    newPost: { title: 'Neuer Beitrag', topicPlaceholder: 'Thema', descriptionPlaceholder: 'Beschreibung', category: 'Kategorie', addPhoto: 'Foto hinzufügen', post: 'Veröffentlichen' },
    forum: { title: 'Forum', empty: 'Noch keine Fragen. Stelle die erste!', answered: 'Beantwortet', ask: 'Frage stellen' },
    discussion: { acceptedAnswer: 'Akzeptierte Antwort', markHelped: 'Hat geholfen' },
    notifications: { accepted: 'hat deine Antwort akzeptiert' },
    rank: { novice: 'Neuling', helper: 'Helfer', expert: 'Experte', master: 'Meister', guru: 'Guru', points: 'Punkte: {{count}}' },
    errors: { fillTitleAndDescription: 'Bitte Thema und Beschreibung ausfüllen.' },
  },
  tr: {
    categories: { all: 'Tümü', news: 'Haberler', events: 'Etkinlikler', places: 'Görülmeye değer' },
    feed: { emptyPosts: 'Henüz gönderi yok. İlk sen ol!' },
    newPost: { title: 'Yeni Gönderi', topicPlaceholder: 'Konu', descriptionPlaceholder: 'Açıklama', category: 'Kategori', addPhoto: 'Fotoğraf ekle', post: 'Yayınla' },
    forum: { title: 'Forum', empty: 'Henüz soru yok. İlk soruyu sen sor!', answered: 'Yanıtlandı', ask: 'Soru Sor' },
    discussion: { acceptedAnswer: 'Kabul edilen yanıt', markHelped: 'Bu yardımcı oldu' },
    notifications: { accepted: 'yanıtını kabul etti' },
    rank: { novice: 'Acemi', helper: 'Yardımcı', expert: 'Uzman', master: 'Usta', guru: 'Guru', points: 'Puan: {{count}}' },
    errors: { fillTitleAndDescription: 'Lütfen konu ve açıklamayı doldurun.' },
  },
  ja: {
    categories: { all: 'すべて', news: 'ニュース', events: 'イベント', places: 'おすすめスポット' },
    feed: { emptyPosts: 'まだ投稿がありません。最初の投稿をしましょう！' },
    newPost: { title: '新しい投稿', topicPlaceholder: 'トピック', descriptionPlaceholder: '説明', category: 'カテゴリー', addPhoto: '写真を追加', post: '投稿する' },
    forum: { title: 'フォーラム', empty: 'まだ質問がありません。最初の質問をしましょう！', answered: '解決済み', ask: '質問する' },
    discussion: { acceptedAnswer: 'ベストアンサー', markHelped: '役に立った' },
    notifications: { accepted: 'があなたの回答を採用しました' },
    rank: { novice: '初心者', helper: 'ヘルパー', expert: 'エキスパート', master: 'マスター', guru: 'グル', points: 'ポイント：{{count}}' },
    errors: { fillTitleAndDescription: 'トピックと説明を入力してください。' },
  },
  ko: {
    categories: { all: '전체', news: '뉴스', events: '이벤트', places: '가볼 만한 곳' },
    feed: { emptyPosts: '아직 게시물이 없습니다. 첫 게시물을 올려보세요!' },
    newPost: { title: '새 게시물', topicPlaceholder: '주제', descriptionPlaceholder: '설명', category: '카테고리', addPhoto: '사진 추가', post: '게시' },
    forum: { title: '포럼', empty: '아직 질문이 없습니다. 첫 질문을 해보세요!', answered: '답변 완료', ask: '질문하기' },
    discussion: { acceptedAnswer: '채택된 답변', markHelped: '도움이 됐어요' },
    notifications: { accepted: '님이 회원님의 답변을 채택했습니다' },
    rank: { novice: '새내기', helper: '도우미', expert: '전문가', master: '마스터', guru: '구루', points: '포인트: {{count}}' },
    errors: { fillTitleAndDescription: '주제와 설명을 입력해 주세요.' },
  },
  it: {
    categories: { all: 'Tutto', news: 'Notizie', events: 'Eventi', places: 'Da visitare' },
    feed: { emptyPosts: 'Ancora nessun post. Sii il primo!' },
    newPost: { title: 'Nuovo post', topicPlaceholder: 'Argomento', descriptionPlaceholder: 'Descrizione', category: 'Categoria', addPhoto: 'Aggiungi foto', post: 'Pubblica' },
    forum: { title: 'Forum', empty: 'Ancora nessuna domanda. Fai la prima!', answered: 'Risposta data', ask: 'Fai una domanda' },
    discussion: { acceptedAnswer: 'Risposta accettata', markHelped: 'Mi ha aiutato' },
    notifications: { accepted: 'ha accettato la tua risposta' },
    rank: { novice: 'Novizio', helper: 'Aiutante', expert: 'Esperto', master: 'Maestro', guru: 'Guru', points: 'Punti: {{count}}' },
    errors: { fillTitleAndDescription: 'Compila argomento e descrizione.' },
  },
  pl: {
    categories: { all: 'Wszystko', news: 'Aktualności', events: 'Wydarzenia', places: 'Warto odwiedzić' },
    feed: { emptyPosts: 'Brak postów. Bądź pierwszy!' },
    newPost: { title: 'Nowy post', topicPlaceholder: 'Temat', descriptionPlaceholder: 'Opis', category: 'Kategoria', addPhoto: 'Dodaj zdjęcie', post: 'Opublikuj' },
    forum: { title: 'Forum', empty: 'Brak pytań. Zadaj pierwsze!', answered: 'Odpowiedziano', ask: 'Zadaj pytanie' },
    discussion: { acceptedAnswer: 'Zaakceptowana odpowiedź', markHelped: 'To pomogło' },
    notifications: { accepted: 'zaakceptował(a) twoją odpowiedź' },
    rank: { novice: 'Nowicjusz', helper: 'Pomocnik', expert: 'Ekspert', master: 'Mistrz', guru: 'Guru', points: 'Punkty: {{count}}' },
    errors: { fillTitleAndDescription: 'Wypełnij temat i opis.' },
  },
  uk: {
    categories: { all: 'Все', news: 'Новини', events: 'Заходи', places: 'Варто відвідати' },
    feed: { emptyPosts: 'Поки немає дописів. Будьте першим!' },
    newPost: { title: 'Новий допис', topicPlaceholder: 'Тема', descriptionPlaceholder: 'Опис', category: 'Категорія', addPhoto: 'Додати фото', post: 'Опублікувати' },
    forum: { title: 'Форум', empty: 'Поки немає запитань. Поставте перше!', answered: 'Відповідь є', ask: 'Поставити запитання' },
    discussion: { acceptedAnswer: 'Прийнята відповідь', markHelped: 'Відповідь допомогла' },
    notifications: { accepted: 'прийняв(ла) вашу відповідь' },
    rank: { novice: 'Новачок', helper: 'Помічник', expert: 'Знавець', master: 'Майстер', guru: 'Гуру', points: 'Бали: {{count}}' },
    errors: { fillTitleAndDescription: 'Заповніть тему та опис.' },
  },
  id: {
    categories: { all: 'Semua', news: 'Berita', events: 'Acara', places: 'Layak dikunjungi' },
    feed: { emptyPosts: 'Belum ada postingan. Jadilah yang pertama!' },
    newPost: { title: 'Postingan Baru', topicPlaceholder: 'Topik', descriptionPlaceholder: 'Deskripsi', category: 'Kategori', addPhoto: 'Tambah Foto', post: 'Terbitkan' },
    forum: { title: 'Forum', empty: 'Belum ada pertanyaan. Ajukan yang pertama!', answered: 'Terjawab', ask: 'Ajukan Pertanyaan' },
    discussion: { acceptedAnswer: 'Jawaban diterima', markHelped: 'Ini membantu' },
    notifications: { accepted: 'menerima jawaban Anda' },
    rank: { novice: 'Pemula', helper: 'Penolong', expert: 'Ahli', master: 'Master', guru: 'Guru', points: 'Poin: {{count}}' },
    errors: { fillTitleAndDescription: 'Harap isi topik dan deskripsi.' },
  },
  nl: {
    categories: { all: 'Alles', news: 'Nieuws', events: 'Evenementen', places: 'De moeite waard' },
    feed: { emptyPosts: 'Nog geen berichten. Wees de eerste!' },
    newPost: { title: 'Nieuw bericht', topicPlaceholder: 'Onderwerp', descriptionPlaceholder: 'Beschrijving', category: 'Categorie', addPhoto: 'Foto toevoegen', post: 'Publiceren' },
    forum: { title: 'Forum', empty: 'Nog geen vragen. Stel de eerste!', answered: 'Beantwoord', ask: 'Stel een vraag' },
    discussion: { acceptedAnswer: 'Geaccepteerd antwoord', markHelped: 'Dit hielp' },
    notifications: { accepted: 'heeft je antwoord geaccepteerd' },
    rank: { novice: 'Beginner', helper: 'Helper', expert: 'Expert', master: 'Meester', guru: 'Goeroe', points: 'Punten: {{count}}' },
    errors: { fillTitleAndDescription: 'Vul het onderwerp en de beschrijving in.' },
  },
  vi: {
    categories: { all: 'Tất cả', news: 'Tin tức', events: 'Sự kiện', places: 'Đáng ghé thăm' },
    feed: { emptyPosts: 'Chưa có bài viết nào. Hãy là người đầu tiên!' },
    newPost: { title: 'Bài viết mới', topicPlaceholder: 'Chủ đề', descriptionPlaceholder: 'Mô tả', category: 'Danh mục', addPhoto: 'Thêm ảnh', post: 'Đăng' },
    forum: { title: 'Diễn đàn', empty: 'Chưa có câu hỏi nào. Hãy đặt câu hỏi đầu tiên!', answered: 'Đã trả lời', ask: 'Đặt câu hỏi' },
    discussion: { acceptedAnswer: 'Câu trả lời được chấp nhận', markHelped: 'Hữu ích' },
    notifications: { accepted: 'đã chấp nhận câu trả lời của bạn' },
    rank: { novice: 'Người mới', helper: 'Người trợ giúp', expert: 'Chuyên gia', master: 'Bậc thầy', guru: 'Guru', points: 'Điểm: {{count}}' },
    errors: { fillTitleAndDescription: 'Vui lòng điền chủ đề và mô tả.' },
  },
  fa: {
    categories: { all: 'همه', news: 'اخبار', events: 'رویدادها', places: 'ارزش دیدن دارد' },
    feed: { emptyPosts: 'هنوز پستی وجود ندارد. اولین نفر باشید!' },
    newPost: { title: 'پست جدید', topicPlaceholder: 'موضوع', descriptionPlaceholder: 'توضیحات', category: 'دسته‌بندی', addPhoto: 'افزودن عکس', post: 'انتشار' },
    forum: { title: 'انجمن', empty: 'هنوز سوالی وجود ندارد. اولین سوال را بپرسید!', answered: 'پاسخ داده شد', ask: 'پرسیدن سوال' },
    discussion: { acceptedAnswer: 'پاسخ پذیرفته‌شده', markHelped: 'این کمک کرد' },
    notifications: { accepted: 'پاسخ شما را پذیرفت' },
    rank: { novice: 'تازه‌کار', helper: 'یاور', expert: 'کارشناس', master: 'استاد', guru: 'گورو', points: 'امتیاز: {{count}}' },
    errors: { fillTitleAndDescription: 'لطفاً موضوع و توضیحات را پر کنید.' },
  },
  ro: {
    categories: { all: 'Tot', news: 'Știri', events: 'Evenimente', places: 'Merită vizitat' },
    feed: { emptyPosts: 'Încă nu există postări. Fii primul!' },
    newPost: { title: 'Postare nouă', topicPlaceholder: 'Subiect', descriptionPlaceholder: 'Descriere', category: 'Categorie', addPhoto: 'Adaugă fotografie', post: 'Publică' },
    forum: { title: 'Forum', empty: 'Încă nu există întrebări. Pune prima!', answered: 'Răspuns primit', ask: 'Pune o întrebare' },
    discussion: { acceptedAnswer: 'Răspuns acceptat', markHelped: 'M-a ajutat' },
    notifications: { accepted: 'ți-a acceptat răspunsul' },
    rank: { novice: 'Începător', helper: 'Ajutor', expert: 'Expert', master: 'Maestru', guru: 'Guru', points: 'Puncte: {{count}}' },
    errors: { fillTitleAndDescription: 'Completează subiectul și descrierea.' },
  },
  cs: {
    categories: { all: 'Vše', news: 'Novinky', events: 'Akce', places: 'Stojí za návštěvu' },
    feed: { emptyPosts: 'Zatím žádné příspěvky. Buďte první!' },
    newPost: { title: 'Nový příspěvek', topicPlaceholder: 'Téma', descriptionPlaceholder: 'Popis', category: 'Kategorie', addPhoto: 'Přidat fotku', post: 'Zveřejnit' },
    forum: { title: 'Fórum', empty: 'Zatím žádné otázky. Položte první!', answered: 'Zodpovězeno', ask: 'Položit otázku' },
    discussion: { acceptedAnswer: 'Přijatá odpověď', markHelped: 'Pomohlo mi to' },
    notifications: { accepted: 'přijal(a) vaši odpověď' },
    rank: { novice: 'Nováček', helper: 'Pomocník', expert: 'Znalec', master: 'Mistr', guru: 'Guru', points: 'Body: {{count}}' },
    errors: { fillTitleAndDescription: 'Vyplňte téma a popis.' },
  },
  sv: {
    categories: { all: 'Allt', news: 'Nyheter', events: 'Evenemang', places: 'Värt ett besök' },
    feed: { emptyPosts: 'Inga inlägg än. Bli först!' },
    newPost: { title: 'Nytt inlägg', topicPlaceholder: 'Ämne', descriptionPlaceholder: 'Beskrivning', category: 'Kategori', addPhoto: 'Lägg till foto', post: 'Publicera' },
    forum: { title: 'Forum', empty: 'Inga frågor än. Ställ den första!', answered: 'Besvarad', ask: 'Ställ en fråga' },
    discussion: { acceptedAnswer: 'Accepterat svar', markHelped: 'Det hjälpte' },
    notifications: { accepted: 'accepterade ditt svar' },
    rank: { novice: 'Nybörjare', helper: 'Hjälpare', expert: 'Expert', master: 'Mästare', guru: 'Guru', points: 'Poäng: {{count}}' },
    errors: { fillTitleAndDescription: 'Fyll i ämne och beskrivning.' },
  },
  he: {
    categories: { all: 'הכול', news: 'חדשות', events: 'אירועים', places: 'שווה ביקור' },
    feed: { emptyPosts: 'אין עדיין פוסטים. היו הראשונים!' },
    newPost: { title: 'פוסט חדש', topicPlaceholder: 'נושא', descriptionPlaceholder: 'תיאור', category: 'קטגוריה', addPhoto: 'הוספת תמונה', post: 'פרסום' },
    forum: { title: 'פורום', empty: 'אין עדיין שאלות. שאלו את הראשונה!', answered: 'נענתה', ask: 'שאלו שאלה' },
    discussion: { acceptedAnswer: 'תשובה מאושרת', markHelped: 'זה עזר' },
    notifications: { accepted: 'אישר/ה את התשובה שלך' },
    rank: { novice: 'מתחיל', helper: 'עוזר', expert: 'מומחה', master: 'מאסטר', guru: 'גורו', points: 'נקודות: {{count}}' },
    errors: { fillTitleAndDescription: 'נא למלא נושא ותיאור.' },
  },
  th: {
    categories: { all: 'ทั้งหมด', news: 'ข่าว', events: 'กิจกรรม', places: 'น่าไปเยือน' },
    feed: { emptyPosts: 'ยังไม่มีโพสต์ มาเป็นคนแรกกัน!' },
    newPost: { title: 'โพสต์ใหม่', topicPlaceholder: 'หัวข้อ', descriptionPlaceholder: 'คำอธิบาย', category: 'หมวดหมู่', addPhoto: 'เพิ่มรูปภาพ', post: 'เผยแพร่' },
    forum: { title: 'ฟอรัม', empty: 'ยังไม่มีคำถาม มาถามเป็นคนแรกกัน!', answered: 'ตอบแล้ว', ask: 'ถามคำถาม' },
    discussion: { acceptedAnswer: 'คำตอบที่ได้รับการยอมรับ', markHelped: 'คำตอบนี้ช่วยได้' },
    notifications: { accepted: 'ยอมรับคำตอบของคุณ' },
    rank: { novice: 'มือใหม่', helper: 'ผู้ช่วย', expert: 'ผู้เชี่ยวชาญ', master: 'ปรมาจารย์', guru: 'กูรู', points: 'คะแนน: {{count}}' },
    errors: { fillTitleAndDescription: 'กรุณากรอกหัวข้อและคำอธิบาย' },
  },
  ms: {
    categories: { all: 'Semua', news: 'Berita', events: 'Acara', places: 'Patut dilawati' },
    feed: { emptyPosts: 'Belum ada kiriman. Jadilah yang pertama!' },
    newPost: { title: 'Kiriman Baharu', topicPlaceholder: 'Topik', descriptionPlaceholder: 'Penerangan', category: 'Kategori', addPhoto: 'Tambah Foto', post: 'Terbitkan' },
    forum: { title: 'Forum', empty: 'Belum ada soalan. Tanya yang pertama!', answered: 'Dijawab', ask: 'Tanya Soalan' },
    discussion: { acceptedAnswer: 'Jawapan diterima', markHelped: 'Ini membantu' },
    notifications: { accepted: 'menerima jawapan anda' },
    rank: { novice: 'Orang baru', helper: 'Pembantu', expert: 'Pakar', master: 'Mahir', guru: 'Guru', points: 'Mata: {{count}}' },
    errors: { fillTitleAndDescription: 'Sila isi topik dan penerangan.' },
  },
  bn: {
    categories: { all: 'সব', news: 'খবর', events: 'ইভেন্ট', places: 'ঘুরে দেখার মতো' },
    feed: { emptyPosts: 'এখনও কোনো পোস্ট নেই। প্রথম হোন!' },
    newPost: { title: 'নতুন পোস্ট', topicPlaceholder: 'বিষয়', descriptionPlaceholder: 'বিবরণ', category: 'ক্যাটাগরি', addPhoto: 'ছবি যোগ করুন', post: 'প্রকাশ করুন' },
    forum: { title: 'ফোরাম', empty: 'এখনও কোনো প্রশ্ন নেই। প্রথম প্রশ্নটি করুন!', answered: 'উত্তর দেওয়া হয়েছে', ask: 'প্রশ্ন করুন' },
    discussion: { acceptedAnswer: 'গৃহীত উত্তর', markHelped: 'এটি সাহায্য করেছে' },
    notifications: { accepted: 'আপনার উত্তর গ্রহণ করেছেন' },
    rank: { novice: 'নবাগত', helper: 'সাহায্যকারী', expert: 'বিশেষজ্ঞ', master: 'মাস্টার', guru: 'গুরু', points: 'পয়েন্ট: {{count}}' },
    errors: { fillTitleAndDescription: 'অনুগ্রহ করে বিষয় ও বিবরণ পূরণ করুন।' },
  },
};

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      target[key] = deepMerge(target[key] ?? {}, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

const localesDir = path.join(__dirname, '..', 'src', 'locales');
let updated = 0;
for (const [lang, additions] of Object.entries(T)) {
  const file = path.join(localesDir, lang, 'translation.json');
  if (!fs.existsSync(file)) {
    console.error(`MISSING: ${file}`);
    process.exitCode = 1;
    continue;
  }
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  deepMerge(json, additions);
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
  updated++;
}
console.log(`Updated ${updated} locale files.`);
