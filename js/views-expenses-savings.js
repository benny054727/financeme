function vExpenses(){
  const y=selYM||curYM(),m=CALC.month(y);
  // בורר שנה+חודש: קודם היה בורר "6 חודשים אחרונים" קבוע (יחסית להיום, לא
  // לשנה שבחרת) — עכשיו יש ניווט שנה (‹ / ›) וכל 12 החודשים שלה מתחת, נגללים
  // אופקית. אי אפשר לנווט לשנה עתידית, וחודשים עתידיים בשנה הנוכחית לא
  // מוצגים בכלל (אין להם נתונים עדיין).
  const pickYear=+y.slice(0,4),curYear=+curYM().slice(0,4);
  let h='<div class="ybar"><button class="ynav" onclick="shiftPickerYear(-1)" aria-label="שנה קודמת">›</button>'+
    '<div class="ylbl">'+pickYear+'</div>'+
    '<button class="ynav" onclick="shiftPickerYear(1)" '+(pickYear>=curYear?'disabled':'')+' aria-label="שנה הבאה">‹</button></div>';
  h+='<div class="mbar">';
  for(let mo=1;mo<=12;mo++){
    const mm=pickYear+'-'+String(mo).padStart(2,'0');
    if(mm>curYM())break;
    h+='<button class="mbtn '+(mm===y?'active':'')+'" onclick="selYM=\''+mm+'\';render()">'+MON_S[mo-1]+'</button>';
  }
  h+='</div>';
  // כרטיסים ממוסגרים (כמו ה-KPI בדף הבית) במקום סגמנט "פיל" שרק הפעיל בו בולט —
  // כל טאב (קבועות/משתנות/חיסכון/הכנסות) מקבל מסגרת+צל משלו, כדי שיהיה ברור
  // שאלה 4 תצוגות נפרדות ולא רק כיתובים בתוך פס אחד
  h+='<div class="tabcards"><button class="'+(expTab==='fixed'?'on':'')+'" onclick="expTab=\'fixed\';render()">קבועות<span class="segamt">'+fmt(m.fixed)+'</span></button>'+
     '<button class="'+(expTab==='variable'?'on':'')+'" onclick="expTab=\'variable\';render()">משתנות<span class="segamt">'+fmt(m.variable)+'</span></button>'+
     '<button class="'+(expTab==='saving'?'on':'')+'" onclick="expTab=\'saving\';render()">חיסכון<span class="segamt">'+fmt(m.saving)+'</span></button>'+
     '<button class="'+(expTab==='income'?'on':'')+'" onclick="expTab=\'income\';render()">הכנסות<span class="segamt">'+fmt(m.income)+'</span></button></div>';
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
    h+='<div class="box"><div class="empty"><b>'+(expTab==='income'?'אין הכנסות בחודש זה':(expTab==='saving'?'אין הפקדות לחיסכון בחודש זה':'אין הוצאות בחודש זה'))+'</b>לחץ + כדי לרשום</div></div>';
  }
  // רשימת התנועות בפועל, לפי שם — כמו "תנועות אחרונות" בדף הבית, רק מסוננת לטאב ולחודש המוצגים
  const txsAll=DB.transactions.filter(x=>ym(x.date)===y&&CALC.cat(x.categoryId).kind===expTab).sort((a,b)=>b.date<a.date?-1:1);
  h+='<div class="box"><div class="stitle"><span>🕐</span> תנועות<span class="sright">'+txsAll.length+'</span></div>';
  h+=txsAll.length?txsAll.map(txRow).join(''):'<div class="empty"><b>אין תנועות בחודש זה</b></div>';
  h+='</div>';
  if(expTab==='fixed'||expTab==='income'||expTab==='saving'){
    const isInc=expTab==='income',isSav=expTab==='saving';
    // כדי לא לבלבל בין "הוצאה/הכנסה בפועל" (הקופסה למעלה) ל"כלל שיצר אותה" (כאן) — הקטגוריות
    // הבודדות למעלה כבר מספרות את כל הסיפור הכספי, אז מקפלים את הרשימה הזו כברירת מחדל
    // ופותחים אותה רק לפי בקשה, למי שבאמת צריך לנהל/להשהות/למחוק כלל.
    // מסוננת גם לפי קטגוריית ההוראה (לא רק כיוון): בלי זה, הוראת קבע שמקושרת
    // לחיסכון הייתה מופיעה גם ברשימת "קבועות" — עכשיו כל הוראה מופיעה רק בטאב
    // שבאמת מתאר אותה.
    const recs=DB.recurring.filter(r=>{
      if(isInc)return r.direction==='in';
      const kind=CALC.cat(r.categoryId).kind;
      return r.direction!=='in'&&(isSav?kind==='saving':kind!=='saving');
    });
    const boxTitle=isInc?'ניהול הכנסות קבועות':(isSav?'ניהול הפקדות קבועות לחיסכון':'ניהול הוראות קבע');
    h+='<div class="box"><div class="stitle" style="cursor:pointer" onclick="recBoxOpen=!recBoxOpen;render()"><span>⚙️</span> '+boxTitle+'<span class="sright">'+(recBoxOpen?'הסתר ▲':'הצג ▼')+'</span></div>';
    if(recBoxOpen){
      if(!recs.length)h+='<div class="empty"><b>'+(isInc?'לא הוגדרו הכנסות קבועות':(isSav?'לא הוגדרה הפקדה קבועה לחיסכון':'לא הוגדרו הוראות קבע'))+'</b>'+(isInc?'למשכורת באותו סכום כל חודש. הכנסה שמשתנה (כמו לפי שעות) — למטה, ב"הכנסות משתנות".':(isSav?'הוראת קבע שמקושרת ליעד חיסכון (ראו דף חיסכון) תופיע כאן':'הגדר אותן פעם אחת והמערכת תרשום אותן כל חודש אוטומטית'))+'</div>';
      recs.forEach(r=>{const c=CALC.cat(r.categoryId),cd=r.cardId?CALC.card(r.cardId):null,g=r.goalId?DB.goals.find(x=>x.id===r.goalId):null;
        // שורה שלמה לחיצה שפותחת מודאל עריכה/מחיקה — אותו דפוס בדיוק כמו שורת קטגוריה למעלה
        const instTag=r.installmentTotal?' · תשלום '+Math.min(r.installmentTotal,Math.max(1,monthsBetweenYM(r.startDate,curYM())+1))+'/'+r.installmentTotal:'';
        h+='<div class="eitem tap" style="'+(r.active?'':'opacity:.5')+'" onclick="openRecurring(\''+r.id+'\')"><div class="eico">'+c.icon+'</div><div class="einfo"><div class="ename">'+esc(r.name)+(r.active?'':' · מושהה')+'</div>'+
        '<div class="etag">ב-'+r.dayOfMonth+' לחודש'+(isInc?'':' · '+(cd?esc(cd.name):'מהעו"ש'))+(g?' · ל'+esc(g.name):'')+instTag+'</div></div>'+
        '<div class="eside"><div class="eamt'+(isInc?' in':'')+'">'+fmt(r.amount)+'</div></div></div>';});
      const savCat=isSav?DB.categories.find(x=>x.kind==='saving'):null;
      h+='<button class="addrow" style="margin-top:14px;margin-bottom:0" onclick="openRecurring(null'+(isSav?",'"+(savCat?savCat.id:'')+"'":',null')+(isInc?",'in'":'')+')">+ הוסף '+(isInc?'הכנסה קבועה':(isSav?'הפקדה קבועה':'הוראת קבע'))+'</button>';
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
/* מעביר את selYM שנה אחורה/קדימה (dir=-1/1), שומר על אותו חודש — למשל
   מ-2025-11 ל-2026-11. לא מאפשר לחרוג לעתיד: אם השנה החדשה+אותו חודש
   כבר אחרי החודש הנוכחי, קופצים בחזרה לחודש הנוכחי במקום להראות עתיד. */
function shiftPickerYear(dir){
  const y=selYM||curYM();
  const year=+y.slice(0,4),month=y.slice(5,7);
  const candidate=(year+dir)+'-'+month;
  selYM=candidate>curYM()?curYM():candidate;
  render();
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
   /* grid-template-columns מקומי: .btnrow המשותפת בנויה ל-2 כפתורים (1fr 1fr)
      ומשמשת ככה במקומות אחרים (אשף ההרשמה וכו') — כאן יש 3 כפתורים, אז דורסים
      מקומית בלי לגעת בכלל המשותף */
   '<div class="btnrow" style="margin-top:12px;grid-template-columns:1fr 1fr 1fr"><button class="btn sec" style="padding:10px;font-size:13px" onclick="openDeposit(\''+g.id+'\')">הפקד</button>'+
   '<button class="btn sec" style="padding:10px;font-size:13px" onclick="openGoalEdit(\''+g.id+'\')">ערוך</button>'+
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
  const g=DB.goals.find(x=>x.id===id);if(!g)return;
  // הפקדות שכבר נרשמו החודש הנוכחי עבור היעד הזה — בלי לטפל בהן הן נשארות תנועה
  // יתומה שממשיכה להיספר כחיסכון/הוצאה בכל מקום (עוגה/תנועות/דף הבית) למרות שהיעד
  // כבר נמחק. באותו עיקרון בדיוק כמו delRec(): תנועות החודש הנוכחי נמחקות יחד עם
  // היעד, תנועות מחודשים קודמים נשארות בהיסטוריה ("עריכה משפיעה קדימה בלבד").
  const curTx=DB.transactions.filter(x=>x.goalId===id&&ym(x.date)===curYM());
  if(!confirm(curTx.length?'למחוק את היעד "'+g.name+'"? '+curTx.length+' הפקדות שנרשמו החודש הזה יימחקו גם הן. תנועות מחודשים קודמים יישארו.':'למחוק את היעד?'))return;
  DB.goals=DB.goals.filter(x=>x.id!==id);
  if(curTx.length){const ids=curTx.map(t=>t.id);DB.transactions=DB.transactions.filter(x=>!ids.includes(x.id));}
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
    '<div style="font-size:26px;font-weight:900">'+fmt(v)+'</div><div class="mini">'+(c.kind==='income'?'התקבל החודש':(c.kind==='saving'?'הופרש החודש':'הוצא החודש'))+'</div></div>';
  if(bud>0){
    h+='<div class="barout"><div class="barin '+(over?'hi':p>85?'mid':'')+'" style="width:'+p+'%"></div></div>'+
       '<div class="barlbls"><span>₪0</span><span>'+fmt(bud)+'</span></div>'+
       '<div class="mini" style="margin-top:10px;text-align:center">תקציב '+fmt(bud)+(over?' · חריגה של '+fmt(v-bud):' · נשארו '+fmt(bud-v))+'</div>';
  }else{
    h+='<div class="mini" style="text-align:center">לא הוגדר תקציב לקטגוריה הזו</div>';
  }
  sheet(c.icon+' '+c.name,h);
}

