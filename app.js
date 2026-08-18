/* ============================================================
   1. DB — שכבת נתונים
   ============================================================ */
const KEY='financeme_db';

/* ============================================================
   0. SUPABASE — התחברות וסנכרון בענן
   ============================================================
   הערה: זו חריגה מודעת לעיקרון "בלי תלות חיצונית" מהאפיון המקורי (סעיף 2.1) —
   סנכרון ענן דורש קליינט וספריית Supabase. ה-anon key כאן ציבורי בכוונה
   (Supabase מתוכנן כך: ההגנה האמיתית היא ב-Row Level Security בשרת, לא
   בהסתרת המפתח) — כל שורה בטבלה מוגנת ב-auth.uid() = user_id.
   הנתונים עדיין נשמרים גם ב-localStorage כמטמון מקומי-ראשון: שמירה כותבת
   מיידית למקומי (מסך מגיב תמיד, גם אופליין), ומסנכרנת ברקע לענן. טעינה
   מנסה קודם מהענן (המקור האמין ביותר לנתונים עדכניים ממכשיר אחר), ונופלת
   חזרה למטמון המקומי אם אין רשת.
   ============================================================ */
const SUPABASE_URL='https://pitsegijcwutmnswmime.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_RpaHlw90n1u90IZVCBn33w_w4p74H-b';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
let CURRENT_USER=null,syncTimer=null;
// "הכרתי" — חותמת הזמן העדכנית ביותר מהענן שראינו בפועל (מטעינה או משמירה מוצלחת).
// לפני כל שמירה בודקים מול זה: אם בענן יש עכשיו חותמת מאוחרת יותר — מישהו (מכשיר אחר)
// כבר שמר שינויים שלא ראינו, ואסור לדרוס אותם בשקט. זו לא נעילה אמיתית (יש חלון מרוץ
// קטן בין הבדיקה לשמירה), אבל היא תופסת את המקרה הנפוץ ומזהירה במקום "אחרון שכותב מנצח".
let knownCloudUpdatedAt=null,syncConflict=false;

function syncToCloud(){
  if(!CURRENT_USER)return;
  clearTimeout(syncTimer);
  syncTimer=setTimeout(async()=>{
    try{
      if(knownCloudUpdatedAt){
        const {data:cur}=await sb.from('financeme_state').select('updated_at').eq('user_id',CURRENT_USER.id).maybeSingle();
        if(cur&&cur.updated_at&&cur.updated_at!==knownCloudUpdatedAt){
          syncConflict=true;setSyncBadge('conflict');return; // לא שומרים — יידרש פתרון ידני דרך הסמל
        }
      }
      const nowIso=new Date().toISOString();
      await sb.from('financeme_state').upsert({user_id:CURRENT_USER.id,data:DB,updated_at:nowIso});
      knownCloudUpdatedAt=nowIso;syncConflict=false;
      setSyncBadge('ok');
    }catch(e){
      // אופליין / שגיאת רשת — ה-localStorage כבר מעודכן; הניסיון הבא ב-save() הבא ינסה שוב
      setSyncBadge('err');
    }
  },800);
}
function setSyncBadge(state){
  const b=document.getElementById('syncBadge');if(!b)return;
  b.textContent=state==='ok'?'☁️':(state==='err'?'⚠️':(state==='conflict'?'🔀':'⏳'));
  b.title=state==='ok'?'מסונכרן לענן':(state==='err'?'לא הצליח להתחבר לענן — עובד מהעותק המקומי':
    (state==='conflict'?'זוהה שינוי ממכשיר אחר — לחץ לפתרון':'מסנכרן...'));
}
function handleSyncBadgeClick(){
  if(!syncConflict)return;
  sheet('זוהה שינוי ממכשיר אחר',
    '<div class="note" style="margin-bottom:18px">מכשיר אחר שמר שינויים לענן אחרי שהמסך הזה נטען, ולא ברור אם הם כבר כלולים כאן. כדי לא לאבד נתונים בטעות — תבחר איך להמשיך:</div>'+
    '<button class="btn" onclick="resolveConflict(\'reload\')">טען את הגרסה מהענן (ותאבד שינויים שעשית כאן עכשיו)</button>'+
    '<button class="btn dgr" style="margin-top:10px" onclick="resolveConflict(\'overwrite\')">שמור את מה שיש כאן בכל זאת (ותדרוס את הענן)</button>');
}
async function resolveConflict(choice){
  closeSheet();
  if(choice==='reload'){
    const ok=await loadFromCloud(true); // force — המשתמש ביקש מפורשות לזרוק את המקומי ולקחת את הענן
    if(ok){render();toast('נטען מהענן ✓');}
  }else{
    knownCloudUpdatedAt=null;syncConflict=false; // מדלגים על בדיקת ההתנגשות בסבב הזה בכוונה
    await syncToCloudForce();
  }
}
async function syncToCloudForce(){
  if(!CURRENT_USER)return;
  try{
    const nowIso=new Date().toISOString();
    await sb.from('financeme_state').upsert({user_id:CURRENT_USER.id,data:DB,updated_at:nowIso});
    knownCloudUpdatedAt=nowIso;syncConflict=false;setSyncBadge('ok');toast('נשמר לענן ✓');
  }catch(e){setSyncBadge('err');}
}
async function loadFromCloud(force){
  if(!CURRENT_USER)return false;
  try{
    const {data,error}=await sb.from('financeme_state').select('data,updated_at').eq('user_id',CURRENT_USER.id).maybeSingle();
    if(error||!data||!data.data)return false;
    const d=data.data;
    if(!d||!d.version)return false;
    // אם יש עותק מקומי עם שינוי שעוד לא הספיק להיסנכרן לענן (למשל רענון דף מיד אחרי
    // שמירה, לפני שההשהיה של syncToCloud שלחה אותו) — לא דורסים אותו בשקט בגרסה ישנה
    // יותר מהענן. משווים את חותמת הזמן המקומית מול updated_at שהענן מדווח.
    // force=true (מ"טען את הגרסה מהענן" בפתרון התנגשות) מדלג על הבדיקה הזו בכוונה —
    // שם המשתמש מבקש במפורש לזרוק את המקומי ולקחת את הענן, לא להגן על המקומי.
    if(!force)try{
      const raw=localStorage.getItem(KEY);
      if(raw){
        const localDB=JSON.parse(raw);
        const localTs=localDB&&localDB.meta&&localDB.meta.localSavedAt;
        if(localTs&&data.updated_at&&localTs>data.updated_at){
          const ok=load(); // טוען את המקומי (החדש יותר) לתוך DB, במקום את הענן
          if(ok){knownCloudUpdatedAt=data.updated_at||null;syncConflict=false;syncToCloud();} // דוחפים את המקומי לענן כדי להדביק את הפער
          return ok;
        }
      }
    }catch(e){}
    DB=Object.assign(blank(),d);migrate();
    try{localStorage.setItem(KEY,JSON.stringify(DB));}catch(e){}
    knownCloudUpdatedAt=data.updated_at||null;syncConflict=false;
    setSyncBadge('ok');
    return true;
  }catch(e){setSyncBadge('err');return false;}
}
async function startApp(){
  const cloudOk=await loadFromCloud();
  const ok=cloudOk||load();
  if(ok&&(DB.meta.setupDone||DB.cards.length||DB.transactions.length)){boot();}
  else{tmpCards=[];el('setup').classList.remove('hide');drawSetup();}
}
function showLogin(msg){
  el('login').classList.remove('hide');
  el('setup').classList.add('hide');el('app').classList.add('hide');
  el('nav').classList.add('hide');el('fab').classList.add('hide');
  if(msg){const m=el('authMsg');if(m)m.textContent=msg;}
}
async function doSignIn(){
  const email=el('authEmail').value.trim(),pw=el('authPw').value;
  if(!email||!pw)return toast('הזן אימייל וסיסמה');
  const {data,error}=await sb.auth.signInWithPassword({email,password:pw});
  if(error)return toast('שגיאת התחברות: '+error.message);
  CURRENT_USER=data.user;
  el('login').classList.add('hide');
  startApp();
}
async function doSignUp(){
  const email=el('authEmail').value.trim(),pw=el('authPw').value;
  if(!email||!pw)return toast('הזן אימייל וסיסמה');
  if(pw.length<6)return toast('סיסמה חייבת להיות לפחות 6 תווים');
  const {data,error}=await sb.auth.signUp({email,password:pw});
  if(error)return toast('שגיאת הרשמה: '+error.message);
  if(data.user&&!data.session){showLogin('נשלח מייל אימות ל-'+email+' — אשר ואז התחבר.');return;}
  CURRENT_USER=data.user;
  el('login').classList.add('hide');
  startApp();
}
async function doSignOut(){
  if(!confirm('להתנתק? הנתונים נשארים בענן, תוכל להתחבר שוב מכל מכשיר.'))return;
  await sb.auth.signOut();
  CURRENT_USER=null;
  location.reload();
}

const DEFAULT_CATS=[
 {id:'c_rent',name:'שכר דירה',icon:'🏠',kind:'fixed',budget:0},
 {id:'c_ins_car',name:'ביטוח רכב',icon:'🚗',kind:'fixed',budget:0},
 {id:'c_util',name:'חשמל ומים',icon:'⚡',kind:'fixed',budget:0},
 {id:'c_arnona',name:'ארנונה',icon:'🏛️',kind:'fixed',budget:0},
 {id:'c_phone',name:'סלולר',icon:'📱',kind:'fixed',budget:0},
 {id:'c_net',name:'אינטרנט',icon:'🌐',kind:'fixed',budget:0},
 {id:'c_health',name:'קופת חולים',icon:'💊',kind:'fixed',budget:0},
 {id:'c_subs',name:'מנויים',icon:'🎬',kind:'fixed',budget:0},
 {id:'c_gym',name:'חדר כושר',icon:'💪',kind:'fixed',budget:0},
 {id:'c_ins_life',name:'ביטוח חיים',icon:'🛡️',kind:'fixed',budget:0},
 {id:'c_super',name:'סופר',icon:'🛒',kind:'variable',budget:2000},
 {id:'c_fuel',name:'דלק',icon:'⛽',kind:'variable',budget:700},
 {id:'c_food',name:'אוכל בחוץ',icon:'🍔',kind:'variable',budget:500},
 {id:'c_fun',name:'בילויים',icon:'🎉',kind:'variable',budget:400},
 {id:'c_cloth',name:'ביגוד',icon:'👕',kind:'variable',budget:300},
 {id:'c_home',name:'לבית',icon:'🛋️',kind:'variable',budget:300},
 {id:'c_kids',name:'ילדים',icon:'🎒',kind:'variable',budget:0},
 {id:'c_med',name:'בריאות',icon:'🏥',kind:'variable',budget:200},
 {id:'c_trans',name:'תחבורה',icon:'🚌',kind:'variable',budget:200},
 {id:'c_misc',name:'שונות',icon:'🛍️',kind:'variable',budget:400},
 {id:'c_save',name:'הפקדה לחיסכון',icon:'🪙',kind:'saving',budget:0},
 {id:'c_salary',name:'משכורת',icon:'💼',kind:'income',budget:0},
 {id:'c_reserve',name:'מענק מילואים',icon:'🎖️',kind:'income',budget:0},
 {id:'c_other_in',name:'הכנסה נוספת',icon:'➕',kind:'income',budget:0}
];
function blank(){return{
 version:1,
 settings:{currency:'ILS',overdraftLimit:0,safetyBuffer:1000,monthlyExpenseTarget:0,boiRate:0,boiRateUpdated:null,loansAffectBalance:true,
   alertThresholds:{budgetWarn:85,cardDeviation:25,lowBalanceDays:7}},
 account:{id:'acc_1',name:'עו"ש',openingBalance:0,openingDate:null,lastUpdated:null},
 cards:[],categories:DEFAULT_CATS.slice(),transactions:[],recurring:[],goals:[],loans:[],variableIncomes:[],
 meta:{lastGen:null,lastMethod:null,skipRec:[],lastBackup:null,localSavedAt:null}
};}
let DB=blank();
function load(){try{const r=localStorage.getItem(KEY);if(!r)return false;const d=JSON.parse(r);if(!d||!d.version)return false;DB=Object.assign(blank(),d);migrate();return true;}catch(e){return false;}}
function migrate(){
  const a=DB.account;
  if(a.openingBalance===undefined||a.openingBalance===null){
    // נקודת העיגון היא היום: בגרסה הקודמת היתרה כבר שוקללה ידנית,
    // ותאריך מוקדם יותר היה גורם לספירה כפולה של תנועות שכבר נלקחו בחשבון.
    a.openingBalance=a.balance||0;a.openingDate=iso(today());
  }
  delete a.balance;
  if(!DB.settings.alertThresholds)DB.settings.alertThresholds={budgetWarn:85,cardDeviation:25,lowBalanceDays:7};
  if(!DB.settings.alertThresholds.lowBalanceDays)DB.settings.alertThresholds.lowBalanceDays=7;
  if(DB.settings.monthlyExpenseTarget===undefined)DB.settings.monthlyExpenseTarget=0;
  if(DB.settings.boiRate===undefined)DB.settings.boiRate=0;
  if(DB.settings.boiRateUpdated===undefined)DB.settings.boiRateUpdated=null;
  if(DB.settings.loansAffectBalance===undefined)DB.settings.loansAffectBalance=true;
  if(!Array.isArray(DB.loans))DB.loans=[];
  DB.loans.forEach(loan=>{if(!loan.payDay)loan.payDay=10;});
  if(DB.meta.lastBackup===undefined)DB.meta.lastBackup=null;
  if(DB.meta.localSavedAt===undefined)DB.meta.localSavedAt=null;
  if(!Array.isArray(DB.meta.skipRec))DB.meta.skipRec=[];
  if(!Array.isArray(DB.categories)||!DB.categories.length)DB.categories=DEFAULT_CATS.slice();
  if(!Array.isArray(DB.cards))DB.cards=[];
  if(!Array.isArray(DB.transactions))DB.transactions=[];
  if(!Array.isArray(DB.goals))DB.goals=[];
  if(!Array.isArray(DB.variableIncomes))DB.variableIncomes=[];
  if(!Array.isArray(DB.recurring))DB.recurring=[];
  // תיקון רטרואקטיבי: לפני התיקון, startDate של הוראת קבע חדשה נקבע ל"היום" במקום
  // לתחילת החודש. הוראת קבע שנוספה באמצע החודש עם יום-חודש מוקדם יותר "נבלעה" בשקט —
  // לא נוצרה לה תנועה באותו חודש בכלל. תיקון הקוד בלבד לא מרפא רשומות שכבר נשמרו,
  // אז מנרמלים כאן כל startDate קיים לתחילת החודש שבו הוא נוצר. genRecurring() שרץ
  // מיד אחרי migrate() (דרך boot()) ישלים את התנועה החסרה באופן אוטומטי.
  DB.recurring.forEach(r=>{
    if(r.startDate){const monthStart=ym(r.startDate)+'-01';if(r.startDate>monthStart)r.startDate=monthStart;}
  });
  // ניקוי skipRec: רישום "דלג על המופע הזה" ששייך להוראת קבע שכבר נמחקה לגמרי הוא
  // רק אשפה שנשארה מאחור — אין לו יותר על מה להשפיע. משאירים בכוונה skipRec שכן
  // שייך להוראה קיימת (זה שמזכיר "המופע החודש הזה נמחק ידנית" — לא טעות, כוונה).
  DB.meta.skipRec=DB.meta.skipRec.filter(sid=>{
    const mm=sid.match(/^rec_(.+)_(\d{4}-\d{2})$/);
    if(!mm)return true;
    return DB.recurring.some(r=>r.id===mm[1]);
  });
  // גרסאות ישנות: הפקדות ליעד נקשרו רק לפי טקסט ההערה ("הפקדה: <שם>") —
  // לא אמין מול שינוי שם יעד. נשייך אותן ל-goalId פעם אחת, ונשלים createdDate חסר.
  DB.goals.forEach(g=>{
    if(!g.createdDate){
      const linked=DB.transactions.filter(t=>!t.goalId&&t.note==='הפקדה: '+g.name).sort((a,b)=>a.date<b.date?-1:1);
      linked.forEach(t=>t.goalId=g.id);
      g.createdDate=linked.length?linked[0].date:iso(today());
    }
  });
}
function save(){
  // חותמת זמן מקומית — כדי שבטעינה הבאה (למשל רענון דף מיד אחרי שמירה, לפני שההשהיה
  // של syncToCloud הספיקה לשלוח את זה לענן) נדע לזהות שהעותק המקומי חדש יותר מהענן
  // ולא נדרוס אותו בטעות בגרסה ישנה — ראו loadFromCloud()
  DB.meta.localSavedAt=new Date().toISOString();
  try{localStorage.setItem(KEY,JSON.stringify(DB));}catch(e){toast('שגיאת שמירה — האחסון מלא');}
  syncToCloud();
}
function uid(p){return p+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}

/* ============================================================
   2. עזרי תאריך ומספר
   ============================================================ */
const MON=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const DOW=['יום ראשון','יום שני','יום שלישי','יום רביעי','יום חמישי','יום שישי','יום שבת'];
function todayLabel(){const d=today();return DOW[d.getDay()]+', '+d.getDate()+' ב'+MON[d.getMonth()]+' '+d.getFullYear();}
const MON_S=['ינו׳','פבר׳','מרץ','אפר׳','מאי','יוני','יולי','אוג׳','ספט׳','אוק׳','נוב׳','דצמ׳'];
function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function pd(s){const p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2]);}
function today(){const d=new Date();d.setHours(0,0,0,0);return d;}
function ym(s){return s.slice(0,7);}
function curYM(){return iso(today()).slice(0,7);}
function ymLabel(y){const p=y.split('-');return MON[+p[1]-1]+' '+p[0];}
function ymShort(y){return MON_S[+y.split('-')[1]-1];}
function addM(y,n){const p=y.split('-');const d=new Date(+p[0],+p[1]-1+n,1);return iso(d).slice(0,7);}
function monthsBetweenYM(a,b){const ap=a.slice(0,7).split('-'),bp=b.slice(0,7).split('-');return (+bp[0]-+ap[0])*12+(+bp[1]-+ap[1]);}
function daysIn(y){const p=y.split('-');return new Date(+p[0],+p[1],0).getDate();}
function dayIn(y,day){return y+'-'+String(Math.min(day,daysIn(y))).padStart(2,'0');}
function fmt(n){return '₪'+Math.round(n).toLocaleString('he-IL');}
function fmtS(n){return (n<0?'-':'')+'₪'+Math.abs(Math.round(n)).toLocaleString('he-IL');}
function dLabel(s){const d=pd(s);return d.getDate()+'/'+(d.getMonth()+1);}

/* ============================================================
   3. CALC — מנוע החישוב
   ============================================================ */
const CALC={
  /* 4.1 — תאריך חיוב */
  chargeDate(dateStr,card){
    if(!card)return dateStr;
    const d=pd(dateStr);
    const off=d.getDate()<=card.cutoffDay?1:2;
    const t=new Date(d.getFullYear(),d.getMonth()+off,1);
    return dayIn(iso(t).slice(0,7),card.chargeDay);
  },
  card(id){return DB.cards.find(c=>c.id===id)||null;},
  cat(id){return DB.categories.find(c=>c.id===id)||{name:'ללא',icon:'❓',kind:'variable'};},

  /* היתרה נגזרת: נקודת עיגון אחרונה + כל מה שירד/נכנס מאז ועד היום.
     שום פונקציה לא "מזיזה" את היתרה ידנית — אין דרך לצבור סטייה. */
  balance(){
    const a=DB.account,t=iso(today()),from=a.openingDate||'0000-00-00';
    let b=a.openingBalance||0;
    DB.transactions.forEach(x=>{
      if(x.method==='cash')return;
      if(x.chargeDate>from&&x.chargeDate<=t)b+=(x.direction==='in'?x.amount:-x.amount);
    });
    return b;
  },

  /* תשלום הלוואה עתידי החודש, לפי יום החיוב שהוגדר לה — לא תנועה אמיתית בטבלה
     (אין רשומה קבועה, שום דבר לא "נכנס" להיסטוריה), רק חישוב חי בזמן אמת. פעיל
     רק אם המשתמש ביקש (settings.loansAffectBalance) — אחרת מי שכבר עוקב אחרי
     ההלוואה כהוראת קבע נפרדת יראה אותה נספרת פעמיים. יום שכבר עבר החודש = מניחים
     שכבר נכלל ביתרה שהוזנה/סונכרנה, בדיוק אותה הנחת "עוגן" כמו תנועות רגילות. */
  loanPending(){
    if(!DB.settings.loansAffectBalance)return 0;
    const d=today().getDate();
    return DB.loans.reduce((s,loan)=>{
      const pay=LOANS.loanCalc(loan).totalPayment;
      return (pay>0&&d<(loan.payDay||10))?s+pay:s;
    },0);
  },

  /* 4.3 — יתרה זמינה */
  available(){
    // שמרני בכוונה: מורידים רק התחייבויות עתידיות. הכנסה עתידית לא נספרת כאן —
    // היא מופיעה רק בתחזית. אחרת המספר מנפח את מה שבאמת אפשר להוציא היום.
    const t=iso(today());
    let pend=0;
    DB.transactions.forEach(x=>{ if(x.direction==='out'&&x.method!=='cash'&&x.chargeDate>t) pend+=x.amount; });
    pend+=CALC.loanPending();
    const bal=CALC.balance();
    return {balance:bal,pending:pend,available:bal-pend};
  },

  /* 4.4 — תחזית לסוף החודש: יתרה בבנק פחות כל ההוצאות שנרשמו החודש (קבועות +
     משתנות + הלוואה + הפקדה לחיסכון) — נוסחה יחידה, אותה בדיוק בכל מסך שמציג
     "תחזית" (דף הבית, דף עו"ש, וההתראות הקריטיות), כדי שלא יסתרו אחד את השני. */
  monthEnd(){
    const av=CALC.available(),m=CALC.month(curYM()),loanPay=LOANS.allMonthlyTotal();
    return av.balance-(m.out+loanPay+m.saving);
  },

  /* 4.5 — סיכום חודשי (לפי חודש ההוצאה) */
  month(y){
    const r={income:0,incomeBase:0,incomeExtra:0,out:0,fixed:0,variable:0,saving:0,byCat:{},byCard:{}};
    DB.transactions.forEach(x=>{
      if(ym(x.date)!==y)return;
      const c=CALC.cat(x.categoryId);
      if(x.direction==='in'){
        r.income+=x.amount;
        if(x.incomeType==='salary')r.incomeBase+=x.amount;else r.incomeExtra+=x.amount;
        // byCat גם להכנסות (לא רק הוצאות) — כדי שטאב "הכנסות" בדף ההוצאות יוכל להציג
        // פירוט לפי קטגוריה (עוגה) בדיוק כמו קבועות/משתנות, באותו קוד גנרי
        r.byCat[x.categoryId]=(r.byCat[x.categoryId]||0)+x.amount;
        return;
      }
      if(c.kind==='saving'){r.saving+=x.amount;}
      else{
        r.out+=x.amount;
        if(c.kind==='fixed')r.fixed+=x.amount;else r.variable+=x.amount;
        r.byCat[x.categoryId]=(r.byCat[x.categoryId]||0)+x.amount;
      }
      if(x.cardId)r.byCard[x.cardId]=(r.byCard[x.cardId]||0)+x.amount;
    });
    r.free=r.income-r.out-r.saving;
    r.saveRate=r.income>0?(r.saving/r.income)*100:0;
    r.useRate=r.incomeBase>0?(r.out/r.incomeBase)*100:0;
    return r;
  },

  /* מחזור כרטיס */
  cycle(cardId){
    const c=CALC.card(cardId),t=iso(today());
    const dates=[...new Set(DB.transactions.filter(x=>x.cardId===cardId&&x.chargeDate>=t).map(x=>x.chargeDate))].sort();
    const next=dates[0]||null;
    let nextAmt=0,open=0;
    DB.transactions.forEach(x=>{
      if(x.cardId!==cardId)return;
      if(next&&x.chargeDate===next)nextAmt+=x.amount;
      else if(next&&x.chargeDate>next)open+=x.amount;
    });
    return {card:c,nextDate:next,nextAmount:nextAmt,open:open,used:nextAmt+open};
  },

  /* ממוצע 3 חודשים אחורה לכרטיס */
  cardAvg(cardId){
    const y=curYM();let s=0,n=0;
    for(let i=1;i<=3;i++){const m=CALC.month(addM(y,-i));s+=(m.byCard[cardId]||0);n++;}
    return n?s/n:0;
  },

  /* 4.7 — יעדים */
  goal(g){
    const rem=Math.max(0,g.targetAmount-g.saved);
    const pct=g.targetAmount>0?Math.min(100,(g.saved/g.targetAmount)*100):0;
    let need=null,months=null,eta=null;
    if(g.targetDate){
      const t=today(),td=pd(g.targetDate);
      months=Math.max(1,(td.getFullYear()-t.getFullYear())*12+(td.getMonth()-t.getMonth()));
      need=rem/months;
    }
    if(g.monthlyPlan>0&&rem>0){
      const m=Math.ceil(rem/g.monthlyPlan),d=new Date();d.setMonth(d.getMonth()+m);
      eta=MON_S[d.getMonth()]+' '+d.getFullYear();
    }else if(rem===0){eta='הושג';}
    return {rem,pct,need,months,eta,behind:need!==null&&need>g.monthlyPlan+1};
  }
};

/* ============================================================
   3ב. LOANS — מנוע הלוואות (שפיצר, ריבית פריים = בנק ישראל + מרווח)
   ============================================================
   הנחת עבודה: לכל מסלול מחושבת יתרה/החזר לפי הריבית הנוכחית שלו, כאילו
   הייתה קבועה מתחילת ההלוואה. במסלול פריים זה אומר שברגע שמעדכנים את
   ריבית בנק ישראל בהגדרות, ההחזר החודשי "קופץ" להחזר הנכון להמשך הדרך —
   בדיוק כמו במציאות. מסלולים צמודי מדד מוצגים לפי הקרן המקורית בלי הצמדה
   בפועל (אין למערכת גישה למדד בלי אינטרנט) — זה קירוב, לא סכום מדויק. */
const LOANS={
  monthsElapsed(startDate){
    const s=pd(startDate),t=today();
    let m=(t.getFullYear()-s.getFullYear())*12+(t.getMonth()-s.getMonth());
    if(t.getDate()<s.getDate())m--;
    return Math.max(0,m);
  },
  trackRate(tr){
    return tr.type==='prime'?(DB.settings.boiRate||0)+(tr.margin||0):(tr.fixedRate||0);
  },
  /* שפיצר: תשלום חודשי קבוע, יתרה יורדת לפי הנוסחה הסגורה הרגילה */
  trackCalc(loan,tr){
    const n=Math.max(1,tr.termMonths||1),P=Math.max(0,tr.principal||0);
    const annualRate=LOANS.trackRate(tr),r=annualRate/100/12;
    const pay0=r?P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1):P/n;
    const k=Math.min(LOANS.monthsElapsed(loan.startDate),n);
    let bal=r?P*(Math.pow(1+r,n)-Math.pow(1+r,k))/(Math.pow(1+r,n)-1):P-pay0*k;
    bal=Math.max(0,bal);
    const monthsLeft=Math.max(0,n-k);
    let curPay=0;
    if(monthsLeft>0)curPay=r?bal*r*Math.pow(1+r,monthsLeft)/(Math.pow(1+r,monthsLeft)-1):bal/monthsLeft;
    const totalInterestRemaining=Math.max(0,curPay*monthsLeft-bal);
    return {rate:annualRate,monthlyPayment:curPay,balance:bal,monthsElapsed:k,monthsLeft,totalInterestRemaining};
  },
  loanCalc(loan){
    const tracks=(loan.tracks||[]).map(tr=>({tr,c:LOANS.trackCalc(loan,tr)}));
    return {
      tracks,
      totalBalance:tracks.reduce((s,x)=>s+x.c.balance,0),
      totalPayment:tracks.reduce((s,x)=>s+x.c.monthlyPayment,0),
      totalInterest:tracks.reduce((s,x)=>s+x.c.totalInterestRemaining,0)
    };
  },
  allMonthlyTotal(){
    return DB.loans.reduce((s,loan)=>s+LOANS.loanCalc(loan).totalPayment,0);
  }
};

/* ============================================================
   4. RECURRING — ייצור תנועות מהוראות קבע
   ============================================================ */
function genRecurring(){
  const y=curYM();
  let start=DB.meta.lastGen||addM(y,-1);
  const months=[];let m=start;
  for(let i=0;i<14&&m<=y;i++){months.push(m);m=addM(m,1);}
  months.forEach(mm=>{
    DB.recurring.forEach(r=>{
      if(!r.active)return;
      const d=dayIn(mm,r.dayOfMonth);
      if(r.startDate&&d<r.startDate)return;
      if(r.endDate&&d>r.endDate)return;
      const id='rec_'+r.id+'_'+mm;
      if(DB.transactions.some(x=>x.id===id))return;
      if(DB.meta.skipRec.indexOf(id)>-1)return;
      const card=r.method==='card'?CALC.card(r.cardId):null;
      // תוכנית תשלומים (הוראת קבע עם מספר סופי): כל מופע מתויג עם אינדקס/סה"כ,
      // בדיוק כמו רכישה בתשלומים באשראי — כדי שאותה תצוגה תעבוד בלי קוד נוסף
      const installment=r.installmentTotal?{groupId:'rec_'+r.id,index:monthsBetweenYM(r.startDate,mm)+1,total:r.installmentTotal}:null;
      DB.transactions.push({
        id:id,direction:r.direction||'out',amount:r.amount,date:d,
        chargeDate:r.direction==='in'?d:CALC.chargeDate(d,card),
        categoryId:r.categoryId,method:r.method,cardId:card?card.id:null,
        note:r.name,installment:installment,recurringId:r.id,
        incomeType:r.direction==='in'?(r.incomeType||'salary'):null,
        goalId:r.goalId||null
      });
      // הוראת קבע שמקושרת ליעד חיסכון (למשל הפקדה חודשית אוטומטית) — כל חיוב שנוצר
      // מעדכן את "סה"כ נצבר" של היעד באופן אוטומטי, בדיוק כמו הפקדה ידנית בכפתור "הפקד"
      if(r.goalId){
        const g=DB.goals.find(x=>x.id===r.goalId);
        if(g)g.saved+=r.amount;
      }
    });
  });
  DB.meta.lastGen=y;save();
}

/* ============================================================
   5. ALERTS — מנוע התראות
   ============================================================ */
function alerts(){
  const A=[],y=curYM(),m=CALC.month(y),av=CALC.available(),S=DB.settings;
  // הלוואה היא הוצאה חודשית קבועה כמו כל אחרת — אם היא לא נכנסת לכל חישוב "כמה יצא
  // החודש", ההתראות "יתרה חיובית"/"תקציב גבוה" ייתנו תמונה ורודה מדי למי שיש לו הלוואה
  const loanPay=LOANS.allMonthlyTotal();
  // אותה נוסחה בדיוק כמו "תחזית לסוף החודש" בדף הבית ובדף עו"ש — מקור אמת יחיד,
  // כדי שההתראות לא יסתרו מספר שמוצג במקום אחר באפליקציה
  const monthEnd=CALC.monthEnd();
  const od=-Math.abs(S.overdraftLimit||0);
  if(monthEnd<od){A.push({s:'crit',i:'🚨',t:'צפויה חריגה ממסגרת',d:'בסוף החודש היתרה צפויה להיות '+fmtS(monthEnd)+', מעבר למסגרת שהוגדרה. חייב לפעול עכשיו.'});}
  else if(monthEnd<0){A.push({s:'crit',i:'🔴',t:'צפוי מינוס בחשבון',d:'בסוף החודש היתרה צפויה לרדת ל-'+fmtS(monthEnd)+'.'});}
  else if(monthEnd<S.safetyBuffer){A.push({s:'warn',i:'🟠',t:'ירידה מתחת לכרית הביטחון',d:'בסוף החודש היתרה צפויה להיות '+fmt(monthEnd)+', מתחת ל-'+fmt(S.safetyBuffer)+'.'});}
  if(m.incomeBase>0&&((m.out+loanPay)/m.incomeBase*100)>S.alertThresholds.budgetWarn){A.push({s:'warn',i:'📊',t:'ניצול תקציב גבוה',d:'ניצלת '+Math.round((m.out+loanPay)/m.incomeBase*100)+'% מההכנסה הקבועה. נשארו '+fmt(m.incomeBase-m.out-loanPay)+'.'});}
  DB.cards.forEach(c=>{
    const cur=m.byCard[c.id]||0,avg=CALC.cardAvg(c.id);
    if(avg>200&&cur>avg*(1+S.alertThresholds.cardDeviation/100)){
      A.push({s:'note',i:'💳',t:'חריגה ב'+c.name,d:'החודש '+fmt(cur)+' לעומת ממוצע '+fmt(avg)+' — גבוה ב-'+Math.round((cur/avg-1)*100)+'%.'});}
    const cy=CALC.cycle(c.id);
    if(c.limit>0&&cy.used>c.limit*.8){A.push({s:'warn',i:'⚠️',t:'קרוב למסגרת ב'+c.name,d:'נוצלו '+fmt(cy.used)+' מתוך '+fmt(c.limit)+'.'});}
  });
  const dayPct=today().getDate()/daysIn(y);
  const varBudget=DB.categories.filter(c=>c.kind==='variable').reduce((s,c)=>s+(c.budget||0),0);
  if(varBudget>0&&m.variable>varBudget*dayPct*1.15){A.push({s:'note',i:'⏩',t:'קצב הוצאות מהיר',d:'עברת '+fmt(m.variable)+' בהוצאות משתנות, מעל הקצב לתקציב '+fmt(varBudget)+'.'});}
  if(m.saving===0&&today().getDate()>=22&&DB.goals.length){A.push({s:'note',i:'🎯',t:'לא הופרש לחיסכון החודש',d:'החודש כמעט נגמר ועדיין לא נרשמה הפקדה.'});}
  DB.variableIncomes.forEach(v=>{
    if(!v.active||today().getDate()<v.dayOfMonth)return;
    const logged=DB.transactions.some(t=>t.direction==='in'&&t.categoryId===v.categoryId&&ym(t.date)===y);
    if(!logged)A.push({s:'note',i:'💰',t:'לא הוזנה "'+v.name+'" החודש',d:'ה-'+v.dayOfMonth+' לחודש עבר — היכנס לטאב הכנסות ולחץ "הזן" כדי לרשום את הסכום בפועל.'});
  });
  DB.goals.forEach(g=>{const r=CALC.goal(g);if(r.behind){A.push({s:'note',i:'📉',t:'היעד "'+g.name+'" בפיגור',d:'צריך '+fmt(r.need)+' לחודש במקום '+fmt(g.monthlyPlan)+'.'});}});
  const big=DB.transactions.filter(x=>ym(x.date)===y&&x.direction==='out'&&m.incomeBase>0&&x.amount>m.incomeBase*.15);
  if(big.length){const b=big.sort((a,c)=>c.amount-a.amount)[0];A.push({s:'note',i:'🔍',t:'הוצאה חריגה',d:(b.note||CALC.cat(b.categoryId).name)+' — '+fmt(b.amount)+', מעל 15% מההכנסה.'});}
  if(m.saveRate>20){A.push({s:'good',i:'🌟',t:'חודש חזק',d:'הפרשת '+Math.round(m.saveRate)+'% מההכנסה לחיסכון. ככה ממשיכים.'});}
  else if(monthEnd>0){A.push({s:'good',i:'📈',t:'יתרה חיובית',d:'צפויים להישאר '+fmt(monthEnd)+' בבנק בסוף החודש.'});}
  // תזכורת גיבוי אקטיבית — localStorage לא בטוח (סאפרי בנייד מוחק אחרי אי-שימוש),
  // אז מזכירים אם יש נתונים משמעותיים ולא יוצא גיבוי מעולם / כבר 20+ יום
  if(DB.transactions.length>3){
    const daysSince=DB.meta.lastBackup?Math.floor((today()-pd(DB.meta.lastBackup))/86400000):Infinity;
    if(daysSince>20){A.push({s:'note',i:'💾',t:'כדאי לגבות',d:DB.meta.lastBackup?'לא גובה מאז '+dLabel(DB.meta.lastBackup)+' — ייצא קובץ מההגדרות.':'עדיין לא יוצא אף גיבוי — ייצא קובץ מההגדרות כדי לא לאבד נתונים.'});}
  }
  const rank={crit:0,warn:1,note:2,good:3};
  return A.sort((a,b)=>rank[a.s]-rank[b.s]);
}

/* ============================================================
   6. UI — רינדור
   ============================================================ */
let PAGE='home',selYM=null,expTab='fixed',recBoxOpen=false;
const el=id=>document.getElementById(id);
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2200);}
function esc(s){return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

function render(){
  const titles={home:['📊 סקירה כללית','מבט על המצב הכלכלי החודש'],
   account:['🏦 עובר ושב','תזרים, חיובים צפויים ותחזית'],
   cards:['💳 כרטיסי אשראי','חיובים קרובים ופירוט עסקאות'],
   expenses:['📋 הוצאות','קבועות מול משתנות'],
   savings:['🎯 חיסכון ויעדים','לאן אתה חותר']};
  el('ptitle').textContent=titles[PAGE][0];el('psub').textContent=titles[PAGE][1];
  document.querySelectorAll('nav button[data-p]').forEach(b=>b.classList.toggle('on',b.dataset.p===PAGE));
  el('view').innerHTML=({home:vHome,account:vAccount,cards:vCards,expenses:vExpenses,savings:vSavings})[PAGE]();
  window.scrollTo(0,0);
  afterRender();
}

/* ---------- HOME ---------- */
function vHome(){
  const y=curYM(),m=CALC.month(y),av=CALC.available(),A=alerts();
  const loanPay=LOANS.allMonthlyTotal(); // הלוואה = הוצאה חודשית קבועה עד שנגמרת — נספרת בכל מקום שמסכם "כמה יורד כל חודש"
  const totalSaved=DB.goals.reduce((s,g)=>s+g.saved,0); // סה"כ מצטבר בכל היעדים — אותו חישוב בדיוק כמו בדף החיסכון, כדי ששני המקומות תמיד יתאימו
  // תחזית לסוף החודש — מקור אמת יחיד (CALC.monthEnd), אותו מספר בדיוק בכל מסך שמציג אותו
  const forecastEnd=CALC.monthEnd();
  // תחזית אחרי הכנסה — אותו דבר, בתוספת ההכנסה החודשית המינימלית שהוגדרה בהגדרות
  // (settings.monthlyExpenseTarget משמש כאן פעם שנייה, גם כ"רצפת הכנסה" צפויה)
  const minIncome=DB.settings.monthlyExpenseTarget||0;
  const forecastAfterIncome=forecastEnd+minIncome;
  let h='';
  h+='<div style="display:flex;align-items:center;gap:11px;margin-bottom:16px">'+
     '<div style="width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#2563eb,#1e3a8a);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;box-shadow:0 6px 16px rgba(37,99,235,.3)">👋</div>'+
     '<div><div style="font-size:15.5px;font-weight:800">שלום!</div><div class="mini">'+todayLabel()+'</div></div></div>';
  h+='<div class="hero"><div class="hlbl"><span class="dot" style="background:var(--balance)"></span>תחזית לסוף החודש</div>'+
     '<div class="hamt '+(forecastEnd<0?'neg':'')+'">'+fmtS(forecastEnd)+'</div>'+
     '<div class="hrow">'+
     '<div class="hcell"><div class="cl">יתרה בבנק</div><div class="cv">'+fmtS(av.balance)+'</div></div>'+
     (minIncome>0?'<div class="hcell"><div class="cl">אחרי הכנסה צפויה</div><div class="cv" style="color:'+(forecastAfterIncome<0?'var(--expense)':'var(--income)')+'">'+fmtS(forecastAfterIncome)+'</div></div>':'')+
     '</div>'+
     '<div class="mini" style="margin-top:12px;line-height:1.6">💡 יתרה בבנק ('+fmt(av.balance)+') פחות כל ההוצאות הקבועות, המשתנות, ההלוואה וההפקדה לחיסכון שנרשמו החודש ('+fmt(m.out+loanPay+m.saving)+').'+
     (minIncome>0?' "אחרי הכנסה צפויה" מוסיפה על זה את ההכנסה החודשית המינימלית שהגדרת ('+fmt(minIncome)+').':'')+'</div>'+
     '</div>';
  h+='<div class="kpi">'+
     '<div class="kcard inc"><div class="klbl"><span class="dot"></span>הכנסות</div><div class="kamt">'+fmt(m.income)+'</div></div>'+
     '<div class="kcard exp"><div class="klbl"><span class="dot"></span>הוצאות</div><div class="kamt">'+fmt(m.out+loanPay+m.saving)+'</div></div>'+
     '<div class="kcard sav"><div class="klbl"><span class="dot"></span>לחיסכון</div><div class="kamt">'+fmt(totalSaved)+'</div></div>'+
     '</div>'+
     (loanPay>0?'<div class="mini" style="margin-bottom:16px">💡 "הוצאות" כולל '+fmt(loanPay)+' החזרי הלוואות ו-'+fmt(m.saving)+' הפקדה לחיסכון החודש</div>':'');
  if(A.length){
    h+='<div class="box"><div class="stitle"><span>🔔</span> התראות ותובנות<span class="sright">'+A.length+'</span></div>';
    h+='<div class="alertsWrap" onscroll="updAlertDots(this)" onwheel="alertWheel(event,this)">'+A.map(a=>'<div class="alertSlide"><div class="alert a-'+a.s+'"><div class="aic">'+a.i+'</div><div class="atx"><b>'+esc(a.t)+'</b>'+esc(a.d)+'</div></div></div>').join('')+'</div>';
    if(A.length>1)h+='<div class="alertDots">'+A.map((_,i)=>'<span class="adot'+(i===0?' on':'')+'" onclick="scrollToAlert(this)"></span>').join('')+'</div>';
    h+='</div>';
  }
  const target=DB.settings.monthlyExpenseTarget||0;
  if(target>0){
    const spent=m.fixed+m.variable+loanPay+m.saving,tpct=Math.min(100,Math.round((spent/target)*100));
    h+='<div class="box"><div class="stitle"><span>🎯</span> יעד הוצאות חודשי</div>'+
       '<div class="barout"><div class="barin '+(spent>target?'hi':tpct>85?'mid':'')+'" data-w="'+tpct+'"></div></div>'+
       '<div class="barlbls"><span>₪0</span><span>'+fmt(target)+'</span></div>'+
       '<div class="barpct" style="color:'+(spent>target?'var(--expense)':tpct>85?'var(--warn)':'var(--income)')+'">'+tpct+'%</div>'+
       '<div class="mini">הוצאת '+fmt(spent)+' מתוך יעד '+fmt(target)+' (קבועות + משתנות'+(loanPay>0?' + הלוואות':'')+(m.saving>0?' + חיסכון':'')+')'+(spent>target?' · חריגה של '+fmt(spent-target):' · נשארו '+fmt(target-spent))+'</div></div>';
  }
  const split=[{n:'הוצאות קבועות',v:m.fixed,c:'#2563eb'},{n:'הלוואות',v:loanPay,c:'#d97706'},{n:'הוצאות משתנות',v:m.variable,c:'#e5383b'},{n:'חיסכון',v:m.saving,c:'#7c3aed'}].filter(x=>x.v>0);
  if(split.length){
    h+='<div class="box"><div class="stitle"><span>🍩</span> חלוקת החודש</div><div class="dwrap">'+donut(split,split.reduce((s,x)=>s+x.v,0))+'</div></div>';
  }
  const recent=DB.transactions.filter(x=>x.date<=iso(today())).sort((a,b)=>b.date<a.date?-1:1).slice(0,6);
  h+='<div class="box"><div class="stitle"><span>🕐</span> תנועות אחרונות</div>';
  h+=recent.length?recent.map(txRow).join(''):'<div class="empty"><b>עדיין אין תנועות</b>לחץ על + כדי לרשום את הראשונה</div>';
  h+='</div>';
  return h;
}
function updAlertDots(wrap){
  const slides=wrap.querySelectorAll('.alertSlide');
  const dots=wrap.nextElementSibling;
  if(!dots||!dots.classList.contains('alertDots'))return;
  const wrapLeft=wrap.getBoundingClientRect().left;
  let best=0,bestDist=Infinity;
  slides.forEach((s,i)=>{
    const d=Math.abs(s.getBoundingClientRect().left-wrapLeft);
    if(d<bestDist){bestDist=d;best=i;}
  });
  dots.querySelectorAll('.adot').forEach((d,i)=>d.classList.toggle('on',i===best));
}
function scrollToAlert(dot){
  const dots=dot.parentElement,wrap=dots.previousElementSibling;
  if(!wrap||!wrap.classList.contains('alertsWrap'))return;
  const slide=wrap.children[Array.prototype.indexOf.call(dots.children,dot)];
  if(!slide)return;
  wrap.scrollBy({left:slide.getBoundingClientRect().left-wrap.getBoundingClientRect().left,behavior:'smooth'});
}
function alertWheel(e,wrap){
  if(Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
  e.preventDefault();
  const rtl=getComputedStyle(wrap).direction==='rtl';
  wrap.scrollBy({left:rtl?-e.deltaY:e.deltaY,behavior:'auto'});
}

/* ---------- ACCOUNT ---------- */
function vAccount(){
  const av=CALC.available(),monthEnd=CALC.monthEnd(),y=curYM(),t=iso(today());
  let h='';
  h+='<div class="hero"><div class="hlbl"><span class="dot" style="background:var(--balance)"></span>יתרה בבנק</div>'+
     '<div class="hamt '+(av.balance<0?'neg':'')+'">'+fmtS(av.balance)+'</div>'+
     '<div class="mini" style="margin-bottom:12px">עודכן: '+(DB.account.lastUpdated?dLabel(DB.account.lastUpdated):'מעולם לא')+'</div>'+
     '<button class="btn sec" onclick="openSync()">עדכן יתרה מהבנק</button></div>';
  h+='<div class="box"><div class="stitle"><span>🏦</span> הלוואות'+(DB.loans.length?'<span class="sright">'+fmt(LOANS.allMonthlyTotal())+' לחודש</span>':'')+'</div>';
  if(!DB.loans.length)h+='<div class="empty"><b>אין הלוואות רשומות</b>הוסף הלוואה כדי לעקוב אחרי החזר חודשי, יתרה וריבית</div>';
  else DB.loans.forEach(loan=>{
    const lc=LOANS.loanCalc(loan);
    h+='<div class="eitem tap" onclick="loanDetail(\''+loan.id+'\')"><div class="eico">🏦</div><div class="einfo"><div class="ename">'+esc(loan.name)+'</div>'+
      '<div class="etag">יתרה '+fmt(lc.totalBalance)+' · '+loan.tracks.length+' מסלולים</div></div>'+
      '<div class="eside"><div class="eamt">'+fmt(lc.totalPayment)+'</div><div class="edate">לחודש</div></div></div>';
  });
  h+='<button class="addrow" style="margin-top:14px;margin-bottom:0" onclick="openLoanForm()">+ הוסף הלוואה</button></div>';
  h+='<div class="box"><div class="stitle"><span>📉</span> תחזית לסוף החודש</div>'+
     '<div class="barpct" style="color:'+(monthEnd<0?'var(--expense)':monthEnd<DB.settings.safetyBuffer?'var(--warn)':'var(--income)')+'">'+fmtS(monthEnd)+'</div>'+
     '<div class="alert '+(monthEnd<0?'a-crit':monthEnd<DB.settings.safetyBuffer?'a-warn':'a-good')+'" style="margin-top:10px">'+
     '<div class="aic">'+(monthEnd<DB.settings.safetyBuffer?'⚠️':'✅')+'</div><div class="atx"><b>'+fmtS(monthEnd)+'</b>יתרה בבנק פחות כל ההוצאות הקבועות, המשתנות, ההלוואה וההפקדה לחיסכון שנרשמו החודש. אותו מספר בדיוק כמו בדף הבית.</div></div></div>';
  const up=DB.transactions.filter(x=>x.chargeDate>=t).sort((a,b)=>a.chargeDate<b.chargeDate?-1:1);
  h+='<div class="box"><div class="stitle"><span>📅</span> חיובים והכנסות צפויים<span class="sright">'+up.length+'</span></div>';
  if(!up.length)h+='<div class="empty"><b>אין חיובים עתידיים</b>הכל כבר ירד מהחשבון</div>';
  else{
    let run=av.balance;
    h+=up.slice(0,25).map(x=>{
      run+=(x.direction==='out'?-x.amount:x.amount);
      const c=CALC.cat(x.categoryId),cd=x.cardId?CALC.card(x.cardId):null;
      return '<div class="eitem"><div class="eico">'+c.icon+'</div><div class="einfo"><div class="ename">'+esc(x.note||c.name)+'</div>'+
        '<div class="etag">'+(cd?'<span class="tdot" style="background:'+cd.color+'"></span>'+esc(cd.name):'מהעו"ש')+
        (x.installment?' · תשלום '+x.installment.index+'/'+x.installment.total:'')+'</div></div>'+
        '<div class="eside"><div class="eamt '+(x.direction==='in'?'in':'')+'">'+(x.direction==='in'?'+':'-')+fmt(x.amount)+'</div>'+
        '<div class="edate">'+dLabel(x.chargeDate)+' · יתרה '+fmtS(run)+'</div></div></div>';
    }).join('');
  }
  h+='</div>';
  const past=DB.transactions.filter(x=>x.chargeDate<t).sort((a,b)=>b.chargeDate<a.chargeDate?-1:1).slice(0,15);
  h+='<div class="box"><div class="stitle"><span>🕐</span> תנועות שכבר ירדו</div>';
  h+=past.length?past.map(txRow).join(''):'<div class="empty">אין עדיין</div>';
  h+='</div>';
  return h;
}

/* ---------- CARDS ---------- */
function vCards(){
  let h='';
  if(!DB.cards.length)return '<div class="box"><div class="empty"><b>לא הוגדרו כרטיסים</b>הוסף כרטיס בהגדרות כדי לעקוב אחרי חיובים</div></div>';
  h+='<div class="ccgrid">';
  DB.cards.forEach((c,i)=>{
    const cy=CALC.cycle(c.id);
    const grad=['linear-gradient(135deg,#4f46e5,#7c3aed)','linear-gradient(135deg,#d97706,#f59e0b)','linear-gradient(135deg,#059669,#10b981)','linear-gradient(135deg,#0891b2,#06b6d4)'][i%4];
    const usePct=c.limit>0?Math.min(100,(cy.used/c.limit)*100):0;
    h+='<div class="cc" style="background:'+grad+'" onclick="cardDetail(\''+c.id+'\')">'+
       '<div class="ccbdg">'+esc(brandName(c.brand))+'</div><div class="ccchip">💎</div>'+
       '<div class="ccname">'+esc(c.name)+'</div><div class="ccnum">•••• '+esc(c.last4||'____')+'</div>'+
       '<div class="ccfoot"><div><div class="cclbl">חיוב קרוב'+(cy.nextDate?' · '+dLabel(cy.nextDate):'')+'</div><div class="ccamt">'+fmt(cy.nextAmount)+'</div></div>'+
       '<div class="ccopen"><div class="cclbl">צבירה פתוחה</div><div class="ccamt" style="font-size:15px">'+fmt(cy.open)+'</div></div></div>'+
       (c.limit>0?'<div class="ccbar"><i style="width:'+usePct+'%"></i></div><div class="cclbl" style="margin-top:6px">'+fmt(cy.used)+' מתוך מסגרת '+fmt(c.limit)+'</div>':'')+
       '</div>';
  });
  h+='</div>';
  const ins={};
  DB.transactions.filter(x=>x.installment&&x.chargeDate>=iso(today())).forEach(x=>{
    const g=x.installment.groupId;
    if(!ins[g])ins[g]={note:x.note,cat:x.categoryId,total:x.installment.total,left:0,sum:0,next:x.installment.index};
    ins[g].left++;ins[g].sum+=x.amount;ins[g].next=Math.min(ins[g].next,x.installment.index);
  });
  const ik=Object.keys(ins);
  if(ik.length){
    h+='<div class="box" style="margin-top:16px"><div class="stitle"><span>🧾</span> תשלומים פעילים</div>';
    ik.forEach(k=>{const g=ins[k],c=CALC.cat(g.cat);
      h+='<div class="eitem tap" onclick="installmentGroupDetail(\''+k+'\')"><div class="eico">'+c.icon+'</div><div class="einfo"><div class="ename">'+esc(g.note||c.name)+'</div>'+
        '<div class="etag">תשלום '+g.next+' מתוך '+g.total+' · נותרו '+g.left+'</div></div>'+
        '<div class="eside"><div class="eamt">'+fmt(g.sum)+'</div><div class="edate">נותר לשלם</div></div></div>';});
    h+='</div>';
  }
  return h;
}
function brandName(b){return{visa:'ויזה',mastercard:'מאסטרקארד',amex:'אמריקן אקספרס',isracard:'ישראכרט',diners:'דיינרס'}[b]||'אשראי';}
function cardDetail(id){
  const c=CALC.card(id),cy=CALC.cycle(id);
  const txs=DB.transactions.filter(x=>x.cardId===id).sort((a,b)=>b.chargeDate<a.chargeDate?-1:1);
  const groups={};txs.forEach(x=>{(groups[ym(x.chargeDate)]=groups[ym(x.chargeDate)]||[]).push(x);});
  let h='<div class="note" style="margin-bottom:16px">חיוב קרוב: <b>'+fmt(cy.nextAmount)+'</b>'+(cy.nextDate?' ב-'+dLabel(cy.nextDate):'')+' · צבירה פתוחה: <b>'+fmt(cy.open)+'</b></div>';
  const ks=Object.keys(groups).sort().reverse();
  if(!ks.length)h+='<div class="empty"><b>אין עסקאות בכרטיס</b></div>';
  ks.forEach(k=>{
    const sum=groups[k].reduce((s,x)=>s+x.amount,0);
    h+='<div class="stitle" style="margin-top:18px;font-size:13px">חיוב '+ymLabel(k)+'<span class="sright">'+fmt(sum)+'</span></div>';
    h+=groups[k].map(txRow).join('');
  });
  sheet(c.name,h);
}

/* ---------- EXPENSES ---------- */
function vExpenses(){
  const y=selYM||curYM(),m=CALC.month(y);
  let h='<div class="mbar">';
  for(let i=5;i>=0;i--){const mm=addM(curYM(),-i);h+='<button class="mbtn '+(mm===y?'active':'')+'" onclick="selYM=\''+mm+'\';render()">'+ymShort(mm)+(i===0?'':'')+'</button>';}
  h+='</div>';
  h+='<div class="seg"><button class="'+(expTab==='fixed'?'on':'')+'" onclick="expTab=\'fixed\';render()">קבועות · '+fmt(m.fixed)+'</button>'+
     '<button class="'+(expTab==='variable'?'on':'')+'" onclick="expTab=\'variable\';render()">משתנות · '+fmt(m.variable)+'</button>'+
     '<button class="'+(expTab==='income'?'on':'')+'" onclick="expTab=\'income\';render()">הכנסות · '+fmt(m.income)+'</button></div>';
  const prev=CALC.month(addM(y,-1));
  const cur=m[expTab]||0,pv=prev[expTab]||0;
  if(pv>0){const dl=((cur/pv)-1)*100;
    h+='<div class="box" style="padding:14px 16px"><div style="display:flex;justify-content:space-between;align-items:center">'+
    '<span class="mini">לעומת '+ymLabel(addM(y,-1))+'</span>'+
    '<span style="font-weight:800;font-size:14px;color:'+(dl>0?'var(--expense)':'var(--income)')+'">'+(dl>0?'▲ ':'▼ ')+Math.abs(Math.round(dl))+'%</span></div></div>';}
  const cats=DB.categories.filter(c=>c.kind===expTab);
  const rows=cats.map(c=>({c:c,v:m.byCat[c.id]||0})).filter(r=>r.v>0).sort((a,b)=>b.v-a.v);
  // פירוט לפי קטגוריה — עוגה במקום רשימת שורות (חסך מקום, בלי לאבד מידע): שם וסכום
  // כבר רואים במקרא של העוגה, ולחיצה על עיגול/שורה בעוגה פותחת חלונית עם הפרטים
  // המלאים כולל תקציב־מול־בפועל (רלוונטי בעיקר למשתנות — לקבועות אין תקציב מוגדר בכלל)
  if(rows.length){
    const palette=['#2563eb','#0ead69','#d97706','#e5383b','#7c3aed','#0891b2','#db2777','#65a30d','#f59e0b','#64748b'];
    const donutItems=rows.map((r,i)=>({n:r.c.name,v:r.v,c:palette[i%palette.length],click:'catSummary(\''+r.c.id+'\')'}));
    h+='<div class="box"><div class="stitle"><span>🍩</span> פירוט לפי קטגוריה<span class="sright">'+fmt(cur)+'</span></div><div class="dwrap">'+donut(donutItems,cur)+'</div></div>';
  }else{
    h+='<div class="box"><div class="empty"><b>'+(expTab==='income'?'אין הכנסות בחודש זה':'אין הוצאות בחודש זה')+'</b>לחץ + כדי לרשום</div></div>';
  }
  // רשימת התנועות בפועל, לפי שם — כמו "תנועות אחרונות" בדף הבית, רק מסוננת לטאב ולחודש המוצגים
  const txsAll=DB.transactions.filter(x=>ym(x.date)===y&&CALC.cat(x.categoryId).kind===expTab).sort((a,b)=>b.date<a.date?-1:1);
  h+='<div class="box"><div class="stitle"><span>🕐</span> תנועות<span class="sright">'+txsAll.length+'</span></div>';
  h+=txsAll.length?txsAll.map(txRow).join(''):'<div class="empty"><b>אין תנועות בחודש זה</b></div>';
  h+='</div>';
  if(expTab==='fixed'||expTab==='income'){
    const isInc=expTab==='income';
    // כדי לא לבלבל בין "הוצאה/הכנסה בפועל" (הקופסה למעלה) ל"כלל שיצר אותה" (כאן) — הקטגוריות
    // הבודדות למעלה כבר מספרות את כל הסיפור הכספי, אז מקפלים את הרשימה הזו כברירת מחדל
    // ופותחים אותה רק לפי בקשה, למי שבאמת צריך לנהל/להשהות/למחוק כלל
    const recs=DB.recurring.filter(r=>isInc?r.direction==='in':r.direction!=='in');
    h+='<div class="box"><div class="stitle" style="cursor:pointer" onclick="recBoxOpen=!recBoxOpen;render()"><span>⚙️</span> '+(isInc?'ניהול הכנסות קבועות':'ניהול הוראות קבע')+'<span class="sright">'+(recBoxOpen?'הסתר ▲':'הצג ▼')+'</span></div>';
    if(recBoxOpen){
      if(!recs.length)h+='<div class="empty"><b>'+(isInc?'לא הוגדרו הכנסות קבועות':'לא הוגדרו הוראות קבע')+'</b>'+(isInc?'למשכורת באותו סכום כל חודש. הכנסה שמשתנה (כמו לפי שעות) — למטה, ב"הכנסות משתנות".':'הגדר אותן פעם אחת והמערכת תרשום אותן כל חודש אוטומטית')+'</div>';
      recs.forEach(r=>{const c=CALC.cat(r.categoryId),cd=r.cardId?CALC.card(r.cardId):null;
        // שורה שלמה לחיצה שפותחת מודאל עריכה/מחיקה — אותו דפוס בדיוק כמו שורת קטגוריה למעלה
        const instTag=r.installmentTotal?' · תשלום '+Math.min(r.installmentTotal,Math.max(1,monthsBetweenYM(r.startDate,curYM())+1))+'/'+r.installmentTotal:'';
        h+='<div class="eitem tap" style="'+(r.active?'':'opacity:.5')+'" onclick="openRecurring(\''+r.id+'\')"><div class="eico">'+c.icon+'</div><div class="einfo"><div class="ename">'+esc(r.name)+(r.active?'':' · מושהה')+'</div>'+
        '<div class="etag">ב-'+r.dayOfMonth+' לחודש'+(isInc?'':' · '+(cd?esc(cd.name):'מהעו"ש'))+instTag+'</div></div>'+
        '<div class="eside"><div class="eamt'+(isInc?' in':'')+'">'+fmt(r.amount)+'</div></div></div>';});
      h+='<button class="addrow" style="margin-top:14px;margin-bottom:0" onclick="openRecurring(null,null'+(isInc?",'in'":'')+')">+ הוסף '+(isInc?'הכנסה קבועה':'הוראת קבע')+'</button>';
    }
    h+='</div>';
  }
  if(expTab==='income'){
    // הכנסה שמשתנה כל חודש (כמו לפי שעות עבודה) — לא הוראת קבע (אין לה סכום קבוע
    // ליצור ממנו תנועה לבד), רק תזכורת: "בערך ביום הזה מגיעה הכנסה כזו" + קיצור
    // דרך להזין את הסכום בפועל, וסטטוס אם כבר הוזן החודש
    h+='<div class="box"><div class="stitle"><span>🔁</span> הכנסות משתנות<span class="sright">'+DB.variableIncomes.length+'</span></div>';
    if(!DB.variableIncomes.length)h+='<div class="empty"><b>אין הכנסות משתנות מוגדרות</b>למשכורת שמשתנה כל חודש (למשל לפי שעות) — הגדר תזכורת, והמערכת תזכיר לך להזין את הסכום בפועל כל חודש</div>';
    DB.variableIncomes.forEach(v=>{
      const c=CALC.cat(v.categoryId);
      const loggedTx=DB.transactions.filter(t=>t.direction==='in'&&t.categoryId===v.categoryId&&ym(t.date)===y);
      const loggedAmt=loggedTx.reduce((s,t)=>s+t.amount,0),done=loggedTx.length>0;
      h+='<div class="eitem tap" style="'+(v.active?'':'opacity:.5')+'" onclick="openVariableIncome(\''+v.id+'\')"><div class="eico">'+c.icon+'</div><div class="einfo"><div class="ename">'+esc(v.name)+(v.active?'':' · מושהה')+'</div>'+
        '<div class="etag">בסביבות ה-'+v.dayOfMonth+' לחודש · '+(done?'הוזן החודש':'טרם הוזן החודש')+'</div></div>'+
        '<div class="eside">'+(done?'<div class="eamt in">'+fmt(loggedAmt)+'</div>':(v.active?'<button class="chip" onclick="event.stopPropagation();logVariableIncome(\''+v.id+'\')">+ הזן</button>':''))+'</div></div>';
    });
    h+='<button class="addrow" style="margin-top:14px;margin-bottom:0" onclick="openVariableIncome()">+ הוסף הכנסה משתנה</button></div>';
  }
  return h;
}
function delRec(id){
  const r=DB.recurring.find(x=>x.id===id);if(!r)return;
  // אם כבר נוצרה תנועה החודש מההוראה הזו — משאירים אותה "יתומה" (בלי לקשר אותה
  // לשום recurring) זו התנהגות מבלבלת: המשתמש רואה כסף שהוא כבר מחק עדיין נספר
  // בכל מקום (עוגה/תנועות/דף הבית). לכן, בניגוד לחודשים קודמים (שנשארים בהיסטוריה
  // בכוונה — "עריכה משפיעה קדימה בלבד"), תנועת החודש הנוכחי נמחקת יחד עם ההוראה.
  const curTxId='rec_'+id+'_'+curYM();
  const hasCurTx=DB.transactions.some(x=>x.id===curTxId);
  if(!confirm(hasCurTx?'למחוק את הוראת הקבע? התנועה שכבר נרשמה החודש הזה תימחק גם היא. תנועות מחודשים קודמים יישארו.':'למחוק את הוראת הקבע? תנועות שכבר נרשמו יישארו.'))return;
  DB.recurring=DB.recurring.filter(x=>x.id!==id);
  if(hasCurTx)DB.transactions=DB.transactions.filter(x=>x.id!==curTxId);
  save();closeSheet();render();toast('נמחק');
}
function restoreSkippedRec(recId){
  const id='rec_'+recId+'_'+curYM();
  DB.meta.skipRec=DB.meta.skipRec.filter(x=>x!==id);
  genRecurring();closeSheet();render();toast('התנועה שוחזרה');
}
/* סדרת תשלומים חד-פעמית — כל התשלומים (מכל החודשים, לא רק החודש המוצג) + מחיקת הסדרה כולה */
function installmentGroupDetail(groupId){
  const txs=DB.transactions.filter(t=>t.installment&&t.installment.groupId===groupId).sort((a,b)=>a.installment.index-b.installment.index);
  if(!txs.length)return;
  const f=txs[0],c=CALC.cat(f.categoryId),paid=txs.filter(t=>t.chargeDate<=iso(today())).length,sum=txs.reduce((s,t)=>s+t.amount,0);
  let h='<div class="note" style="margin-bottom:16px">שולם '+paid+' מתוך '+f.installment.total+' תשלומים · סכום כולל '+fmt(sum)+'</div>';
  h+=txs.map(txRow).join('');
  h+='<button class="btn dgr" style="margin-top:16px" onclick="deleteInstallmentGroup(\''+groupId+'\')">מחק את כל הסדרה</button>';
  sheet(f.note||c.name,h);
}
function deleteInstallmentGroup(groupId){
  if(!confirm('למחוק את כל סדרת התשלומים? כולל תשלומים שכבר בוצעו. הפעולה לא הפיכה.'))return;
  DB.transactions=DB.transactions.filter(t=>!(t.installment&&t.installment.groupId===groupId));
  save();closeSheet();render();toast('הסדרה נמחקה');
}

/* ---------- SAVINGS ---------- */
function vSavings(){
  const total=DB.goals.reduce((s,g)=>s+g.saved,0);
  const y=curYM(),m=CALC.month(y);
  let h='<div class="hero"><div class="hlbl"><span class="dot" style="background:var(--save)"></span>סה"כ נצבר בחיסכון</div>'+
    '<div class="hamt" style="color:var(--save)">'+fmt(total)+'</div>'+
    '<div class="hrow"><div class="hcell"><div class="cl">הופרש החודש</div><div class="cv">'+fmt(m.saving)+'</div></div>'+
    '<div class="hcell"><div class="cl">שיעור חיסכון</div><div class="cv">'+Math.round(m.saveRate)+'%</div></div></div></div>';
  const personal=DB.goals.filter(g=>g.type==='personal'),funds=DB.goals.filter(g=>g.type==='fund');
  h+='<div class="box"><div class="stitle"><span>🎯</span> יעדים אישיים</div>';
  if(!personal.length)h+='<div class="empty"><b>אין יעדים</b>הגדר יעד ותראה בדיוק מתי תגיע אליו</div>';
  personal.forEach(g=>h+=goalCard(g));
  h+='<button class="addrow" style="margin-top:14px;margin-bottom:0" onclick="openGoal(\'personal\')">+ הוסף יעד</button></div>';
  h+='<div class="box"><div class="stitle"><span>🏦</span> קרן לעתיד</div>';
  if(!funds.length)h+='<div class="empty"><b>לא הוגדרה קרן</b>חיסכון מתמשך ללא תאריך יעד</div>';
  funds.forEach(g=>h+=goalCard(g));
  h+='<button class="addrow" style="margin-top:14px;margin-bottom:0" onclick="openGoal(\'fund\')">+ הוסף קרן</button></div>';
  return h;
}
function goalCard(g){
  const r=CALC.goal(g);
  return '<div class="goal"><div class="ghead"><div><div class="gname">'+esc(g.name)+'</div>'+
   '<div class="gsub">'+fmt(g.saved)+(g.targetAmount>0?' מתוך '+fmt(g.targetAmount):'')+'</div></div>'+
   '<div style="text-align:left"><div class="gpct" style="color:'+(g.color||'#7c3aed')+'">'+Math.round(r.pct)+'%</div></div></div>'+
   '<div class="gbar"><i style="width:'+r.pct+'%;background:'+(g.color||'#7c3aed')+'"></i></div>'+
   '<div class="gfoot"><span>'+(r.need!==null?'נדרש '+fmt(r.need)+'/חודש':'מפריש '+fmt(g.monthlyPlan)+'/חודש')+'</span>'+
   '<span>'+(r.eta?'צפוי: '+r.eta:'')+'</span></div>'+
   (g.type==='fund'?goalGrowthChart(g):'')+
   (r.behind?'<div class="alert a-note" style="margin-top:11px"><div class="aic">📉</div><div class="atx"><b>בפיגור</b>ההפרשה הנוכחית ('+fmt(g.monthlyPlan)+') לא תספיק ליעד בזמן.</div></div>':'')+
   '<div class="btnrow" style="margin-top:12px"><button class="btn sec" style="padding:10px;font-size:13px" onclick="openDeposit(\''+g.id+'\')">הפקד</button>'+
   '<button class="btn dgr" style="padding:10px;font-size:13px" onclick="delGoal(\''+g.id+'\')">מחק</button></div></div>';
}
/* גרף צמיחה לקרן עתיד (סעיף 6.5 באפיון) — בנוי מתנועות ה-saving שמקושרות ל-goalId,
   עם נקודת פתיחה בערך שהוזן ידנית בעת יצירת הקרן ("כבר נצבר") */
function goalGrowthChart(g){
  const txs=DB.transactions.filter(t=>t.goalId===g.id).sort((a,b)=>a.date<b.date?-1:1);
  if(!txs.length)return '';
  const depositsSum=txs.reduce((s,t)=>s+t.amount,0);
  const start=g.createdDate||txs[0].date;
  let bal=Math.max(0,g.saved-depositsSum);
  const pts=[{date:start,bal:bal}];
  txs.forEach(t=>{bal+=t.amount;pts.push({date:t.date,bal:bal});});
  if(pts.length<2)return '';
  const W=260,H=64,pad=4;
  const vals=pts.map(p=>p.bal),mx=Math.max(...vals,1),mn=Math.min(...vals,0),rng=(mx-mn)||1;
  const X=i=>pad+(i/(pts.length-1))*(W-pad*2), Y=v=>pad+(1-(v-mn)/rng)*(H-pad*2);
  let d='';pts.forEach((p,i)=>{d+=(i?' L':'M')+X(i).toFixed(1)+' '+Y(p.bal).toFixed(1);});
  const area='M'+X(0).toFixed(1)+' '+Y(mn).toFixed(1)+' '+d.slice(1)+' L'+X(pts.length-1).toFixed(1)+' '+Y(mn).toFixed(1)+' Z';
  const col=g.color||'#7c3aed',gid='gg_'+g.id;
  return '<div style="margin-top:13px"><svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:64px;overflow:visible">'+
   '<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+col+'" stop-opacity=".25"/><stop offset="100%" stop-color="'+col+'" stop-opacity="0"/></linearGradient></defs>'+
   '<path d="'+area+'" fill="url(#'+gid+')"/><path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="2.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'+
   '</svg><div class="mini" style="display:flex;justify-content:space-between;margin-top:3px"><span>'+dLabel(pts[0].date)+'</span><span>'+dLabel(pts[pts.length-1].date)+'</span></div></div>';
}
function delGoal(id){
  if(!confirm('למחוק את היעד?'))return;
  DB.goals=DB.goals.filter(g=>g.id!==id);
  // הוראת קבע שהייתה מקושרת ליעד הזה ממשיכה לרוץ כרגיל (עדיין הפקדה לחיסכון אמיתית) —
  // רק מנתקים את הקישור, כדי לא להשאיר הפניה ליעד שכבר לא קיים
  DB.recurring.forEach(r=>{if(r.goalId===id)r.goalId=null;});
  save();render();toast('נמחק');
}

/* ---------- shared bits ---------- */
function txRow(x){
  const c=CALC.cat(x.categoryId),cd=x.cardId?CALC.card(x.cardId):null;
  return '<div class="eitem tap" onclick="openTxSmart(\''+x.id+'\')"><div class="eico">'+c.icon+'</div><div class="einfo"><div class="ename">'+esc(x.note||c.name)+'</div>'+
    '<div class="etag">'+(cd?'<span class="tdot" style="background:'+cd.color+'"></span>'+esc(cd.name):(x.method==='cash'?'מזומן':'מהעו"ש'))+
    (x.installment?' · '+x.installment.index+'/'+x.installment.total:'')+'</div></div>'+
    '<div class="eside"><div class="eamt '+(x.direction==='in'?'in':'')+'">'+(x.direction==='in'?'+':'-')+fmt(x.amount)+'</div>'+
    '<div class="edate">'+dLabel(x.date)+(x.chargeDate!==x.date?' → '+dLabel(x.chargeDate):'')+'</div></div></div>';
}
function donut(items,total){
  // it.click (אופציונלי) — שם קריאת פונקציה (מחרוזת) שתופעל בלחיצה, גם על הפלח בעוגה
  // וגם על השורה במקרא. בלי זה (למשל בעוגת "חלוקת החודש" בדף הבית) הכל נשאר לא-לחיץ
  const r=38,cx=50,cy=50,sw=15,circ=2*Math.PI*r;let off=0,svg='';
  svg+='<circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" stroke-width="15"/>';
  items.forEach(it=>{const p=total?it.v/total:0;
    svg+='<circle cx="50" cy="50" r="38" fill="none" stroke="'+it.c+'" stroke-width="15" stroke-dasharray="'+(p*circ)+' '+circ+'" stroke-dashoffset="'+(-off*circ)+'" transform="rotate(-90 50 50)"'+(it.click?' style="cursor:pointer" onclick="'+it.click+'"':'')+'/>';off+=p;});
  svg+='<text x="50" y="47" text-anchor="middle" font-size="8" fill="#64748b" font-family="Heebo">סה"כ</text>';
  svg+='<text x="50" y="59" text-anchor="middle" font-size="10" fill="#0f172a" font-weight="bold" font-family="Heebo">'+fmt(total)+'</text>';
  return '<svg class="dsvg" viewBox="0 0 100 100">'+svg+'</svg><div class="dleg">'+
    items.map(it=>'<div class="ditem"'+(it.click?' style="cursor:pointer" onclick="'+it.click+'"':'')+'><div class="dlbl"><span class="ddot" style="background:'+it.c+'"></span>'+it.n+'</div>'+
    '<div class="dval">'+fmt(it.v)+' · '+Math.round(total?it.v/total*100:0)+'%</div></div>').join('')+'</div>';
}
function afterRender(){
  requestAnimationFrame(()=>{document.querySelectorAll('.barin[data-w]').forEach(b=>{b.style.width=b.dataset.w+'%';});});
}
/* חלונית קטנה שנפתחת בלחיצה על פלח בעוגת "פירוט לפי קטגוריה" (דף הוצאות) —
   כמה יצא בקטגוריה החודש, ואם יש לה תקציב (רלוונטי בעיקר למשתנות) — גם תקציב מול בפועל */
function catSummary(catId){
  const c=CALC.cat(catId),y=selYM||curYM(),m=CALC.month(y);
  const v=m.byCat[catId]||0,bud=c.budget||0,over=bud>0&&v>bud,p=bud>0?Math.min(100,(v/bud)*100):0;
  let h='<div style="text-align:center;padding:6px 0 18px"><div style="font-size:40px;margin-bottom:6px">'+c.icon+'</div>'+
    '<div style="font-size:26px;font-weight:900">'+fmt(v)+'</div><div class="mini">'+(c.kind==='income'?'התקבל החודש':'הוצא החודש')+'</div></div>';
  if(bud>0){
    h+='<div class="barout"><div class="barin '+(over?'hi':p>85?'mid':'')+'" style="width:'+p+'%"></div></div>'+
       '<div class="barlbls"><span>₪0</span><span>'+fmt(bud)+'</span></div>'+
       '<div class="mini" style="margin-top:10px;text-align:center">תקציב '+fmt(bud)+(over?' · חריגה של '+fmt(v-bud):' · נשארו '+fmt(bud-v))+'</div>';
  }else{
    h+='<div class="mini" style="text-align:center">לא הוגדר תקציב לקטגוריה הזו</div>';
  }
  sheet(c.icon+' '+c.name,h);
}

/* ============================================================
   7. SHEETS — מודאלים
   ============================================================ */
// backFn (אופציונלי): שם פונקציה (מחרוזת, בלי ()) שפותחת את המסך ההורה — למשל
// 'openSettings'. כשמוגדר, מוצג כפתור "‹ חזרה" ליד הכותרת, בנוסף ל-✕ שסוגר לגמרי.
function sheet(title,body,onOpen,backFn){
  closeSheet();
  const ov=document.createElement('div');ov.className='ov';ov.id='ov';
  ov.innerHTML='<div class="sheet"><div class="grab"></div><div class="shead"><div class="shead-lead">'+
    (backFn?'<button class="backbtn" onclick="'+backFn+'()">‹ חזרה</button>':'')+
    '<h3 id="sheetTitle">'+esc(title)+'</h3></div><button class="xbtn" onclick="closeSheet()">✕</button></div>'+body+'</div>';
  ov.addEventListener('click',e=>{if(e.target===ov)closeSheet();});
  document.body.appendChild(ov);
  if(onOpen)onOpen();
}
function closeSheet(){const o=el('ov');if(o)o.remove();}

/* ---- הזנה מהירה ---- */
let E={dir:'out',cat:null,method:null,cardId:null,inst:1,freq:'once'};
function openEntry(){
  incType='salary';E={dir:'out',cat:null,kind:'variable',method:DB.meta.lastMethod||(DB.cards[0]?'card':'account'),cardId:DB.meta.lastCard||(DB.cards[0]?DB.cards[0].id:null),inst:1,freq:'once'};
  const b=
   '<div class="seg"><button id="dOut" class="on" onclick="setDir(\'out\')">הוצאה</button><button id="dIn" onclick="setDir(\'in\')">הכנסה</button></div>'+
   '<div class="fld"><input id="eAmt" class="amtin" type="number" inputmode="decimal" placeholder="0" oninput="prevCharge()"/></div>'+
   '<div class="fld" id="eKindWrap"><label>סוג ההוצאה</label><div id="eKinds" class="chips">'+
     '<button class="chip" data-k="fixed" onclick="setKind(this)">קבועה</button>'+
     '<button class="chip on" data-k="variable" onclick="setKind(this)">משתנה</button></div></div>'+
   '<div class="fld"><label>קטגוריה</label><div id="eCats" class="catgrid"></div></div>'+
   '<div class="fld" id="eMethodWrap"><label>אמצעי תשלום</label><div id="eMethods" class="chips"></div></div>'+
   '<div class="fld" id="eIncWrap" style="display:none"><label>סוג הכנסה</label><div class="chips">'+
     '<button class="chip on" data-it="salary" onclick="setInc(this)">משכורת</button>'+
     '<button class="chip" data-it="reserve" onclick="setInc(this)">מענק מילואים</button>'+
     '<button class="chip" data-it="other" onclick="setInc(this)">אחר</button></div></div>'+
   '<div class="row2"><div class="fld"><label>תאריך</label><input id="eDate" type="date" value="'+iso(today())+'"/></div>'+
   '<div class="fld" id="eInstWrap"><label>תדירות</label><div class="seg" id="eFreqSeg">'+
     '<button class="on" data-f="once" onclick="setFreq(\'once\')">פעם אחת</button>'+
     '<button data-f="inst" onclick="setFreq(\'inst\')">בתשלומים</button>'+
     '<button data-f="rec" onclick="setFreq(\'rec\')">הוראת קבע</button></div>'+
     '<div id="eInstCountWrap" style="display:none;margin-top:10px"><select id="eInst" onchange="prevCharge()">'+
       [2,3,4,5,6,8,10,12,18,24,36].map(n=>'<option value="'+n+'">'+n+' תשלומים</option>').join('')+'</select></div></div></div>'+
   '<div class="fld"><label>הערה</label><input id="eNote" type="text" placeholder="למשל: סופר, דלק..."/></div>'+
   '<div id="ePrev" class="note" style="margin-bottom:15px"></div>'+
   '<button class="btn" onclick="saveEntry()">שמור</button>';
  sheet('רישום תנועה',b,()=>{renderCats();renderMethods();prevCharge();
    el('eDate').addEventListener('change',prevCharge);setTimeout(()=>el('eAmt').focus(),250);});
}
function setDir(d){E.dir=d;E.cat=null;E.kind='variable';E.freq='once';
  el('dOut').classList.toggle('on',d==='out');el('dIn').classList.toggle('on',d==='in');
  el('eKindWrap').style.display=d==='out'?'':'none';
  el('eKinds').querySelectorAll('.chip').forEach(b=>b.classList.toggle('on',b.dataset.k==='variable'));
  el('eMethodWrap').style.display=d==='out'?'':'none';
  el('eIncWrap').style.display=d==='in'?'':'none';
  el('eInstWrap').style.display=d==='in'?'none':'';
  el('eFreqSeg').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.f==='once'));
  el('eInstCountWrap').style.display='none';
  renderCats();prevCharge();}
function setFreq(f){
  E.freq=f;
  el('eFreqSeg').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.f===f));
  el('eInstCountWrap').style.display=f==='inst'?'':'none';
  prevCharge();
}
let incType='salary';
function setInc(b){incType=b.dataset.it;document.querySelectorAll('[data-it]').forEach(x=>x.classList.toggle('on',x===b));}
function setKind(b){E.kind=b.dataset.k;E.cat=null;
  el('eKinds').querySelectorAll('.chip').forEach(x=>x.classList.toggle('on',x===b));
  renderCats();}
function renderCats(){
  // הבורר "סוג ההוצאה" קובע איזו קטגוריה תוצג — כל קטגוריה כבר נושאת kind קבוע
  // (fixed/variable/saving), אז הבחירה כאן היא סינון של הרשימה, לא שדה נפרד על התנועה.
  const kinds=E.dir==='in'?['income']:[E.kind];
  const cats=DB.categories.filter(c=>kinds.includes(c.kind));
  el('eCats').innerHTML=cats.map(c=>'<button class="cat'+(E.cat===c.id?' on':'')+'" data-c="'+c.id+'"><span class="ci">'+c.icon+'</span><span class="cn">'+esc(c.name)+'</span></button>').join('')+
    '<button type="button" class="cat addcat" id="catAddBtn" onclick="showAddCatInline()"><span class="ci">➕</span><span class="cn">קטגוריה חדשה</span></button>';
  el('eCats').querySelectorAll('.cat[data-c]').forEach(b=>b.onclick=()=>{E.cat=b.dataset.c;renderCats();prevCharge();});
}
/* הוספת קטגוריה חדשה בלי לצאת מרישום התנועה — טופס קטן שנפתח בתוך רשת הקטגוריות
   עצמה (לא sheet מקונן, כי sheet() לא בנוי לערימה של כמה מסכים זה על זה) */
function showAddCatInline(){
  const btn=el('catAddBtn');if(!btn)return;
  btn.outerHTML='<div id="eCatAdd" style="grid-column:1/-1;border:1.5px dashed var(--border);border-radius:14px;padding:12px;background:#f8fafc">'+
    '<div class="row2"><select id="eCatIcon" style="flex:0 0 62px">'+ICONS.map(i=>'<option value="'+i+'">'+i+'</option>').join('')+'</select>'+
    '<input id="eCatName" type="text" placeholder="שם הקטגוריה החדשה" style="flex:1"/></div>'+
    '<div class="btnrow" style="margin-top:8px"><button type="button" class="btn sec" style="padding:10px;font-size:13px" onclick="renderCats()">ביטול</button>'+
    '<button type="button" class="btn" style="padding:10px;font-size:13px" onclick="confirmAddCatInline()">הוסף</button></div></div>';
  setTimeout(()=>{const n=el('eCatName');if(n)n.focus();},50);
}
function confirmAddCatInline(){
  const name=el('eCatName').value.trim();
  if(!name)return toast('הזן שם לקטגוריה');
  const icon=el('eCatIcon').value||'🏷️';
  const id=uid('cat');
  DB.categories.push({id:id,name:name,icon:icon,kind:E.kind,budget:0});
  save();
  E.cat=id;
  renderCats();prevCharge();
  toast('הקטגוריה נוספה ✓');
}
function renderMethods(){
  let h='<button class="chip'+(E.method==='account'?' on':'')+'" data-m="account">מהעו"ש</button>'+
        '<button class="chip'+(E.method==='cash'?' on':'')+'" data-m="cash">מזומן</button>';
  DB.cards.forEach(c=>{h+='<button class="chip'+(E.method==='card'&&E.cardId===c.id?' on':'')+'" data-m="card" data-id="'+c.id+'">'+esc(c.name)+'</button>';});
  el('eMethods').innerHTML=h;
  el('eMethods').querySelectorAll('.chip').forEach(b=>b.onclick=()=>{E.method=b.dataset.m;E.cardId=b.dataset.id||null;renderMethods();prevCharge();});
}
function prevCharge(){
  const p=el('ePrev');if(!p)return;
  const dt=el('eDate').value||iso(today());
  if(E.dir==='in'){p.innerHTML='💰 ההכנסה תיזקף לעו"ש בתאריך '+dLabel(dt);return;}
  if(E.freq==='rec'){
    const amt=parseFloat(el('eAmt').value)||0;
    p.innerHTML='🔁 תיווצר הוראת קבע: '+fmt(amt)+' בכל '+(+dt.slice(8,10))+' לחודש, מהחודש הזה ועד שתמחק אותה.';
    return;
  }
  const n=E.freq==='inst'?+((el('eInst')||{}).value||2):1;
  if(E.method==='card'&&E.cardId){
    const c=CALC.card(E.cardId),cd=CALC.chargeDate(dt,c);
    p.innerHTML='💳 ירד מהעו"ש ב-<b>'+dLabel(cd)+'</b>'+(n>1?' — ואז עוד '+(n-1)+' תשלומים חודשיים':'');
  }else p.innerHTML='🏦 ירד מהעו"ש מיד בתאריך '+dLabel(dt);
}
function saveEntry(){
  const amt=parseFloat(el('eAmt').value);
  if(!amt||amt<=0)return toast('הזן סכום');
  if(!E.cat)return toast('בחר קטגוריה');
  const dt=el('eDate').value||iso(today());
  const note=el('eNote').value.trim();
  if(E.dir==='in'){
    DB.transactions.push({id:uid('tx'),direction:'in',amount:amt,date:dt,chargeDate:dt,
      categoryId:E.cat,method:'account',cardId:null,note:note,installment:null,recurringId:null,incomeType:incType});
  }else if(E.freq==='rec'){
    // "הוראת קבע" מתוך ההזנה המהירה — אותו מנגנון בדיוק כמו הוספה דרך דף ההוצאות,
    // רק בלי לצאת מה-FAB. startDate = תחילת החודש הנוכחי, לא "היום" (ר' saveRec).
    const isCard=E.method==='card',c=CALC.cat(E.cat);
    DB.recurring.push({id:uid('rec'),name:note||c.name,amount:amt,categoryId:E.cat,
      method:isCard?'card':'account',cardId:isCard?E.cardId:null,dayOfMonth:+dt.slice(8,10),
      startDate:curYM()+'-01',endDate:null,active:true,direction:'out',installmentTotal:null});
    DB.meta.lastMethod=E.method;DB.meta.lastCard=E.cardId;
    save();genRecurring();closeSheet();render();toast('נוספה הוראת קבע ✓');
    return;
  }else{
    const n=E.freq==='inst'?+(el('eInst').value||2):1,card=E.method==='card'?CALC.card(E.cardId):null;
    const per=Math.round((amt/n)*100)/100,gid=uid('ins');
    for(let i=0;i<n;i++){
      let d=dt,cd;
      if(card){cd=CALC.chargeDate(dt,card);if(i>0)cd=dayIn(addM(ym(cd),i),card.chargeDay);}
      else{cd=i===0?dt:dayIn(addM(ym(dt),i),+dt.slice(8,10));}
      DB.transactions.push({id:uid('tx'),direction:'out',amount:per,date:d,chargeDate:cd,
        categoryId:E.cat,method:E.method,cardId:card?card.id:null,note:note,
        installment:n>1?{groupId:gid,index:i+1,total:n}:null,recurringId:null,incomeType:null});
    }
    DB.meta.lastMethod=E.method;DB.meta.lastCard=E.cardId;
  }
  save();closeSheet();render();toast('נרשם ✓');
}

/* ---- עריכה ומחיקה של תנועה ---- */
let TX=null;
function openTx(id){
  const x=DB.transactions.find(t=>t.id===id);if(!x)return;
  TX=id;
  const c=CALC.cat(x.categoryId),cd=x.cardId?CALC.card(x.cardId):null;
  const isRec=!!x.recurringId, ins=x.installment;
  const cats=DB.categories.filter(k=>x.direction==='in'?k.kind==='income':k.kind!=='income');
  let h='';
  if(isRec)h+='<div class="note" style="margin-bottom:15px">נוצר אוטומטית מהוראת הקבע "'+esc(x.note)+'". מחיקה כאן מוחקת את המופע של החודש בלבד — ההוראה תמשיך לחודשים הבאים.</div>';
  if(ins)h+='<div class="note" style="margin-bottom:15px">תשלום '+ins.index+' מתוך '+ins.total+'. אפשר למחוק את התשלום הבודד או את כל הסדרה.</div>';
  h+='<div class="fld"><label>סכום</label><input id="tAmt" class="amtin" type="number" inputmode="decimal" value="'+x.amount+'"/></div>'+
     '<div class="fld"><label>קטגוריה</label><select id="tCat">'+cats.map(k=>'<option value="'+k.id+'" '+(k.id===x.categoryId?'selected':'')+'>'+k.icon+' '+esc(k.name)+'</option>').join('')+'</select></div>'+
     '<div class="fld"><label>תאריך ההוצאה</label><input id="tDate" type="date" value="'+x.date+'"/></div>'+
     '<div class="fld"><label>הערה</label><input id="tNote" type="text" value="'+esc(x.note||'')+'"/></div>'+
     '<div class="note" style="margin-bottom:16px">'+(cd?'💳 '+esc(cd.name)+' · ירד מהעו"ש ב-'+dLabel(x.chargeDate):(x.method==='cash'?'💵 מזומן — לא משפיע על העו"ש':'🏦 מהעו"ש ב-'+dLabel(x.chargeDate)))+'</div>'+
     '<button class="btn" onclick="saveTx()">שמור שינויים</button>'+
     '<button class="btn dgr" style="margin-top:10px" onclick="delTx(false)">מחק תנועה</button>'+
     (ins?'<button class="btn dgr" style="margin-top:8px" onclick="delTx(true)">מחק את כל '+ins.total+' התשלומים</button>':'');
  sheet('פרטי תנועה',h);
}
function saveTx(){
  const x=DB.transactions.find(t=>t.id===TX);if(!x)return;
  const a=parseFloat(el('tAmt').value);
  if(!a||a<=0)return toast('הזן סכום');
  const nd=el('tDate').value||x.date;
  x.amount=a;x.categoryId=el('tCat').value;x.note=el('tNote').value.trim();
  if(nd!==x.date){
    x.date=nd;
    x.chargeDate=x.cardId?CALC.chargeDate(nd,CALC.card(x.cardId)):nd;
  }
  save();closeSheet();render();toast('עודכן ✓');
}
function delTx(whole){
  const x=DB.transactions.find(t=>t.id===TX);if(!x)return;
  const gid=x.installment?x.installment.groupId:null;
  if(!confirm(whole?'למחוק את כל סדרת התשלומים?':'למחוק את התנועה?'))return;
  if(whole&&gid){
    DB.transactions.filter(t=>t.installment&&t.installment.groupId===gid)
      .forEach(t=>{if(t.recurringId)DB.meta.skipRec.push(t.id);});
    DB.transactions=DB.transactions.filter(t=>!(t.installment&&t.installment.groupId===gid));
  }else{
    if(x.recurringId)DB.meta.skipRec.push(x.id);
    DB.transactions=DB.transactions.filter(t=>t.id!==x.id);
  }
  save();closeSheet();render();toast('נמחק');
}

/* ---- עריכת תנועה בודדת — תבנית אחידה לפי סוג הקטגוריה (קבועה/משתנה), לבקשת המשתמש:
   קבועה = אותו טופס בדיוק כמו הוראת קבע (כי "קבועה" מטבעה חוזרת כל חודש או בתשלומים —
   אין באמת "הוצאה קבועה חד-פעמית"), משתנה = טופס פשוט יותר, תמיד חד-פעמית. ---- */
function openTxSmart(id){
  const x=DB.transactions.find(t=>t.id===id);if(!x)return;
  // סדרת תשלומים (תוכנית תשלומים חד-פעמית) מנוהלת במסך הייעודי שלה (כמה שולם, מחיקת כל
  // הסדרה) — לא דרך התבניות החדשות, כדי לא לאבד את המידע הזה
  if(x.installment)return openTx(id);
  const kind=CALC.cat(x.categoryId).kind;
  if(kind==='fixed')return openFixedEdit(id);
  if(kind==='variable')return openVariableEdit(id);
  return openTx(id);
}
function openFixedEdit(id){
  const x=DB.transactions.find(t=>t.id===id);if(!x)return;
  // אם כבר יש הוראת קבע פעילה לקטגוריה הזו — עורכים את הכלל עצמו, לא את המופע הבודד
  const rec=DB.recurring.find(r=>r.categoryId===x.categoryId&&r.direction!=='in'&&r.active);
  if(rec)return openRecurring(rec.id);
  TX=id;
  const cats=DB.categories.filter(k=>k.kind==='fixed'),day=+x.date.slice(8,10);
  sheet('עריכת הוצאה קבועה',
   '<div class="note" style="margin-bottom:15px">💡 "שמור" עורך רק את התנועה הזו. "הפוך להוראת קבע" יוצר בנוסף חיוב אוטומטי שיירשם לבד כל חודש מעכשיו — שתי פעולות נפרדות, לא קורה אחת בלי שתבקש.</div>'+
   '<div class="fld"><label>שם ההוצאה</label><input id="rName" type="text" value="'+esc(x.note||CALC.cat(x.categoryId).name)+'"/></div>'+
   '<div class="fld"><label>קטגוריה</label><select id="rCat">'+cats.map(k=>'<option value="'+k.id+'" '+(k.id===x.categoryId?'selected':'')+'>'+k.icon+' '+esc(k.name)+'</option>').join('')+'</select></div>'+
   '<div class="row2"><div class="fld"><label>אמצעי תשלום</label><select id="rMethod"><option value="account" '+(!x.cardId?'selected':'')+'>מהעו"ש</option>'+
     DB.cards.map(c=>'<option value="'+c.id+'" '+(x.cardId===c.id?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></div>'+
   '<div class="fld"><label>יום בחודש</label><input id="rDay" type="number" min="1" max="31" value="'+day+'"/></div></div>'+
   '<div class="fld"><label>סכום</label><input id="rAmt" type="number" inputmode="decimal" placeholder="0" value="'+x.amount+'"/></div>'+
   '<button class="btn sec" onclick="saveFixedTxOnly(\''+id+'\')">שמור (רק את התנועה הזו)</button>'+
   '<div class="fld" style="margin-top:18px"><label>סוג הוראת קבע (אופציונלי — רק אם לוחצים למטה)</label><div class="seg"><button id="rTypeReg" class="on" onclick="setRecType(false)">רגיל · כל חודש</button><button id="rTypeInst" onclick="setRecType(true)">תשלומים · מספר קבוע</button></div></div>'+
   '<div id="rRegWrap" class="mini">משתמש בסכום שהוזן למעלה כסכום החודשי הקבוע.</div>'+
   '<div id="rInstWrap" style="display:none"><div class="row2"><div class="fld"><label>סכום כולל</label><input id="rTotal" type="number" inputmode="decimal" placeholder="0"/></div>'+
     '<div class="fld"><label>מספר תשלומים</label><input id="rCount" type="number" min="2" value="12"/></div></div>'+
     '<div class="mini" id="rInstPrev" style="margin-bottom:4px"></div></div>'+
   '<button class="btn" style="margin-top:8px" onclick="saveFixedEdit(\''+id+'\')">הפוך להוראת קבע</button>'+
   '<button class="btn dgr" style="margin-top:10px" onclick="delTx(false)">מחק תנועה</button>',
   ()=>{updateInstPreview();['rTotal','rCount'].forEach(iid=>{const e=el(iid);if(e)e.addEventListener('input',updateInstPreview);});});
}
/* "שמור" — עורך רק את התנועה הבודדת הזו, בלי ליצור הוראת קבע. זה ההבדל המרכזי
   מ-saveFixedEdit: שינוי שם/סכום לא אמור "להחליט" בשביל המשתמש שהוא רוצה אוטומציה */
function saveFixedTxOnly(txId){
  const x=DB.transactions.find(t=>t.id===txId);if(!x)return;
  const n=el('rName').value.trim(),d=+el('rDay').value,amount=parseFloat(el('rAmt').value);
  if(!n)return toast('הזן שם');
  if(!amount||amount<=0)return toast('הזן סכום');
  const mv=el('rMethod').value,isCard=mv!=='account';
  const newDate=dayIn(ym(x.date),d);
  x.note=n;x.categoryId=el('rCat').value;x.amount=amount;x.date=newDate;
  x.method=isCard?'card':'account';x.cardId=isCard?mv:null;
  x.chargeDate=isCard?CALC.chargeDate(newDate,CALC.card(mv)):newDate;
  save();closeSheet();render();toast('עודכן ✓');
}
function saveFixedEdit(txId){
  const n=el('rName').value.trim(),d=+el('rDay').value;
  if(!n)return toast('הזן שם');
  const mv=el('rMethod').value,isCard=mv!=='account';
  const isInst=el('rTypeInst').classList.contains('on');
  const start=curYM()+'-01';
  let amount,installmentTotal=null,endDate=null;
  if(isInst){
    const total=parseFloat(el('rTotal').value),count=+el('rCount').value;
    if(!total||total<=0||!count||count<2)return toast('הזן סכום כולל ומספר תשלומים (לפחות 2)');
    amount=Math.round((total/count)*100)/100;installmentTotal=count;
    endDate=dayIn(addM(start,count-1),d);
  }else{
    amount=parseFloat(el('rAmt').value);
    if(!amount||amount<=0)return toast('הזן סכום');
  }
  DB.recurring.push({id:uid('rec'),name:n,amount:amount,categoryId:el('rCat').value,
    method:isCard?'card':'account',cardId:isCard?mv:null,dayOfMonth:d,
    startDate:start,endDate:endDate,active:true,direction:'out',installmentTotal:installmentTotal,goalId:null});
  // התנועה הבודדת הישנה מוחלפת בתנועה שההוראה החדשה תייצר לחודש הנוכחי — כדי שלא ייספר פעמיים
  DB.transactions=DB.transactions.filter(t=>t.id!==txId);
  save();genRecurring();closeSheet();render();toast('נשמר כהוראת קבע');
}
function openVariableEdit(id){
  const x=DB.transactions.find(t=>t.id===id);if(!x)return;
  TX=id;
  const cd=x.cardId?CALC.card(x.cardId):null,cats=DB.categories.filter(k=>k.kind==='variable');
  sheet('עריכת הוצאה משתנה',
   '<div class="fld"><input id="vAmt" class="amtin" type="number" inputmode="decimal" value="'+x.amount+'"/></div>'+
   '<div class="fld"><label>שם ההוצאה</label><input id="vName" type="text" value="'+esc(x.note||'')+'"/></div>'+
   '<div class="fld"><label>קטגוריה</label><select id="vCat">'+cats.map(k=>'<option value="'+k.id+'" '+(k.id===x.categoryId?'selected':'')+'>'+k.icon+' '+esc(k.name)+'</option>').join('')+'</select></div>'+
   '<div class="row2"><div class="fld"><label>אמצעי תשלום</label><select id="vMethod"><option value="cash" '+(x.method==='cash'?'selected':'')+'>מזומן</option><option value="account" '+(x.method==='account'?'selected':'')+'>מהעו"ש</option>'+
     DB.cards.map(c=>'<option value="'+c.id+'" '+(x.cardId===c.id?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></div>'+
   '<div class="fld"><label>תאריך ההוצאה</label><input id="vDate" type="date" value="'+x.date+'"/></div></div>'+
   '<button class="btn" onclick="saveVariableEdit(\''+id+'\')">שמור שינויים</button>'+
   '<button class="btn dgr" style="margin-top:10px" onclick="delTx(false)">מחק תנועה</button>');
}
function saveVariableEdit(txId){
  const x=DB.transactions.find(t=>t.id===txId);if(!x)return;
  const a=parseFloat(el('vAmt').value);
  if(!a||a<=0)return toast('הזן סכום');
  const mv=el('vMethod').value,isCard=mv!=='account'&&mv!=='cash';
  x.amount=a;x.categoryId=el('vCat').value;x.note=el('vName').value.trim();
  x.method=isCard?'card':mv;x.cardId=isCard?mv:null;
  const nd=el('vDate').value||x.date;
  x.date=nd;x.chargeDate=isCard?CALC.chargeDate(nd,CALC.card(mv)):nd;
  save();closeSheet();render();toast('עודכן ✓');
}

/* ---- ניהול קטגוריות ---- */
let tmpCats=[];
const ICONS=['🏠','🚗','⚡','🏛️','📱','🌐','💊','🎬','💪','🛡️','🛒','⛽','🍔','🎉','👕','🛋️','🎒','🏥','🚌','🛍️','🪙','💼','🎖️','➕','✈️','🎁','📚','🐶','💇','🔧','☕','🍼'];
// תצוגת "אקורדיון": כל קטגוריה מוצגת כשורה קומפקטית אחת (כמו שאר הרשימות
// באפליקציה) ורק הקטגוריה שנלחצה נפתחת לשדות העריכה המלאים — כדי שרשימה
// של 20+ קטגוריות תישאר קלילה לסריקה ולא תיאלץ גלילה ארוכה של כרטיסים
// גדולים. catEditIdx מצביע לאינדקס הפתוח היחיד (או null אם הרשימה סגורה).
let catEditIdx=null;
function openCats(){
  tmpCats=JSON.parse(JSON.stringify(DB.categories));
  catEditIdx=null;
  sheet('קטגוריות',
   '<div class="note" style="margin-bottom:14px">התקציב רלוונטי לקטגוריות משתנות — הוא מזין את מד ההתקדמות והתראת קצב ההוצאות. לחץ על קטגוריה כדי לערוך אותה.</div>'+
   '<div id="catRows"></div><button class="addrow" onclick="addCatRow()">+ הוסף קטגוריה</button>'+
   '<button class="btn" onclick="saveCats()">שמור</button>',paintCats,'openSettings');
}
function toggleCatEdit(i){catEditIdx=catEditIdx===i?null:i;paintCats();}
function paintCats(){
  const w=el('catRows');if(!w)return;
  const order={fixed:0,variable:1,saving:2,income:3};
  const lbl={fixed:'קבועה',variable:'משתנה',saving:'חיסכון',income:'הכנסה'};
  const idx=tmpCats.map((c,i)=>i).sort((a,b)=>order[tmpCats[a].kind]-order[tmpCats[b].kind]);
  let last=null,h='';
  idx.forEach(i=>{
    const c=tmpCats[i];
    if(c.kind!==last){last=c.kind;h+='<div class="stitle" style="font-size:13px;margin:18px 0 10px">'+lbl[c.kind]+'</div>';}
    if(catEditIdx!==i){
      const budgetTag=c.kind==='variable'&&c.budget?' · תקציב '+fmt(c.budget):'';
      h+='<div class="eitem tap" onclick="toggleCatEdit('+i+')"><div class="eico">'+c.icon+'</div><div class="einfo"><div class="ename">'+esc(c.name||'(ללא שם)')+'</div>'+
        '<div class="etag">'+lbl[c.kind]+budgetTag+'</div></div></div>';
      return;
    }
    const used=DB.transactions.filter(t=>t.categoryId===c.id).length;
    h+='<div class="cardrow"><div class="crh"><span>'+(used?used+' תנועות':'לא בשימוש')+'</span>'+
      '<button class="delx" onclick="rmCat('+i+')">✕</button></div>'+
      '<div class="row2"><div class="fld"><input placeholder="שם" value="'+esc(c.name)+'" oninput="tmpCats['+i+'].name=this.value"/></div>'+
      '<div class="fld"><select onchange="tmpCats['+i+'].icon=this.value">'+ICONS.map(ic=>'<option value="'+ic+'" '+(c.icon===ic?'selected':'')+'>'+ic+'</option>').join('')+'</select></div></div>'+
      '<div class="row2"><div class="fld"><label>סוג</label><select onchange="tmpCats['+i+'].kind=this.value;paintCats()">'+
        ['fixed','variable','saving','income'].map(k=>'<option value="'+k+'" '+(c.kind===k?'selected':'')+'>'+lbl[k]+'</option>').join('')+'</select></div>'+
      '<div class="fld"><label>תקציב חודשי</label><input type="number" value="'+(c.budget||0)+'" oninput="tmpCats['+i+'].budget=+this.value"/></div></div>'+
      '<button class="btn sec" style="margin-top:2px" onclick="toggleCatEdit('+i+')">סגור</button></div>';
  });
  w.innerHTML=h;
}
function addCatRow(){tmpCats.push({id:uid('cat'),name:'',icon:'🛍️',kind:'variable',budget:0});catEditIdx=tmpCats.length-1;paintCats();}
function rmCat(i){
  const c=tmpCats[i],used=DB.transactions.filter(t=>t.categoryId===c.id);
  if(used.length){
    const fb=tmpCats.find(x=>x.kind===c.kind&&x.id!==c.id);
    if(!fb)return toast('אי אפשר למחוק — אין קטגוריה חלופית');
    if(!confirm('ל"'+c.name+'" יש '+used.length+' תנועות. הן יועברו ל"'+fb.name+'". להמשיך?'))return;
    used.forEach(t=>t.categoryId=fb.id);
  }
  tmpCats.splice(i,1);catEditIdx=null;paintCats();
}
function saveCats(){
  const clean=tmpCats.filter(c=>c.name.trim());
  if(!clean.some(c=>c.kind==='saving'))return toast('חייבת להישאר קטגוריית חיסכון אחת');
  if(!clean.some(c=>c.kind==='income'))return toast('חייבת להישאר קטגוריית הכנסה אחת');
  DB.categories=clean;
  const ids=clean.map(c=>c.id);
  // תנועה/הוראת קבע שאיבדו את הקטגוריה שלהן (למשל שם נוקה בלי ללחוץ על מחיקה) עוברות
  // לקטגוריית ברירת מחדל מאותו הסוג שהיה להן — לא סתם ל-variable, כדי לא להפוך בטעות
  // חיסכון/הכנסה להוצאה משתנה ולעוות את הסיכומים (עקרון "חיסכון אינו הוצאה", סעיף 4.5).
  const orphanKind=id=>{const o=tmpCats.find(c=>c.id===id);return o?o.kind:'variable';};
  const fallbackFor=kind=>clean.find(c=>c.kind===kind)||clean.find(c=>c.kind==='variable');
  DB.transactions.forEach(t=>{if(ids.indexOf(t.categoryId)<0)t.categoryId=fallbackFor(orphanKind(t.categoryId)).id;});
  DB.recurring.forEach(r=>{if(ids.indexOf(r.categoryId)<0)r.categoryId=fallbackFor(orphanKind(r.categoryId)).id;});
  save();closeSheet();render();toast('נשמר');
}

/* ---- סנכרון יתרה ---- */
function openSync(){
  sheet('עדכון יתרה מהבנק',
   '<div class="note" style="margin-bottom:16px">היתרה מתעדכנת לבד מכל תנועה. השתמש בזה רק אם נוצר פער מול הבנק — למשל עמלה או חיוב שלא רשמת.</div>'+
   '<div class="fld"><label>יתרה נוכחית בבנק</label><input id="sBal" class="amtin" type="number" inputmode="decimal" value="'+Math.round(CALC.balance())+'"/></div>'+
   '<button class="btn" onclick="doSync()">עדכן</button>');
}
function doSync(){
  const v=parseFloat(el('sBal').value);
  if(isNaN(v))return toast('הזן סכום');
  DB.account.openingBalance=v;DB.account.openingDate=iso(today());DB.account.lastUpdated=iso(today());
  save();closeSheet();render();toast('היתרה עודכנה');
}

/* ---- הוראת קבע ---- */
// recDir: כיוון ההוראה שנפתחת כרגע ('out' = הוצאה קבועה/חיסכון, 'in' = הכנסה קבועה).
// המתג בין השניים מוצג רק בהוספה חדשה — עריכת הוראה קיימת לא משנה את הכיוון שלה
// (כמו כל שינוי אחר באפליקציה: עריכה משפיעה קדימה, לא הופכת את אופי הרשומה).
let recDir='out';
function recCatOptions(selCat){
  const cats=DB.categories.filter(c=>recDir==='in'?c.kind==='income':(c.kind==='fixed'||c.kind==='saving'));
  return cats.map(c=>'<option value="'+c.id+'" '+(selCat===c.id?'selected':'')+'>'+c.icon+' '+esc(c.name)+'</option>').join('');
}
function recMethodDayHTML(r){
  if(recDir==='in')return '<div class="fld"><label>יום בחודש</label><input id="rDay" type="number" min="1" max="31" value="'+(r?r.dayOfMonth:5)+'"/></div>';
  return '<div class="row2"><div class="fld"><label>אמצעי תשלום</label><select id="rMethod"><option value="account" '+(r&&r.method==='account'?'selected':'')+'>מהעו"ש</option>'+
    DB.cards.map(c=>'<option value="'+c.id+'" '+(r&&r.cardId===c.id?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></div>'+
    '<div class="fld"><label>יום בחודש</label><input id="rDay" type="number" min="1" max="31" value="'+(r?r.dayOfMonth:5)+'"/></div></div>';
}
function recAmtSectionHTML(r,isInst){
  if(recDir==='in')return '<div class="fld"><label>סכום חודשי</label><input id="rAmt" type="number" inputmode="decimal" placeholder="0" value="'+(r?r.amount:'')+'"/></div>';
  return '<div class="fld"><label>סוג הוראה</label><div class="seg"><button id="rTypeReg" class="'+(isInst?'':'on')+'" onclick="setRecType(false)">רגיל · כל חודש</button><button id="rTypeInst" class="'+(isInst?'on':'')+'" onclick="setRecType(true)">תשלומים · מספר קבוע</button></div></div>'+
   '<div id="rRegWrap" style="display:'+(isInst?'none':'')+'"><div class="fld"><label>סכום חודשי</label><input id="rAmt" type="number" inputmode="decimal" placeholder="0" value="'+(r&&!isInst?r.amount:'')+'"/></div></div>'+
   '<div id="rInstWrap" style="display:'+(isInst?'':'none')+'"><div class="row2"><div class="fld"><label>סכום כולל</label><input id="rTotal" type="number" inputmode="decimal" placeholder="0" value="'+(isInst?Math.round(r.amount*r.installmentTotal*100)/100:'')+'"/></div>'+
     '<div class="fld"><label>מספר תשלומים</label><input id="rCount" type="number" min="2" value="'+(isInst?r.installmentTotal:12)+'"/></div></div>'+
     '<div class="mini" id="rInstPrev" style="margin-bottom:4px"></div>'+
     (isInst?'<div class="mini">כבר בוצעו '+monthsBetweenYM(r.startDate,curYM())+' מתוך '+r.installmentTotal+' תשלומים</div>':'')+'</div>';
}
function openRecurring(editId,presetCatId,presetDir){
  const r=editId?DB.recurring.find(x=>x.id===editId):null;
  recDir=r?r.direction:(presetDir||'out');
  const isInst=r?!!r.installmentTotal:false;
  const selCat=r?r.categoryId:presetCatId;
  // אם התנועה של החודש הנוכחי נמחקה ידנית בעבר (skipRec) — ההוראה עדיין פעילה
  // אבל החודש הזה נשאר "ריק" בכוונה. זו הכניסה הזמינה תמיד לשחזור, גם כשלקטגוריה
  // עצמה אין שום תנועה החודש ואי אפשר להגיע אליה דרך שורת קטגוריה.
  const skippedThisMonth=r&&DB.meta.skipRec.includes('rec_'+r.id+'_'+curYM())&&!DB.transactions.some(t=>t.id==='rec_'+r.id+'_'+curYM());
  sheet(r?(recDir==='in'?'עריכת הכנסה קבועה':'עריכת הוראת קבע'):(recDir==='in'?'הכנסה קבועה חדשה':'הוראת קבע חדשה'),
   (skippedThisMonth?'<div class="note" style="margin-bottom:15px">⚠️ התנועה של החודש הזה נמחקה בעבר ולא תיווצר מחדש לבד.<br/><button class="lnk" onclick="restoreSkippedRec(\''+r.id+'\')" style="color:var(--expense)">שחזר את התנועה</button></div>':'')+
   (r?'':'<div class="seg"><button id="rDirOut" class="'+(recDir==='out'?'on':'')+'" onclick="setRecDir(\'out\')">הוצאה קבועה</button><button id="rDirIn" class="'+(recDir==='in'?'on':'')+'" onclick="setRecDir(\'in\')">הכנסה קבועה</button></div>')+
   '<div class="fld"><label>שם</label><input id="rName" type="text" placeholder="'+(recDir==='in'?'הכנסה נוספת':'ביטוח רכב')+'" value="'+(r?esc(r.name):'')+'"/></div>'+
   '<div class="fld"><label>קטגוריה</label><select id="rCat">'+recCatOptions(selCat)+'</select></div>'+
   '<div class="fld" id="rIncTypeWrap" style="display:'+(recDir==='in'?'':'none')+'"><label>סוג הכנסה</label><select id="rIncType">'+
     [['salary','משכורת'],['reserve','מענק מילואים'],['other','אחר']].map(function(p){return '<option value="'+p[0]+'" '+((r?r.incomeType===p[0]:p[0]==='salary')?'selected':'')+'>'+p[1]+'</option>';}).join('')+'</select></div>'+
   (DB.goals.length?'<div class="fld" id="rGoalWrap" style="display:'+(recDir==='in'?'none':'')+'"><label>קשר ליעד חיסכון (אופציונלי)</label><select id="rGoal"><option value="">ללא — לא קשור ליעד</option>'+
     DB.goals.map(g=>'<option value="'+g.id+'" '+(r&&r.goalId===g.id?'selected':'')+'>'+esc(g.name)+'</option>').join('')+'</select>'+
     '<div class="hint">אם ההוראה היא הפקדה לחיסכון — קשר אותה ליעד כדי שהוא יתעדכן אוטומטית בכל חיוב</div></div>':'')+
   '<div id="rMethodDaySection">'+recMethodDayHTML(r)+'</div>'+
   '<div id="rAmtSection">'+recAmtSectionHTML(r,isInst)+'</div>'+
   '<button class="btn" style="margin-top:8px" onclick="saveRec('+(r?"'"+r.id+"'":'null')+')">שמור</button>'+
   (r?'<button class="btn sec" style="margin-top:10px" onclick="toggleRec(\''+r.id+'\')">'+(r.active?'השהה הוראה':'הפעל מחדש')+'</button>':'')+
   (r?'<button class="btn dgr" style="margin-top:10px" onclick="delRec(\''+r.id+'\')">מחק</button>':''),
   ()=>{updateInstPreview();['rTotal','rCount'].forEach(id=>{const e=el(id);if(e)e.addEventListener('input',updateInstPreview);});});
}
function setRecDir(dir){
  recDir=dir;
  el('sheetTitle').textContent=dir==='in'?'הכנסה קבועה חדשה':'הוראת קבע חדשה';
  el('rDirOut').classList.toggle('on',dir==='out');
  el('rDirIn').classList.toggle('on',dir==='in');
  el('rName').placeholder=dir==='in'?'הכנסה נוספת':'ביטוח רכב';
  el('rCat').innerHTML=recCatOptions(null);
  el('rIncTypeWrap').style.display=dir==='in'?'':'none';
  if(el('rGoalWrap'))el('rGoalWrap').style.display=dir==='in'?'none':'';
  el('rMethodDaySection').innerHTML=recMethodDayHTML(null);
  el('rAmtSection').innerHTML=recAmtSectionHTML(null,false);
}
function setRecType(isInst){
  el('rTypeReg').classList.toggle('on',!isInst);el('rTypeInst').classList.toggle('on',isInst);
  el('rRegWrap').style.display=isInst?'none':'';el('rInstWrap').style.display=isInst?'':'none';
  updateInstPreview();
}
function updateInstPreview(){
  const p=el('rInstPrev');if(!p)return;
  const total=parseFloat((el('rTotal')||{}).value)||0,n=+((el('rCount')||{}).value)||0;
  p.textContent=(total>0&&n>1)?'כל תשלום: '+fmt(Math.round((total/n)*100)/100)+' · סה"כ '+n+' תשלומים':'';
}
function saveRec(editId){
  const n=el('rName').value.trim(),d=+el('rDay').value;
  if(!n)return toast('הזן שם');
  const isOut=recDir==='out';
  const mv=isOut?el('rMethod').value:'account',isCard=isOut&&mv!=='account';
  const isInst=isOut&&el('rTypeInst')&&el('rTypeInst').classList.contains('on');
  const existing=editId?DB.recurring.find(x=>x.id===editId):null;
  const start=existing?existing.startDate:(curYM()+'-01');
  let amount,installmentTotal=null,endDate=null;
  if(isInst){
    const total=parseFloat(el('rTotal').value),count=+el('rCount').value;
    if(!total||total<=0||!count||count<2)return toast('הזן סכום כולל ומספר תשלומים (לפחות 2)');
    amount=Math.round((total/count)*100)/100;installmentTotal=count;
    // תאריך הסיום = יום החיוב, בחודש של התשלום האחרון
    endDate=dayIn(addM(start,count-1),d);
  }else{
    amount=parseFloat(el('rAmt').value);
    if(!amount||amount<=0)return toast('הזן סכום');
  }
  const goalId=isOut&&el('rGoal')?(el('rGoal').value||null):null;
  const incomeType=isOut?null:(el('rIncType').value||'salary');
  if(existing){
    // עריכה משפיעה קדימה בלבד — תנועות שכבר נוצרו בעבר לא משתנות רטרואקטיבית
    existing.name=n;existing.amount=amount;existing.dayOfMonth=d;existing.categoryId=el('rCat').value;
    existing.method=isCard?'card':'account';existing.cardId=isCard?mv:null;
    existing.installmentTotal=installmentTotal;existing.endDate=endDate;existing.goalId=goalId;
    if(!isOut)existing.incomeType=incomeType;
    save();genRecurring();closeSheet();render();toast('עודכן');
    return;
  }
  DB.recurring.push({id:uid('rec'),name:n,amount:amount,categoryId:el('rCat').value,
    direction:recDir,incomeType:incomeType,
    method:isCard?'card':'account',cardId:isCard?mv:null,dayOfMonth:d,
    // תחילת החודש הנוכחי, לא "היום" — אחרת מופע החודש הזה נבלע אם יום החיוב כבר עבר
    // (למשל מוסיפים הוראת קבע ל-5 לחודש כשהיום כבר ה-15, וה"היום" כ-startDate היה מדלג עליו)
    startDate:start,endDate:endDate,active:true,installmentTotal:installmentTotal,goalId:goalId});
  save();genRecurring();closeSheet();render();toast(isInst?'נוספה תוכנית תשלומים':(isOut?'נוספה הוראת קבע':'נוספה הכנסה קבועה'));
}
function toggleRec(id){
  const r=DB.recurring.find(x=>x.id===id);if(!r)return;
  r.active=!r.active;save();genRecurring();closeSheet();render();toast(r.active?'ההוראה הופעלה מחדש':'ההוראה הושהתה');
}

/* ---- הכנסה משתנה (למשל משכורת שעתית) ----
   לא הוראת קבע: אין לזה סכום קבוע ואין תנועה שנוצרת לבד. זו רק תזכורת —
   "בסביבות היום הזה מגיעה הכנסה בקטגוריה הזו" — עם קיצור דרך לרישום התנועה
   בפועל כל חודש (openEntry רגיל, מוזן מראש), ובנוסף התראה אם עבר היום ועדיין
   לא נרשם החודש כלום באותה קטגוריה. */
function openVariableIncome(editId){
  const v=editId?DB.variableIncomes.find(x=>x.id===editId):null;
  const cats=DB.categories.filter(c=>c.kind==='income');
  const selCat=v?v.categoryId:(cats[0]?cats[0].id:null);
  sheet(v?'עריכת הכנסה משתנה':'הכנסה משתנה חדשה',
   '<div class="note" style="margin-bottom:16px">למשכורת שמשתנה כל חודש (למשל לפי שעות) — לא נוצרת תנועה אוטומטית. המערכת רק תזכיר לך להזין את הסכום בפועל כל חודש.</div>'+
   '<div class="fld"><label>שם</label><input id="viName" type="text" placeholder="משכורת" value="'+(v?esc(v.name):'')+'"/></div>'+
   '<div class="fld"><label>קטגוריה</label><select id="viCat">'+cats.map(c=>'<option value="'+c.id+'" '+(selCat===c.id?'selected':'')+'>'+c.icon+' '+esc(c.name)+'</option>').join('')+'</select></div>'+
   '<div class="fld"><label>סוג הכנסה</label><select id="viIncType">'+
     [['salary','משכורת'],['reserve','מענק מילואים'],['other','אחר']].map(function(p){return '<option value="'+p[0]+'" '+((v?v.incomeType===p[0]:p[0]==='salary')?'selected':'')+'>'+p[1]+'</option>';}).join('')+'</select></div>'+
   '<div class="fld"><label>בסביבות איזה יום בחודש היא מגיעה</label><input id="viDay" type="number" min="1" max="31" value="'+(v?v.dayOfMonth:10)+'"/><div class="hint">אם עד היום הזה לא הזנת את הסכום בפועל, נזכיר לך בהתראות</div></div>'+
   '<button class="btn" onclick="saveVariableIncome('+(v?"'"+v.id+"'":'null')+')">שמור</button>'+
   (v?'<button class="btn sec" style="margin-top:10px" onclick="toggleVariableIncome(\''+v.id+'\')">'+(v.active?'השהה תזכורת':'הפעל מחדש')+'</button>':'')+
   (v?'<button class="btn dgr" style="margin-top:10px" onclick="delVariableIncome(\''+v.id+'\')">מחק</button>':''));
}
function saveVariableIncome(editId){
  const n=el('viName').value.trim();
  if(!n)return toast('הזן שם');
  const d=+el('viDay').value||10,catId=el('viCat').value,incomeType=el('viIncType').value;
  const existing=editId?DB.variableIncomes.find(x=>x.id===editId):null;
  if(existing){
    existing.name=n;existing.categoryId=catId;existing.incomeType=incomeType;existing.dayOfMonth=d;
    save();closeSheet();render();toast('עודכן');
    return;
  }
  DB.variableIncomes.push({id:uid('vi'),name:n,categoryId:catId,incomeType:incomeType,dayOfMonth:d,active:true});
  save();closeSheet();render();toast('נוספה הכנסה משתנה');
}
function toggleVariableIncome(id){
  const v=DB.variableIncomes.find(x=>x.id===id);if(!v)return;
  v.active=!v.active;save();closeSheet();render();toast(v.active?'התזכורת הופעלה מחדש':'התזכורת הושהתה');
}
function delVariableIncome(id){
  if(!confirm('למחוק את התזכורת? זה לא מוחק תנועות שכבר נרשמו.'))return;
  DB.variableIncomes=DB.variableIncomes.filter(x=>x.id!==id);
  save();closeSheet();render();toast('נמחק');
}
// קיצור דרך: פותח את "רישום תנועה" הרגיל, ומזין מראש כיוון+קטגוריה+סוג הכנסה
// לפי ההגדרה — נשאר רק להזין את הסכום בפועל של החודש הזה וללחוץ שמור.
function logVariableIncome(vId){
  const v=DB.variableIncomes.find(x=>x.id===vId);
  openEntry();
  if(!v)return;
  setDir('in');
  E.cat=v.categoryId;
  incType=v.incomeType||'salary';
  renderCats();
  document.querySelectorAll('[data-it]').forEach(x=>x.classList.toggle('on',x.dataset.it===incType));
  if(el('eNote')&&!el('eNote').value)el('eNote').value=v.name;
}

/* ---- יעד ---- */
function openGoal(type){
  sheet(type==='fund'?'קרן לעתיד':'יעד חיסכון חדש',
   '<div class="fld"><label>שם</label><input id="gName" type="text" placeholder="'+(type==='fund'?'קרן עתיד':'טיול לחו"ל')+'"/></div>'+
   '<div class="row2"><div class="fld"><label>'+(type==='fund'?'יעד (אופציונלי)':'סכום היעד')+'</label><input id="gTgt" type="number" inputmode="decimal" placeholder="0"/></div>'+
   '<div class="fld"><label>הפרשה חודשית</label><input id="gPlan" type="number" inputmode="decimal" placeholder="0"/></div></div>'+
   (type==='personal'?'<div class="fld"><label>תאריך יעד</label><input id="gDate" type="date"/></div>':'')+
   '<div class="fld"><label>כבר נצבר</label><input id="gSaved" type="number" inputmode="decimal" value="0"/></div>'+
   '<button class="btn" onclick="saveGoal(\''+type+'\')">שמור</button>');
}
function saveGoal(type){
  const n=el('gName').value.trim();if(!n)return toast('הזן שם');
  const colors=['#7c3aed','#0ead69','#2563eb','#f59e0b','#e5383b'];
  DB.goals.push({id:uid('goal'),name:n,type:type,
    targetAmount:parseFloat(el('gTgt').value)||0,
    targetDate:type==='personal'&&el('gDate').value?el('gDate').value:null,
    saved:parseFloat(el('gSaved').value)||0,
    monthlyPlan:parseFloat(el('gPlan').value)||0,
    createdDate:iso(today()),
    priority:DB.goals.length+1,color:colors[DB.goals.length%colors.length]});
  save();closeSheet();render();toast('היעד נוסף');
}
function openDeposit(id){
  const g=DB.goals.find(x=>x.id===id);
  sheet('הפקדה ל'+g.name,
   '<div class="fld"><input id="dAmt" class="amtin" type="number" inputmode="decimal" value="'+(g.monthlyPlan||'')+'" placeholder="0"/></div>'+
   '<div class="note" style="margin-bottom:16px">ההפקדה תירשם כתנועת חיסכון ותרד מהעו"ש. היא לא תיספר כהוצאה.</div>'+
   '<button class="btn" onclick="doDeposit(\''+id+'\')">הפקד</button>');
}
function doDeposit(id){
  const g=DB.goals.find(x=>x.id===id),v=parseFloat(el('dAmt').value);
  if(!v||v<=0)return toast('הזן סכום');
  const sc=DB.categories.find(c=>c.kind==='saving');
  DB.transactions.push({id:uid('tx'),direction:'out',amount:v,date:iso(today()),chargeDate:iso(today()),
    categoryId:sc.id,method:'account',cardId:null,note:'הפקדה: '+g.name,installment:null,recurringId:null,incomeType:null,goalId:g.id});
  g.saved+=v;save();closeSheet();render();toast('הופקד ✓');
}

/* ---- הלוואות ---- */
const TRACK_TYPES={prime:'פריים',fixed:'קבועה לא צמודה',fixed_linked:'קבועה צמודה מדד',variable_linked:'משתנה צמודה מדד'};
let tmpTracks=[];
function openLoanForm(editId){
  const loan=editId?DB.loans.find(l=>l.id===editId):null;
  tmpTracks=loan?JSON.parse(JSON.stringify(loan.tracks)):[{id:uid('trk'),name:'פריים',type:'prime',principal:0,margin:-0.5,fixedRate:0,termMonths:240}];
  sheet(loan?'עריכת הלוואה':'הלוואה חדשה',
   '<div class="fld"><label>שם ההלוואה</label><input id="lnName" type="text" placeholder="משכנתא" value="'+(loan?esc(loan.name):'')+'"/></div>'+
   '<div class="row2"><div class="fld"><label>תאריך תחילת ההלוואה</label><input id="lnStart" type="date" value="'+(loan?loan.startDate:iso(today()))+'"/></div>'+
   '<div class="fld"><label>יום חיוב בחודש</label><input id="lnPayDay" type="number" min="1" max="31" value="'+(loan?loan.payDay||10:10)+'"/></div></div>'+
   '<div class="stitle" style="margin-top:18px;font-size:13px">מסלולים</div>'+
   '<div id="trackRows"></div>'+
   '<button class="addrow" onclick="addTrackRow()">+ הוסף מסלול</button>'+
   (DB.settings.boiRate?'':'<div class="note" style="margin-top:14px">⚠️ ריבית בנק ישראל לא הוגדרה עדיין (הגדרות → הלוואות) — מסלולי פריים יחושבו לפי מרווח בלבד.</div>')+
   '<button class="btn" style="margin-top:16px" onclick="saveLoan('+(loan?"'"+loan.id+"'":'null')+')">שמור</button>'+
   (loan?'<button class="btn dgr" style="margin-top:10px" onclick="delLoan(\''+loan.id+'\')">מחק הלוואה</button>':''),
   paintTrackRows);
}
function paintTrackRows(){
  const w=el('trackRows');if(!w)return;
  w.innerHTML=tmpTracks.map((tr,i)=>
   '<div class="cardrow"><div class="crh"><span>מסלול '+(i+1)+'</span>'+(tmpTracks.length>1?'<button class="delx" onclick="rmTrackRow('+i+')">✕</button>':'')+'</div>'+
   '<div class="fld"><input placeholder="שם המסלול" value="'+esc(tr.name)+'" oninput="tmpTracks['+i+'].name=this.value"/></div>'+
   '<div class="row2"><div class="fld"><label>סוג ריבית</label><select onchange="tmpTracks['+i+'].type=this.value;paintTrackRows()">'+
     Object.keys(TRACK_TYPES).map(k=>'<option value="'+k+'" '+(tr.type===k?'selected':'')+'>'+TRACK_TYPES[k]+'</option>').join('')+'</select></div>'+
   '<div class="fld"><label>קרן</label><input type="number" value="'+tr.principal+'" oninput="tmpTracks['+i+'].principal=+this.value"/></div></div>'+
   '<div class="row2">'+
     (tr.type==='prime'
       ?'<div class="fld"><label>מרווח מריבית ב"י (%)</label><input type="number" step="0.01" value="'+tr.margin+'" oninput="tmpTracks['+i+'].margin=+this.value"/><div class="hint">שלילי = הנחה, חיובי = תוספת</div></div>'
       :'<div class="fld"><label>ריבית שנתית (%)</label><input type="number" step="0.01" value="'+(tr.fixedRate||0)+'" oninput="tmpTracks['+i+'].fixedRate=+this.value"/></div>')+
     '<div class="fld"><label>תקופה (חודשים)</label><input type="number" min="1" value="'+tr.termMonths+'" oninput="tmpTracks['+i+'].termMonths=+this.value"/></div>'+
   '</div></div>').join('');
}
function addTrackRow(){tmpTracks.push({id:uid('trk'),name:'',type:'fixed',principal:0,margin:0,fixedRate:0,termMonths:180});paintTrackRows();}
function rmTrackRow(i){tmpTracks.splice(i,1);paintTrackRows();}
function saveLoan(editId){
  const n=el('lnName').value.trim();
  if(!n)return toast('הזן שם להלוואה');
  const clean=tmpTracks.filter(t=>t.principal>0&&t.termMonths>0);
  if(!clean.length)return toast('הוסף לפחות מסלול אחד עם קרן ותקופה');
  const start=el('lnStart').value||iso(today()),payDay=+el('lnPayDay').value||10;
  if(editId){
    const loan=DB.loans.find(l=>l.id===editId);if(!loan)return;
    loan.name=n;loan.startDate=start;loan.tracks=clean;loan.payDay=payDay;
  }else{
    DB.loans.push({id:uid('loan'),name:n,startDate:start,payDay:payDay,tracks:clean});
  }
  save();closeSheet();render();toast('נשמר');
}
function delLoan(id){
  if(!confirm('למחוק את ההלוואה? הפעולה לא הפיכה — הנתונים לא נשמרים במקום אחר.'))return;
  DB.loans=DB.loans.filter(l=>l.id!==id);save();closeSheet();render();toast('נמחק');
}
function loanDetail(id){
  const loan=DB.loans.find(l=>l.id===id);if(!loan)return;
  const lc=LOANS.loanCalc(loan);
  let h='<div class="note" style="margin-bottom:16px">יתרה כוללת: <b>'+fmt(lc.totalBalance)+'</b> · החזר חודשי כולל: <b>'+fmt(lc.totalPayment)+'</b> · ריבית שתיוותר: <b>'+fmt(lc.totalInterest)+'</b></div>';
  lc.tracks.forEach(({tr,c})=>{
    h+='<div class="goal"><div class="ghead"><div><div class="gname">'+esc(tr.name||TRACK_TYPES[tr.type])+'</div>'+
      '<div class="gsub">'+TRACK_TYPES[tr.type]+' · ריבית נוכחית '+c.rate.toFixed(2)+'% · '+c.monthsLeft+' תשלומים נותרו</div></div>'+
      '<div style="text-align:left"><div class="gpct" style="font-size:16px">'+fmt(c.monthlyPayment)+'</div><div class="mini">לחודש</div></div></div>'+
      '<div class="gfoot"><span>יתרה '+fmt(c.balance)+'</span><span>ריבית שתיוותר '+fmt(c.totalInterestRemaining)+'</span></div></div>';
  });
  h+='<div class="btnrow" style="margin-top:6px"><button class="btn sec" onclick="openLoanForm(\''+loan.id+'\')">ערוך</button>'+
     '<button class="btn dgr" onclick="delLoan(\''+loan.id+'\')">מחק</button></div>';
  if(lc.tracks.some(x=>x.tr.type==='fixed_linked'||x.tr.type==='variable_linked'))
    h+='<div class="note" style="margin-top:14px">⚠️ מסלולים צמודי מדד מוצגים לפי הקרן המקורית בלי הצמדה בפועל למדד (אין למערכת גישה למדד) — זה קירוב, לא סכום מדויק.</div>';
  sheet(loan.name,h);
}

/* ---- הגדרות ---- */
// מסך-בית: קישורים לפי נושא, כל אחד פותח sheet() ממוקד משלו — אותה תבנית
// שכבר קיימת ב-openLoanForm/openGoal/openRecurring. במקום גיליון שטוח אחד
// עם שמירה מונוליטית, כל נושא הוא יחידה עצמאית עם השמירה שלו.
function openSettings(){
  sheet('הגדרות',
   '<div class="eitem tap" onclick="openAccountSettings()"><div class="eico">👤</div><div class="einfo"><div class="ename">חשבון</div>'+
     '<div class="etag">מחובר כ-'+esc(CURRENT_USER?CURRENT_USER.email:'')+'</div></div></div>'+
   '<div class="eitem tap" onclick="openFinancialSettings()"><div class="eico">🎯</div><div class="einfo"><div class="ename">מדיניות פיננסית</div>'+
     '<div class="etag">כרית ביטחון · מסגרת · יעד הוצאות</div></div></div>'+
   '<div class="eitem tap" onclick="openLoanSettings()"><div class="eico">🏦</div><div class="einfo"><div class="ename">הלוואות וריבית</div>'+
     '<div class="etag">ריבית בנק ישראל · כלול ביתרה הזמינה</div></div></div>'+
   '<div class="eitem tap" onclick="openCats()"><div class="eico">🏷️</div><div class="einfo"><div class="ename">קטגוריות ותקציבים</div>'+
     '<div class="etag">'+DB.categories.length+' קטגוריות מוגדרות</div></div></div>'+
   '<div class="eitem tap" onclick="openCardSettings()"><div class="eico">💳</div><div class="einfo"><div class="ename">כרטיסי אשראי</div>'+
     '<div class="etag">'+(DB.cards.length?DB.cards.length+' כרטיסים':'לא הוגדרו כרטיסים')+'</div></div></div>'+
   '<div class="eitem tap" onclick="openBackupSettings()"><div class="eico">💾</div><div class="einfo"><div class="ename">גיבוי ואזור מסוכן</div>'+
     '<div class="etag">ייצוא/ייבוא · איפוס הכל</div></div></div>');
}
function openAccountSettings(){
  sheet('חשבון',
   '<div class="note" style="margin-bottom:18px">מחובר כ-'+esc(CURRENT_USER?CURRENT_USER.email:'')+' · הנתונים מסונכרנים לענן ונגישים מכל מכשיר.</div>'+
   '<button class="btn sec" onclick="doSignOut()">התנתק</button>',null,'openSettings');
}
function openFinancialSettings(){
  const S=DB.settings;
  sheet('מדיניות פיננסית',
   '<div class="fld"><label>כרית ביטחון — סכום שלא לרדת מתחתיו</label><input id="stBuf" type="number" value="'+S.safetyBuffer+'"/></div>'+
   '<div class="fld"><label>מסגרת אשראי בעו"ש</label><input id="stOd" type="number" value="'+S.overdraftLimit+'"/></div>'+
   '<div class="fld"><label>יעד הוצאות חודשי (0 = בלי יעד)</label><input id="stTarget" type="number" value="'+(S.monthlyExpenseTarget||0)+'"/><div class="hint">סכום ההוצאות הכולל שאתה שואף לא לחרוג ממנו — קבועות, משתנות, הלוואות וחיסכון ביחד</div></div>'+
   '<button class="btn" onclick="saveFinancialSettings()">שמור</button>',null,'openSettings');
}
function saveFinancialSettings(){
  DB.settings.safetyBuffer=+el('stBuf').value||0;
  DB.settings.overdraftLimit=+el('stOd').value||0;
  DB.settings.monthlyExpenseTarget=+el('stTarget').value||0;
  save();closeSheet();render();toast('נשמר');
}
function openLoanSettings(){
  const S=DB.settings;
  sheet('הלוואות וריבית',
   '<div class="fld"><label>ריבית בנק ישראל הנוכחית (%)</label><input id="stBoi" type="number" step="0.01" value="'+(S.boiRate||0)+'"/><div class="hint">משמשת לחישוב כל מסלולי הפריים בהלוואות. עדכן ידנית כשבנק ישראל משנה את הריבית — למערכת אין גישה לאינטרנט.'+(S.boiRateUpdated?' עודכן לאחרונה: '+dLabel(S.boiRateUpdated)+'.':'')+'</div></div>'+
   '<div class="fld"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input id="stLoanBal" type="checkbox" style="width:auto" '+(S.loansAffectBalance?'checked':'')+'/> כלול תשלומי הלוואות ביתרה הזמינה ובתחזית</label><div class="hint">כשמסומן, תשלום ההלוואה (לפי "יום חיוב" שהגדרת לה) יורד מ"יתרה זמינה" ומהתחזית — בדיוק כמו חיוב אשראי. בטל אם אתה כבר עוקב אחרי אותו חיוב בנפרד כהוראת קבע, כדי לא לספור פעמיים.</div></div>'+
   '<button class="btn" onclick="saveLoanSettings()">שמור</button>',null,'openSettings');
}
function saveLoanSettings(){
  const newBoi=+el('stBoi').value||0;
  if(newBoi!==DB.settings.boiRate)DB.settings.boiRateUpdated=iso(today());
  DB.settings.boiRate=newBoi;
  DB.settings.loansAffectBalance=el('stLoanBal').checked;
  save();closeSheet();render();toast('נשמר');
}
function openCardSettings(){
  sheet('כרטיסי אשראי',
   '<div id="stCards"></div>'+
   '<button class="addrow" onclick="addCardRow()">+ הוסף כרטיס</button>'+
   '<button class="btn" onclick="saveCards()">שמור</button>',
   drawCardRows,'openSettings');
}
function saveCards(){
  DB.cards=tmpCards.filter(c=>c.name.trim());
  DB.transactions.forEach(x=>{if(x.cardId&&!CALC.card(x.cardId))x.cardId=null;});
  save();closeSheet();render();toast('נשמר');
}
function openBackupSettings(){
  sheet('גיבוי ואזור מסוכן',
   '<div class="note" style="margin-bottom:12px">הנתונים מסונכרנים לענן אוטומטית, אבל עדיין כדאי לייצא גיבוי מקומי מדי פעם — רשת שלא זמינה זמנית לא תמחק כלום (יש מטמון מקומי), אבל גיבוי מקובץ הוא רשת ביטחון נוספת.</div>'+
   '<div class="btnrow" style="margin-bottom:22px"><button class="btn sec" onclick="exportDB()">ייצא קובץ</button>'+
   '<button class="btn sec" onclick="el(\'impF\').click()">ייבא קובץ</button></div>'+
   '<input type="file" id="impF" accept=".json" style="display:none" onchange="importDB(this)"/>'+
   '<div class="dangerzone"><div class="dztitle">⚠️ אזור מסוכן</div>'+
   '<div class="note" style="margin-bottom:12px">איפוס ימחק את כל הנתונים — תנועות, קטגוריות, הלוואות, יעדים וכל ההגדרות — לצמיתות. אין דרך לשחזר.</div>'+
   '<button class="btn dgr" onclick="resetAll()">אפס הכל</button></div>',null,'openSettings');
}
function drawCardRows(){
  tmpCards=JSON.parse(JSON.stringify(DB.cards));
  paintCardRows();
}
let tmpCards=[];
function paintCardRows(){
  const c=el('stCards');if(!c)return;
  c.innerHTML=tmpCards.map((x,i)=>
   '<div class="cardrow"><div class="crh"><span>כרטיס '+(i+1)+'</span><button class="delx" onclick="rmCard('+i+')">✕</button></div>'+
   '<div class="fld"><input placeholder="שם הכרטיס" value="'+esc(x.name)+'" oninput="tmpCards['+i+'].name=this.value"/></div>'+
   '<div class="row2"><div class="fld"><select onchange="tmpCards['+i+'].brand=this.value">'+
     ['visa','mastercard','amex','isracard','diners'].map(b=>'<option value="'+b+'" '+(x.brand===b?'selected':'')+'>'+brandName(b)+'</option>').join('')+'</select></div>'+
   '<div class="fld"><input placeholder="4 ספרות" maxlength="4" value="'+esc(x.last4)+'" oninput="tmpCards['+i+'].last4=this.value"/></div></div>'+
   '<div class="row2"><div class="fld"><label>יום חיוב</label><input type="number" min="1" max="31" value="'+x.chargeDay+'" oninput="tmpCards['+i+'].chargeDay=+this.value"/><div class="hint">היום בחודש שהחיוב יורד בפועל מהעו"ש</div></div>'+
   '<div class="fld"><label>יום חיתוך</label><input type="number" min="1" max="31" value="'+x.cutoffDay+'" oninput="tmpCards['+i+'].cutoffDay=+this.value"/><div class="hint">עסקאות עד היום הזה נכנסות לחיוב הקרוב</div></div></div>'+
   '<div class="fld"><label>מסגרת</label><input type="number" value="'+x.limit+'" oninput="tmpCards['+i+'].limit=+this.value"/></div></div>').join('');
}
function addCardRow(){const cl=['#6366f1','#f59e0b','#10b981','#06b6d4'];
  tmpCards.push({id:uid('card'),name:'',brand:'visa',last4:'',color:cl[tmpCards.length%4],chargeDay:10,cutoffDay:25,limit:0,active:true});paintCardRows();}
function rmCard(i){tmpCards.splice(i,1);paintCardRows();}
function saveSettings(){
  DB.settings.safetyBuffer=+el('stBuf').value||0;
  DB.settings.overdraftLimit=+el('stOd').value||0;
  DB.settings.monthlyExpenseTarget=+el('stTarget').value||0;
  const newBoi=+el('stBoi').value||0;
  if(newBoi!==DB.settings.boiRate)DB.settings.boiRateUpdated=iso(today());
  DB.settings.boiRate=newBoi;
  DB.settings.loansAffectBalance=el('stLoanBal').checked;
  DB.cards=tmpCards.filter(c=>c.name.trim());
  DB.transactions.forEach(x=>{if(x.cardId&&!CALC.card(x.cardId))x.cardId=null;});
  save();closeSheet();render();toast('נשמר');
}
function exportDB(){
  DB.meta.lastBackup=iso(today());save();
  const b=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='financeme-'+iso(today())+'.json';a.click();toast('הגיבוי הורד');
}
function importDB(inp){
  const f=inp.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=e=>{try{const d=JSON.parse(e.target.result);if(!d.version)throw 0;
    DB=Object.assign(blank(),d);save();closeSheet();render();toast('הנתונים יובאו');}catch(err){toast('קובץ לא תקין');}};
  r.readAsText(f);
}
function resetAll(){
  if(!confirm('פעולה זו תמחק את כל הנתונים לצמיתות. ודא שייצאת גיבוי.'))return;
  if(!confirm('בטוח? אין דרך חזרה.'))return;
  localStorage.removeItem(KEY);location.reload();
}

/* ============================================================
   8. SETUP — אשף התקנה ראשונית
   ============================================================ */
// שלבים 3-5 (הוצאות קבועות/הלוואה/יעד) הם תוספת מודעת ביחס לאשף המקורי בן 3
// השאלות: בלעדיהם, יום ראשון באפליקציה תמיד התחיל מ"0 הוצאות קבועות" והתחזית
// בדף הבית הייתה שקרית עד שממלאים הכל ידנית בהדרגה. כל שלב חדש כן ניתן לדילוג
// בלחיצה אחת — המטרה היא תחזית קרובה לאמת ביום הראשון, לא טופס ארוך יותר.
let sStep=0,sData={balance:0,buffer:1000,overdraft:0,cards:[],salary:0,salaryDay:10,
  fixedExpenses:[],
  wantLoan:false,loan:{name:'',principal:0,type:'prime',margin:-0.5,fixedRate:0,termMonths:240,payDay:10},
  wantGoal:false,goal:{name:'',target:0,monthlyPlan:0,saved:0}};
function drawSetup(){
  const s=el('setup');
  let h='<div class="slogo"><div class="si">💰</div><h1>FinanceMe</h1><p>כמה שאלות קצרות ומתחילים.<br/>כל שלב אחרי הראשון אפשר לדלג עליו. הכל נשמר במכשיר שלך בלבד.</p></div>';
  h+='<div class="steps">'+[0,1,2,3,4,5].map(i=>'<i class="'+(i<=sStep?'on':'')+'"></i>').join('')+'</div>';
  if(sStep===0){
    h+='<div class="box"><div class="stitle"><span>🏦</span> החשבון שלך</div>'+
      '<div class="fld"><label>יתרה נוכחית בעו"ש</label><input id="i1" type="number" inputmode="decimal" value="'+sData.balance+'"/><div class="hint">הסכום שמופיע עכשיו באפליקציית הבנק</div></div>'+
      '<div class="fld"><label>כרית ביטחון</label><input id="i2" type="number" value="'+sData.buffer+'"/><div class="hint">סכום שאתה לא רוצה לרדת מתחתיו — נשתמש בו להתראות</div></div>'+
      '<div class="fld"><label>מסגרת אשראי (0 אם אין)</label><input id="i3" type="number" value="'+sData.overdraft+'"/></div>'+
      '<button class="btn" onclick="sNext()">המשך</button></div>';
  }else if(sStep===1){
    h+='<div class="box"><div class="stitle"><span>💳</span> כרטיסי האשראי</div>'+
      '<div class="note" style="margin-bottom:16px">יום החיוב הוא הדבר החשוב ביותר במערכת. הוא קובע מתי כל קנייה תרד מהעו"ש בפועל.</div>'+
      '<div id="stCards"></div><button class="addrow" onclick="addCardRow()">+ הוסף כרטיס</button>'+
      '<div class="btnrow"><button class="btn sec" onclick="sBack()">חזור</button><button class="btn" onclick="sNext()">המשך</button></div></div>';
  }else if(sStep===2){
    h+='<div class="box"><div class="stitle"><span>💼</span> ההכנסה הקבועה</div>'+
      '<div class="fld"><label>משכורת חודשית נטו</label><input id="i1" type="number" inputmode="decimal" value="'+(sData.salary||'')+'" placeholder="0"/></div>'+
      '<div class="fld"><label>יום כניסת המשכורת</label><input id="i2" type="number" min="1" max="31" value="'+sData.salaryDay+'"/></div>'+
      '<div class="note" style="margin-bottom:16px">משכורת שמשתנה כל חודש (למשל לפי שעות), מענק מילואים והכנסות חד-פעמיות — כל אלה אפשר להוסיף בנפרד אחר כך, בטאב "הכנסות".</div>'+
      '<div class="btnrow"><button class="btn sec" onclick="sBack()">חזור</button><button class="btn" onclick="sNext()">המשך</button></div></div>';
  }else if(sStep===3){
    if(!sData.fixedExpenses.length)sData.fixedExpenses=DB.categories.filter(c=>c.kind==='fixed').map(c=>({catId:c.id,name:c.name,icon:c.icon,checked:false,amount:0,day:5}));
    h+='<div class="box"><div class="stitle"><span>🏠</span> הוצאות קבועות</div>'+
      '<div class="note" style="margin-bottom:16px">סמן מה רלוונטי אצלך והזן סכום — ככה התחזית תהיה מדויקת כבר מהיום הראשון, במקום להתחיל מ-0. אפשר לדלג ולהוסיף אחר כך.</div>'+
      '<div id="sFixedList">'+sFixedListHTML()+'</div>'+
      '<div class="btnrow"><button class="btn sec" onclick="sBack()">חזור</button><button class="btn" onclick="sNext()">המשך</button></div></div>';
  }else if(sStep===4){
    h+='<div class="box"><div class="stitle"><span>🏦</span> הלוואה קיימת</div>';
    if(!sData.wantLoan){
      h+='<div class="note" style="margin-bottom:16px">יש לך משכנתא, הלוואת רכב או הלוואה אחרת שרצה כרגע?</div>'+
        '<div class="btnrow"><button class="btn sec" onclick="sSkipLoan()">אין לי, דלג</button><button class="btn" onclick="sData.wantLoan=true;drawSetup()">יש לי הלוואה</button></div>';
    }else{
      const L=sData.loan;
      h+='<div class="fld"><label>שם ההלוואה</label><input id="i1" type="text" placeholder="משכנתא" value="'+esc(L.name)+'"/></div>'+
        '<div class="row2"><div class="fld"><label>יתרת קרן נוכחית</label><input id="i2" type="number" inputmode="decimal" value="'+(L.principal||'')+'"/></div>'+
        '<div class="fld"><label>יום חיוב בחודש</label><input id="i3" type="number" min="1" max="31" value="'+L.payDay+'"/></div></div>'+
        '<div class="fld"><label>סוג ריבית</label><div class="seg"><button id="sLoanPrime" class="'+(L.type==='prime'?'on':'')+'" onclick="sSetLoanType(\'prime\')">פריים</button><button id="sLoanFixed" class="'+(L.type==='fixed'?'on':'')+'" onclick="sSetLoanType(\'fixed\')">קבועה</button></div></div>'+
        (L.type==='prime'
          ?'<div class="fld"><label>מרווח מריבית ב"י (%)</label><input id="i4" type="number" step="0.01" value="'+L.margin+'"/><div class="hint">שלילי = הנחה, חיובי = תוספת</div></div>'
          :'<div class="fld"><label>ריבית שנתית (%)</label><input id="i4" type="number" step="0.01" value="'+(L.fixedRate||0)+'"/></div>')+
        '<div class="fld"><label>תקופה שנותרה (חודשים)</label><input id="i5" type="number" min="1" value="'+L.termMonths+'"/></div>'+
        '<div class="btnrow"><button class="btn sec" onclick="sCancelLoanForm()">בטל</button><button class="btn" onclick="sNext()">המשך</button></div>';
    }
    h+='</div>';
  }else{
    h+='<div class="box"><div class="stitle"><span>🎯</span> יעד חיסכון ראשון</div>';
    if(!sData.wantGoal){
      h+='<div class="note" style="margin-bottom:16px">יש משהו שאתה חוסך אליו? (טיול, רכב, קרן חירום...)</div>'+
        '<div class="btnrow"><button class="btn sec" onclick="sSkipGoal()">אין לי כרגע, דלג</button><button class="btn" onclick="sData.wantGoal=true;drawSetup()">יש לי יעד</button></div>';
    }else{
      const G=sData.goal;
      h+='<div class="fld"><label>שם היעד</label><input id="i1" type="text" placeholder="טיול לחו״ל" value="'+esc(G.name)+'"/></div>'+
        '<div class="row2"><div class="fld"><label>סכום היעד</label><input id="i2" type="number" inputmode="decimal" value="'+(G.target||'')+'"/></div>'+
        '<div class="fld"><label>הפרשה חודשית</label><input id="i3" type="number" inputmode="decimal" value="'+(G.monthlyPlan||'')+'"/></div></div>'+
        '<div class="fld"><label>כבר נצבר (0 אם מתחילים מאפס)</label><input id="i4" type="number" inputmode="decimal" value="'+(G.saved||'')+'"/></div>'+
        '<div class="btnrow"><button class="btn sec" onclick="sCancelGoalForm()">בטל</button><button class="btn" onclick="finishSetup()">סיים והתחל</button></div>';
    }
    h+='</div>';
  }
  s.innerHTML=h;
  if(sStep===1)paintCardRows();
}
function sFixedListHTML(){
  return sData.fixedExpenses.map((f,i)=>
    '<div class="cardrow" style="padding:12px 14px"><label style="display:flex;align-items:center;gap:10px;cursor:pointer">'+
      '<input type="checkbox" style="width:auto" '+(f.checked?'checked':'')+' onchange="sToggleFixed('+i+',this.checked)"/>'+
      '<span style="font-size:17px">'+f.icon+'</span><span style="font-weight:700;font-size:13.5px;flex:1">'+esc(f.name)+'</span></label>'+
      (f.checked?'<div class="row2" style="margin-top:10px"><div class="fld"><label>סכום חודשי</label><input type="number" inputmode="decimal" placeholder="0" value="'+(f.amount||'')+'" oninput="sData.fixedExpenses['+i+'].amount=+this.value"/></div>'+
        '<div class="fld"><label>יום חיוב</label><input type="number" min="1" max="31" value="'+f.day+'" oninput="sData.fixedExpenses['+i+'].day=+this.value"/></div></div>':'')+
    '</div>').join('');
}
function sToggleFixed(i,checked){sData.fixedExpenses[i].checked=checked;el('sFixedList').innerHTML=sFixedListHTML();}
function sReadLoanFields(){
  if(!sData.wantLoan||!el('i1'))return;
  const L=sData.loan;
  L.name=el('i1').value.trim();L.principal=+el('i2').value||0;L.payDay=+el('i3').value||10;
  if(L.type==='prime')L.margin=+el('i4').value||0;else L.fixedRate=+el('i4').value||0;
  L.termMonths=+el('i5').value||240;
}
function sSetLoanType(type){sReadLoanFields();sData.loan.type=type;drawSetup();}
function sSkipLoan(){sData.wantLoan=false;sStep++;drawSetup();}
function sCancelLoanForm(){sData.wantLoan=false;drawSetup();}
function sCancelGoalForm(){sData.wantGoal=false;drawSetup();}
function sSkipGoal(){sData.wantGoal=false;finishSetup();}
function sNext(){
  if(sStep===0){sData.balance=+el('i1').value||0;sData.buffer=+el('i2').value||0;sData.overdraft=+el('i3').value||0;
    if(!tmpCards.length)tmpCards=[];}
  if(sStep===1){sData.cards=tmpCards.filter(c=>c.name.trim());}
  if(sStep===2){sData.salary=+el('i1').value||0;sData.salaryDay=+el('i2').value||10;}
  if(sStep===4)sReadLoanFields();
  sStep++;drawSetup();
}
function sBack(){
  if(sStep===1)sData.cards=tmpCards.filter(c=>c.name.trim());
  if(sStep===2){sData.salary=+el('i1').value||0;sData.salaryDay=+el('i2').value||10;}
  if(sStep===4)sReadLoanFields();
  sStep--;drawSetup();
}
function finishSetup(){
  if(sStep===5&&sData.wantGoal&&el('i1')){
    const G=sData.goal;
    G.name=el('i1').value.trim();G.target=+el('i2').value||0;G.monthlyPlan=+el('i3').value||0;G.saved=+el('i4').value||0;
  }
  DB=blank();
  DB.account.openingBalance=sData.balance;DB.account.openingDate=iso(today());DB.account.lastUpdated=iso(today());
  DB.settings.safetyBuffer=sData.buffer;DB.settings.overdraftLimit=sData.overdraft;
  DB.cards=sData.cards;
  if(sData.salary>0){
    // startDate = תחילת החודש הנוכחי, לא "היום" — כדי שהמשכורת של החודש הזה תיווצר
    // גם אם יום הכניסה שלה כבר עבר (למשל מתקינים באפליקציה ב-15 לחודש, משכורת ב-10)
    DB.recurring.push({id:uid('rec'),name:'משכורת',amount:sData.salary,categoryId:'c_salary',
      method:'account',cardId:null,dayOfMonth:sData.salaryDay,startDate:curYM()+'-01',endDate:null,
      active:true,direction:'in',incomeType:'salary'});
  }
  sData.fixedExpenses.filter(f=>f.checked&&f.amount>0).forEach(f=>{
    DB.recurring.push({id:uid('rec'),name:f.name,amount:f.amount,categoryId:f.catId,
      method:'account',cardId:null,dayOfMonth:f.day||5,startDate:curYM()+'-01',endDate:null,
      active:true,direction:'out',installmentTotal:null,goalId:null});
  });
  if(sData.wantLoan&&sData.loan.name.trim()&&sData.loan.principal>0&&sData.loan.termMonths>0){
    const L=sData.loan;
    DB.loans.push({id:uid('loan'),name:L.name.trim(),startDate:iso(today()),payDay:L.payDay||10,
      tracks:[{id:uid('trk'),name:L.type==='prime'?'פריים':'קבועה',type:L.type,
        principal:L.principal,margin:L.type==='prime'?L.margin:0,fixedRate:L.type==='fixed'?L.fixedRate:0,
        termMonths:L.termMonths}]});
  }
  if(sData.wantGoal&&sData.goal.name.trim()){
    const G=sData.goal;
    DB.goals.push({id:uid('goal'),name:G.name.trim(),type:'personal',
      targetAmount:G.target||0,targetDate:null,saved:G.saved||0,monthlyPlan:G.monthlyPlan||0,
      createdDate:iso(today()),priority:1,color:'#7c3aed'});
  }
  DB.meta.lastGen=curYM();DB.meta.setupDone=true;
  save();boot();
}

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
