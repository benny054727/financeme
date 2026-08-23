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

