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
  if(pw.length<8)return toast('סיסמה חייבת להיות לפחות 8 תווים');
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
// scope:'global' (במקום ברירת המחדל 'local') מבטל את כל הסשנים הפעילים של
// החשבון בכל המכשירים, לא רק את זה — שימושי אם יש חשד שמישהו אחר מחובר
async function doSignOutAll(){
  if(!confirm('להתנתק מכל המכשירים שמחוברים לחשבון הזה? כל מי שמחובר יצטרך להתחבר מחדש עם הסיסמה. הנתונים עצמם לא נמחקים.'))return;
  try{await sb.auth.signOut({scope:'global'});}catch(e){}
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
 {id:'c_loan',name:'החזר הלוואה',icon:'🏦',kind:'loan',budget:0},
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
  DB.loans.forEach(loan=>{
    if(!loan.payDay)loan.payDay=10;
    // הלוואות מלפני התכונה "תשלום הלוואה = תנועה אמיתית": ברירת מחדל "ישירות
    // מהעו"ש" (ההתנהגות ששררה בפועל קודם — היה חלק מהתחזית בלי תנועה בטבלה)
    if(!loan.paymentMethod)loan.paymentMethod='account';
    if(loan.cardId===undefined)loan.cardId=null;
  });
  if(DB.meta.lastGenLoan===undefined)DB.meta.lastGenLoan=null;
  // משתמשים ותיקים: קטגוריית "החזר הלוואה" נוספה ל-DEFAULT_CATS אחרי שהם כבר
  // שמרו DB משלהם, אז מוסיפים אותה כאן פעם אחת אם היא חסרה (בלי לגעת בשאר
  // הקטגוריות הקיימות, בניגוד לתיקון החלופי כשהמערך כולו ריק)
  if(!DB.categories.some(c=>c.id==='c_loan'))DB.categories.push({id:'c_loan',name:'החזר הלוואה',icon:'🏦',kind:'loan',budget:0});
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
  // תיקון רטרואקטיבי: לפני התיקון ל-delGoal(), מחיקת יעד/קרן לא ניקתה הפקדות שכבר
  // נרשמו החודש הנוכחי עבור אותו יעד — הן נשארו תנועה יתומה שממשיכה להיספר כחיסכון
  // (עוגה/תנועות/דף הבית) למרות שהיעד כבר לא קיים. מנקים כאן פעם אחת, באותו עיקרון
  // בדיוק כמו delGoal(): רק תנועות החודש הנוכחי, היסטוריה מחודשים קודמים נשארת.
  const curM=curYM();
  DB.transactions=DB.transactions.filter(t=>!(t.goalId&&ym(t.date)===curM&&!DB.goals.some(g=>g.id===t.goalId)));
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

