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

