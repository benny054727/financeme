/* ============================================================
   9. APP
   ============================================================ */
/* ============================================================
   מצב כהה — אוטומטי לפי זריחה/שקיעה בישראל (לא לפי prefers-color-scheme
   של המערכת יותר — המשתמש ביקש במפורש "כהה לפי השקיעה, בהיר לפי הזריחה").
   נקודת ייחוס: ירושלים (31.78°N, 35.22°E) — ישראל קטנה מספיק שההבדל בין
   קצוות הארץ הוא דקה-שתיים, לא משנה בפועל לאפליקציה אישית.
   חישוב הזריחה/שקיעה הוא הנוסחה האסטרונומית הסטנדרטית ("שוויון הזריחה" —
   אותה נוסחה שספריות כמו SunCalc משתמשות בה, מדויקת לדקה בערך), לא קריאה
   לשרת חיצוני — עובד גם אופליין, עקבי עם שאר האפליקציה (אין תלות רשת
   חוץ מ-Supabase).
   שכבות עדיפות (מ-style.css): [data-theme] קובע איזה טוקנים בתוקף.
   הבחירה המפורשת (localStorage בלבד, לא ב-DB/ענן — זו העדפת-תצוגה של
   המכשיר, לא נתון פיננסי) מנצחת תמיד; בלעדיה, data-theme מחושב-מחדש כל
   דקה לפי השעה האמיתית בישראל, כדי שהאפליקציה תעבור לכהה "לבד" בדיוק
   בשקיעה גם אם השארת אותה פתוחה. ============================================================ */
const IL_LAT=31.78, IL_LNG=35.22;
function sunTimesIsrael(date){
  // "שוויון הזריחה" הסטנדרטי — כל הפונקציות הפנימיות בקירוב מעלות/רדיאנים
  const rad=Math.PI/180, dayMs=86400000, J1970=2440588, J2000=2451545, obliquity=rad*23.4397;
  const toJulian=d=>d.getTime()/dayMs-0.5+J1970;
  const fromJulian=j=>new Date((j+0.5-J1970)*dayMs);
  const toDays=d=>toJulian(d)-J2000;
  const solarMeanAnomaly=d=>rad*(357.5291+0.98560028*d);
  const eclipticLongitude=M=>{
    const C=rad*(1.9148*Math.sin(M)+0.02*Math.sin(2*M)+0.0003*Math.sin(3*M));
    return M+C+rad*102.9372+Math.PI;
  };
  const declination=l=>Math.asin(Math.sin(l)*Math.sin(obliquity));
  const julianCycle=(d,lw)=>Math.round(d-0.0009-lw/(2*Math.PI));
  const approxTransit=(Ht,lw,n)=>0.0009+(Ht+lw)/(2*Math.PI)+n;
  const solarTransitJ=(ds,M,L)=>J2000+ds+0.0053*Math.sin(M)-0.0069*Math.sin(2*L);
  const hourAngle=(h,phi,d)=>Math.acos((Math.sin(h)-Math.sin(phi)*Math.sin(d))/(Math.cos(phi)*Math.cos(d)));
  const lw=rad*(-IL_LNG), phi=rad*IL_LAT, d=toDays(date);
  const n=julianCycle(d,lw), ds=approxTransit(0,lw,n);
  const M=solarMeanAnomaly(ds), L=eclipticLongitude(M), dec=declination(L);
  const Jnoon=solarTransitJ(ds,M,L);
  const w=hourAngle(-0.833*rad,phi,dec);
  const Jset=solarTransitJ(approxTransit(w,lw,n),M,L);
  const Jrise=Jnoon-(Jset-Jnoon);
  return {sunrise:fromJulian(Jrise),sunset:fromJulian(Jset)};
}
function isDarkNowInIsrael(){
  const now=new Date(),t=sunTimesIsrael(now);
  return now<t.sunrise||now>=t.sunset;
}
function israelTimeString(){
  try{return new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());}
  catch(e){return '--:--:--';}
}
function currentEffectiveTheme(){return document.documentElement.getAttribute('data-theme')||(isDarkNowInIsrael()?'dark':'light');}
// מחשב מחדש את המצב האוטומטי (רק אם אין בחירה מפורשת שמורה) ומחיל אותו —
// נקרא מיד בעליית הדף וגם כל דקה, כדי ש"כהה בשקיעה" יקרה בלי לרענן ידנית
function refreshAutoTheme(){
  let explicit=null;
  try{explicit=localStorage.getItem('financeme_theme');}catch(e){}
  const theme=(explicit==='light'||explicit==='dark')?explicit:(isDarkNowInIsrael()?'dark':'light');
  document.documentElement.setAttribute('data-theme',theme);
  updateThemeIcon();
}
// לחיצה אחת = הפוך למה שאתה *לא* רואה כרגע, ושמור כבחירה מפורשת (עוצר את
// המעקב האוטומטי אחרי השקיעה/זריחה עד שתלחץ שוב) — לא תפריט תלת-מצבי, כי
// רוב המשתמשים רוצים "תחליף לי את זה" ולא לבחור בין כמה אפשרויות כל פעם
function toggleTheme(){
  const next=currentEffectiveTheme()==='dark'?'light':'dark';
  try{localStorage.setItem('financeme_theme',next);}catch(e){}
  refreshAutoTheme();
}
function updateThemeIcon(){
  const btn=el('themeToggle');if(!btn)return;
  const eff=currentEffectiveTheme();
  // האייקון תמיד מציג לאן הלחיצה הבאה תיקח אותך (כמו מתג הפעלה/כיבוי), לא את המצב הנוכחי
  btn.textContent=eff==='dark'?'☀️':'🌙';
  btn.setAttribute('aria-label',eff==='dark'?'עבור למצב בהיר':'עבור למצב כהה');
}
// שעון חי (שעון ישראל) בכרטיס הברכה בדף הבית — מתעדכן כל שנייה ישירות על
// האלמנט (לא דרך render() מלא, כדי לא להפעיל מחדש כל אנימציה/מצב בעמוד כל
// שנייה). no-op אם לא בדף הבית כרגע (האלמנט לא קיים ב-DOM).
function tickClock(){const c=el('liveClock');if(c)c.textContent=israelTimeString();}
refreshAutoTheme();
setInterval(tickClock,1000);
setInterval(refreshAutoTheme,60000);

/* ============================================================
   נעילה אוטומטית מחוסר פעילות (אבטחה) — 5 דקות בלי שום אינטראקציה עם
   האתר = התנתקות אוטומטית, בדיוק כמו אפליקציית בנק: מי שעוזב מכשיר לא-נעול
   ליד מישהו אחר לא משאיר את הנתונים הפיננסיים חשופים על המסך לצמיתות.

   גרסה ראשונה הסתמכה על setTimeout(...,5*60*1000) בודד — לא עבד בפועל
   ("לא מתנתק אפילו כשיוצא מהדף וחוזר") כי דפדפנים (בעיקר מובייל) מדכאים/
   מעכבים טיימרים בטאב שברקע (background tab throttling). תוקן עם
   lastActivity + בדיקת Date.now() בכל הזדמנות (כולל visibilitychange)
   במקום להסתמך על תזמון מדויק — ראו checkIdle() למטה.

   גרסה שנייה (התיקון הזה) מטפלת במקרה נוסף שהתגלה: **סגירת הדפדפן/טאב
   לגמרי** ופתיחה מחדש הרבה יותר מאוחר (המשתמש דיווח: נכנס אתמול, נכנס
   שוב היום — הוחזר ישר לחשבון בלי התחברות מחדש). lastActivity עד עכשיו
   היה משתנה בזיכרון בלבד — נעלם לגמרי כשהטאב נסגר, ולא עוזר בכלל בטעינה
   הבאה: init() רואה ש-Supabase עדיין מחזיק סשן תקף (הטוקן של Supabase לא
   פג תוך יום, זה לא הבעיה) ומשחזר אותו בלי לדעת שבאמת עברו הרבה יותר מ-5
   דקות מאז הפעילות האחרונה. הפתרון: persistActivity() שומרת את lastActivity
   גם ב-localStorage (מוגבל-קצב — לא בכל mousemove, ראו למטה), ו-init()
   בודק את הערך השמור *לפני* שהוא בכלל מחליט לשחזר בשקט סשן קיים. */
const IDLE_LIMIT_MS=5*60*1000, LAST_ACTIVITY_KEY='financeme_last_activity';
let lastActivity=Date.now(), lastPersisted=0;
function persistActivity(force){
  const now=Date.now();
  if(!force&&now-lastPersisted<5000)return; // לא כותבים ל-localStorage על כל תזוזת עכבר
  lastPersisted=now;
  try{localStorage.setItem(LAST_ACTIVITY_KEY,String(lastActivity));}catch(e){}
}
function markActivity(){
  if(!CURRENT_USER)return;
  lastActivity=Date.now();
  persistActivity(false);
}
['mousemove','mousedown','keydown','touchstart','scroll','wheel'].forEach(evt=>{
  document.addEventListener(evt,markActivity,{passive:true});
});
function checkIdle(){
  if(!CURRENT_USER)return;
  if(Date.now()-lastActivity>=IDLE_LIMIT_MS)autoSignOutIdle();
}
// הבדיקה החשובה ביותר: בדיוק כשהטאב חוזר להיות גלוי (יציאה-וחזרה, מעבר בין
// אפליקציות בטלפון וכו') — לפני שהמשתמש הספיק לגעת במסך ול"אפס" את הפעילות.
// וכשהטאב הופך ל-hidden (או pagehide, בסגירה בפועל) — כותבים ל-localStorage
// בכפייה (force) כדי לתפוס את הרגע האחרון שהיה פעיל, לפני שאולי לא נשמע ממנו יותר
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')checkIdle();
  else persistActivity(true);
});
window.addEventListener('pagehide',()=>persistActivity(true));
setInterval(checkIdle,15000);
async function autoSignOutIdle(){
  // מסתירים את האפליקציה מיד — סינכרוני, לפני שממתינים לרשת ל-signOut —
  // כדי שהנתונים הפיננסיים לא יישארו רגע נוסף על המסך במקרה הזה בדיוק
  // (זו בדיוק הסיבה לתכונה: מכשיר לא-נעול שמישהו אחר יכול לגשת אליו)
  try{sessionStorage.setItem('financeme_idle_msg','1');}catch(e){}
  try{localStorage.removeItem(LAST_ACTIVITY_KEY);}catch(e){} // לא להישאר "יתום" ולגרום להתנתקות-מיד גם אחרי התחברות מחדש
  showLogin();
  try{await sb.auth.signOut();}catch(e){}
  CURRENT_USER=null;
  location.reload();
}

document.querySelectorAll('nav button[data-p]').forEach(b=>{
  b.onclick=()=>{PAGE=b.dataset.p;selYM=null;render();};
});
function boot(){
  el('setup').classList.add('hide');el('app').classList.remove('hide');
  el('nav').classList.remove('hide');el('fab').classList.remove('hide');
  genRecurring();genLoanPayments();render();
  markActivity(); // מאפס את שעון הנעילה האוטומטית מהרגע שהאפליקציה בפועל עלתה
}
(async function init(){
  // בדיקת חוסר-פעילות *לפני* שמשחזרים סשן קיים בשקט — ראו הערה למעלה
  // (התיקון השני): בלי זה, סגירת הדפדפן לגמרי ופתיחה מחדש יום אחר כך
  // הייתה מחזירה ישר לחשבון, כי הסשן של Supabase עצמו עדיין תקף — רק
  // lastActivity (בזיכרון) לא שרד את סגירת הטאב, ובלעדיו אין איך לדעת
  // שבאמת עברו הרבה יותר מ-5 דקות.
  let storedLast=null;
  try{const v=localStorage.getItem(LAST_ACTIVITY_KEY);if(v)storedLast=+v;}catch(e){}
  const idleExpired=!!(storedLast&&(Date.now()-storedLast>=IDLE_LIMIT_MS));
  const {data:{session}}=await sb.auth.getSession();
  if(session&&session.user&&!idleExpired){
    CURRENT_USER=session.user;
    await startApp();
  }else{
    if(session&&session.user){
      // הייתה התחברות פעילה בענן, אבל עברו 5+ דקות מאז הפעילות האחרונה
      // שנרשמה (למשל: הדפדפן נסגר לגמרי ונפתח שוב הרבה יותר מאוחר) —
      // לא משחזרים אותה בשקט, מתנתקים גם מהענן במפורש
      try{await sb.auth.signOut();}catch(e){}
    }
    try{localStorage.removeItem(LAST_ACTIVITY_KEY);}catch(e){}
    // הודעת "התנתקת מחוסר פעילות" שורדת את ה-reload של autoSignOutIdle() דרך
    // sessionStorage (לא localStorage בכוונה — לא אמורה להישאר אחרי סגירת הטאב)
    let idleMsg=null;
    try{
      if(sessionStorage.getItem('financeme_idle_msg')){
        idleMsg='התנתקת אוטומטית אחרי 5 דקות בלי שימוש — מתחבר שוב.';
        sessionStorage.removeItem('financeme_idle_msg');
      }else if(idleExpired){
        idleMsg='עברו יותר מ-5 דקות מאז השימוש האחרון — מתחבר שוב מטעמי אבטחה.';
      }
    }catch(e){}
    showLogin(idleMsg);
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
