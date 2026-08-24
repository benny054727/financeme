/* ============================================================
   4. RECURRING — ייצור תנועות מהוראות קבע
   ============================================================ */
function genRecurring(){
  const y=curYM();
  let start=DB.meta.lastGen||addM(y,-1);
  const months=[];let m=start;
  for(let i=0;i<14&&m<=y;i++){months.push(m);m=addM(m,1);}
  // סכום שצריך "לקפל" לתוך עוגן יתרת הבנק (openingBalance) — ראו הסבר מתחת ללולאה
  let anchorFold=0;
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
      const chargeDate=r.direction==='in'?d:CALC.chargeDate(d,card);
      DB.transactions.push({
        id:id,direction:r.direction||'out',amount:r.amount,date:d,
        chargeDate:chargeDate,
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
      // תנועה חדשה שנוצרת כרגע לראשונה, עם תאריך חיוב שכבר "מכוסה" ע"י עוגן יתרת
      // הבנק (chargeDate <= openingDate) — CALC.balance() הייתה מתעלמת ממנה בשקט
      // עד שהמשתמש היה מעדכן ידנית "עדכן יתרה מהבנק". קורה בעיקר כשמוסיפים הוראת
      // קבע חדשה עם יום-בחודש שכבר עבר החודש הזה (למשל היום ה-23, יום חיוב 10).
      // כדי שהיתרה תשקף את זה מיד בלי הזנה ידנית — מקפלים את הסכום ישירות לתוך
      // openingBalance כאן, ומודיעים בטוסט (ראו סוף הפונקציה) כדי שזה לא "יקרה
      // בשקט": אם הכסף בפועל עדיין לא ירד בבנק האמיתי, המשתמש יודע לתקן ידנית.
      if(r.method!=='cash'&&chargeDate<=(DB.account.openingDate||'0000-00-00')){
        anchorFold+=(r.direction==='in'?r.amount:-r.amount);
      }
    });
  });
  DB.meta.lastGen=y;
  if(anchorFold){
    DB.account.openingBalance=(DB.account.openingBalance||0)+anchorFold;
    save();
    toast('יתרת הבנק עודכנה אוטומטית ('+(anchorFold>0?'+':'')+fmtS(anchorFold)+') בעקבות הוראת קבע — אם זה עדיין לא ירד בבנק בפועל, תקן ב"עדכן יתרה מהבנק"');
  }else{
    save();
  }
}

/* ============================================================
   4ב. LOAN PAYMENTS — ייצור תנועות אמיתיות מתשלומי הלוואה, אותו מנגנון
   בדיוק כמו genRecurring() (אותה נוסחת חודשים, אותו רעיון "מזהה קבוע =
   אין כפילות", אותו anchorFold). ההבדל: המקור הוא DB.loans, לא DB.recurring,
   והסכום נלקח מ-LOANS.loanCalc() בזמן הריצה (לא ערך קבוע שהמשתמש הזין) —
   כך שאם ריבית בנק ישראל מתעדכנת, החודש הבא ייווצר עם ההחזר הנכון החדש
   (חודשים שכבר נוצרו לא משתנים רטרואקטיבית, אותו עיקרון "עריכה משפיעה
   קדימה בלבד" כמו בכל מקום אחר באפליקציה).
   פעיל רק אם DB.settings.loansAffectBalance — אם כבוי, המשתמש כבר עוקב
   אחרי ההלוואה בעצמו (הוראת קבע נפרדת למשל) ואסור ליצור גם תנועה אוטומטית
   כאן, אחרת היא תיספר פעמיים (בדיוק הסיכון שהאזהרה המקורית של ההגדרה הזו
   דיברה עליו, לפני שהיה בכלל מנגנון ייצור תנועות להלוואות).
   קטגוריית היעד (kind:'loan') מכוונת ל-CALC.month() לא לספור את זה גם
   כ"קבועות"/"משתנות" — ראו שם. ============================================================ */
function genLoanPayments(){
  if(!DB.settings.loansAffectBalance)return;
  const lc=DB.categories.find(c=>c.kind==='loan');
  if(!lc||!DB.loans.length)return;
  const y=curYM();
  let start=DB.meta.lastGenLoan||addM(y,-1);
  const months=[];let m=start;
  for(let i=0;i<14&&m<=y;i++){months.push(m);m=addM(m,1);}
  let anchorFold=0;
  months.forEach(mm=>{
    DB.loans.forEach(loan=>{
      const amt=LOANS.loanCalc(loan).totalPayment;
      if(amt<=0)return;
      const d=dayIn(mm,loan.payDay||10);
      const id='loanpay_'+loan.id+'_'+mm;
      if(DB.transactions.some(x=>x.id===id))return;
      const isCard=loan.paymentMethod==='card',card=isCard?CALC.card(loan.cardId):null;
      const chargeDate=isCard?CALC.chargeDate(d,card):d;
      DB.transactions.push({
        id:id,direction:'out',amount:amt,date:d,chargeDate:chargeDate,
        categoryId:lc.id,method:isCard?'card':'account',cardId:card?card.id:null,
        note:loan.name,installment:null,recurringId:null,incomeType:null,goalId:null,loanId:loan.id
      });
      // אותו רעיון בדיוק כמו anchorFold ב-genRecurring למעלה — תשלום שכבר "מכוסה"
      // ע"י עוגן יתרת הבנק לא ייספר בטעות פעמיים
      if(chargeDate<=(DB.account.openingDate||'0000-00-00'))anchorFold-=amt;
    });
  });
  DB.meta.lastGenLoan=y;
  if(anchorFold){
    DB.account.openingBalance=(DB.account.openingBalance||0)+anchorFold;
    save();
    toast('יתרת הבנק עודכנה אוטומטית ('+fmtS(anchorFold)+') בעקבות תשלום הלוואה — אם זה עדיין לא ירד בבנק בפועל, תקן ב"עדכן יתרה מהבנק"');
  }else{
    save();
  }
}

