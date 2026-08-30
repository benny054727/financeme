/* FinanceMe — Service Worker
   קובץ נפרד יחיד לצד index.html, בהכרח: כרום מסרב לרשום Service Worker
   מ-blob: URL, אז אין דרך לשמור אותו מוטמע בתוך קובץ ה-HTML.
   אסטרטגיה: network-first עם נפילה ל-cache — כשיש אינטרנט תמיד נטען הגרסה
   העדכנית (וגם נשמרת ל-cache), וכשאין — נטען מה-cache, כדי שהאפליקציה תיפתח
   גם אופליין אחרי ביקור ראשון.
   הערה חשובה: fetch עם cache:'no-store' — בלי זה, "network-first" הפך בפועל
   ל"קאש-first" בלי כוונה: fetch() רגיל מכבד את כותרות ה-Cache-Control של GitHub
   Pages ומחזיר תשובה מהקאש של הדפדפן בלי לגעת ברשת בכלל, כך שעדכוני קוד לא
   הגיעו למשתמש גם אחרי רענון וגם אחרי שה-SW "ניסה" לבדוק ברשת. */
// v4: הרבה תכונות/קבצים חדשים מאז v3 (הלוואות, מצב כהה, נעילה אוטומטית,
// שעון ישראל...) — קופצים גרסה כדי לאלץ את ה-SW עצמו להתעדכן ולהריץ activate()
// (מנקה קאש ישן) אצל משתמשים שהדפדפן שלהם עוד לא בדק שיש SW חדש. שים לב:
// זה לא הפתרון היחיד לעדכונים — ה-fetch handler למטה כבר עושה network-first
// עם cache:'no-store' בעצמו, אז תוכן חדש אמור להגיע גם בלי לקפוץ גרסה כאן;
// זו שכבת הגנה נוספת, לא התלות היחידה.
const CACHE = 'financeme-v4';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.add('./index.html')));
});

self.addEventListener('activate', e => {
  e.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  ]));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
