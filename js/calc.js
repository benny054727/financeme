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
     משתנות + הלוואה + הפקדה לחיסכון), בתוספת ההכנסה החודשית המינימלית הצפויה
     שהוגדרה בהגדרות (settings.monthlyExpenseTarget, בשימוש כפול — גם כתקרת
     הוצאות וגם כאן כ"רצפת הכנסה") אם הוגדרה — נוסחה יחידה, אותה בדיוק בכל מסך
     שמציג "תחזית" (דף הבית, דף עו"ש, וההתראות הקריטיות), כדי שלא יסתרו אחד את
     השני. ה"הכנסה הצפויה" נכללת כאן בכוונה: משתמש שדיווח על משכורת קבועה
     שעוד לא ירדה החודש אבל בטוח שתרד לא רצה לראות תחזית שמתעלמת ממנה. */
  monthEnd(){
    const av=CALC.available(),m=CALC.month(curYM()),loanPay=LOANS.allMonthlyTotal();
    const minIncome=DB.settings.monthlyExpenseTarget||0;
    return av.balance-(m.out+loanPay+m.saving)+minIncome;
  },

  /* 4.5 — סיכום חודשי (לפי חודש ההוצאה) */
  month(y){
    const r={income:0,incomeBase:0,incomeExtra:0,out:0,fixed:0,variable:0,saving:0,savingGoal:0,savingFund:0,byCat:{},byCard:{}};
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
      if(c.kind==='saving'){
        r.saving+=x.amount;
        // byCat גם לחיסכון — כדי שטאב "חיסכון" בדף ההוצאות יוכל להציג פירוט לפי
        // קטגוריה (עוגה), באותו קוד גנרי בדיוק כמו קבועות/משתנות/הכנסות
        r.byCat[x.categoryId]=(r.byCat[x.categoryId]||0)+x.amount;
        // savingGoal/savingFund — פיצול לפי סוג היעד המקושר (goalId), כדי שגרף
        // המגמה בדף הבית יוכל להציג "חיסכון" (יעדים אישיים) ו"קרן לעתיד" בנפרד
        // במקום מספר אחד מאוחד. תנועה בלי goalId (או שהיעד שלה כבר נמחק) נספרת
        // כ"חיסכון" רגיל — ברירת המחדל, כי "קרן לעתיד" היא המקרה החריג.
        const g=x.goalId?DB.goals.find(gg=>gg.id===x.goalId):null;
        if(g&&g.type==='fund')r.savingFund+=x.amount;else r.savingGoal+=x.amount;
      }
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

