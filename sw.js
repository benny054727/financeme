/* FinanceMe — Service Worker
   קובץ נפרד יחיד לצד index.html, בהכרח: כרום מסרב לרשום Service Worker
   מ-blob: URL, אז אין דרך לשמור אותו מוטמע בתוך קובץ ה-HTML.
   אסטרטגיה: network-first עם נפילה ל-cache — כשיש אינטרנט תמיד נטען הגרסה
   העדכנית (וגם נשמרת ל-cache), וכשאין — נטען מה-cache, כדי שהאפליקציה תיפתח
   גם אופליין אחרי ביקור ראשון. */
const CACHE = 'financeme-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.add('./index.html')));
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
