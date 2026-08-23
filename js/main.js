/* ============================================================
   9. APP
   ============================================================ */
document.querySelectorAll('nav button[data-p]').forEach(b=>{
  b.onclick=()=>{PAGE=b.dataset.p;selYM=null;render();};
});
function boot(){
  el('setup').classList.add('hide');el('app').classList.remove('hide');
  el('nav').classList.remove('hide');el('fab').classList.remove('hide');
  genRecurring();render();
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
