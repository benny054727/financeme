/* ============================================================
   9. APP
   ============================================================ */
/* מצב כהה — הבחירה המפורשת (אם יש) נשמרת ב-localStorage בלבד, לא ב-DB/בענן:
   זו העדפת-תצוגה של המכשיר הזה, לא נתון פיננסי שצריך להסתנכרן בין מכשירים
   (מישהו יכול לרצות כהה בטלפון ובהיר במחשב, בדיוק כמו שדפדפנים אחרים
   מתנהגים). ברירת המחדל (בלי בחירה מפורשת) עוקבת אחרי prefers-color-scheme
   של המערכת — ראו style.css. ה"הקדמה" הקריטית-לתזמון שמונעת הבזק של המצב
   הלא-נכון ברענון היא ב-index.html (<head>, לפני טעינת ה-CSS).
   currentEffectiveTheme(): מה שבאמת מוצג עכשיו — הבחירה המפורשת אם יש,
   אחרת מה שהמערכת אומרת כרגע. */
function currentEffectiveTheme(){
  const explicit=document.documentElement.getAttribute('data-theme');
  if(explicit)return explicit;
  return (window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';
}
function applyTheme(theme){ // theme: 'light'|'dark'|null (null=עוקב אחרי המערכת)
  if(theme)document.documentElement.setAttribute('data-theme',theme);
  else document.documentElement.removeAttribute('data-theme');
  try{if(theme)localStorage.setItem('financeme_theme',theme);else localStorage.removeItem('financeme_theme');}catch(e){}
  updateThemeIcon();
}
// לחיצה אחת = הפוך למה שאתה *לא* רואה כרגע (בין אם זה קרה כי בחרת ידנית
// קודם, ובין אם זו רק ברירת המחדל של המערכת) — לא תפריט תלת-מצבי, כי רוב
// המשתמשים רוצים "תחליף לי את זה" ולא צריכים לבחור בין 3 אפשרויות בכל פעם
function toggleTheme(){applyTheme(currentEffectiveTheme()==='dark'?'light':'dark');}
function updateThemeIcon(){
  const btn=el('themeToggle');if(!btn)return;
  const eff=currentEffectiveTheme();
  // האייקון תמיד מציג לאן הלחיצה הבאה תיקח אותך (כמו מתג הפעלה/כיבוי), לא את המצב הנוכחי
  btn.textContent=eff==='dark'?'☀️':'🌙';
  btn.setAttribute('aria-label',eff==='dark'?'עבור למצב בהיר':'עבור למצב כהה');
}
updateThemeIcon();
if(window.matchMedia)window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{
  if(!document.documentElement.getAttribute('data-theme'))updateThemeIcon(); // רק אם עוקבים אחרי המערכת (אין בחירה מפורשת)
});

document.querySelectorAll('nav button[data-p]').forEach(b=>{
  b.onclick=()=>{PAGE=b.dataset.p;selYM=null;render();};
});
function boot(){
  el('setup').classList.add('hide');el('app').classList.remove('hide');
  el('nav').classList.remove('hide');el('fab').classList.remove('hide');
  genRecurring();genLoanPayments();render();
}
(async function init(){
  const {data:{session}}=await sb.auth.getSession();
  if(session&&session.user){
    CURRENT_USER=session.user;
    await startApp();
  }else{
    showLogin();
  }
  sb.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_IN'&&session&&!CURRENT_USER){
      CURRENT_USER=session.user;
      el('login').classList.add('hide');
      startApp();
    }else if(event==='SIGNED_OUT'){
      CURRENT_USER=null;
      location.reload();
    }
  });
})();

/* PWA אופליין: נבדק בפועל — כרום מסרב לרשום Service Worker מ-blob: URL
   ("URL protocol ... is not supported"), אז אי אפשר לשמור על "קובץ אחד" טהור פה.
   sw.js הוא קובץ נפרד לצד index.html (חריגה מודעת לעיקרון מסעיף 2.1 —
   אין ברירה טכנית אחרת לאופליין אמיתי). דורש הקשר מאובטח (https/localhost) —
   לא עובד מ-file://, ונכשל בשקט אם חסום (חלק מגרסאות iOS Safari). */
if('serviceWorker' in navigator && location.protocol!=='file:'){
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
