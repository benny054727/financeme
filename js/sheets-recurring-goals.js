/* ---- סנכרון יתרה ---- */
function openSync(){
  sheet('עדכון יתרה מהבנק',
   '<div class="note" style="margin-bottom:16px">היתרה מתעדכנת לבד מכל תנועה. השתמש בזה רק אם נוצר פער מול הבנק — למשל עמלה או חיוב שלא רשמת.</div>'+
   '<div class="fld"><label for="sBal">יתרה נוכחית בבנק</label><input id="sBal" class="amtin" type="number" inputmode="decimal" value="'+Math.round(CALC.balance())+'"/></div>'+
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
  if(recDir==='in')return '<div class="fld"><label for="rDay">יום בחודש</label><input id="rDay" type="number" min="1" max="31" value="'+(r?r.dayOfMonth:5)+'"/></div>';
  return '<div class="row2"><div class="fld"><label for="rMethod">אמצעי תשלום</label><select id="rMethod"><option value="account" '+(r&&r.method==='account'?'selected':'')+'>מהעו"ש</option>'+
    DB.cards.map(c=>'<option value="'+c.id+'" '+(r&&r.cardId===c.id?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></div>'+
    '<div class="fld"><label for="rDay">יום בחודש</label><input id="rDay" type="number" min="1" max="31" value="'+(r?r.dayOfMonth:5)+'"/></div></div>';
}
function recAmtSectionHTML(r,isInst,presetAmt){
  if(recDir==='in')return '<div class="fld"><label for="rAmt">סכום חודשי</label><input id="rAmt" type="number" inputmode="decimal" placeholder="0" value="'+(r?r.amount:(presetAmt||''))+'"/></div>';
  return '<div class="fld"><label>סוג הוראה</label><div class="seg" role="group" aria-label="סוג הוראה"><button id="rTypeReg" class="'+(isInst?'':'on')+'" onclick="setRecType(false)">רגיל · כל חודש</button><button id="rTypeInst" class="'+(isInst?'on':'')+'" onclick="setRecType(true)">תשלומים · מספר קבוע</button></div></div>'+
   '<div id="rRegWrap" style="display:'+(isInst?'none':'')+'"><div class="fld"><label for="rAmt">סכום חודשי</label><input id="rAmt" type="number" inputmode="decimal" placeholder="0" value="'+(r&&!isInst?r.amount:(presetAmt||''))+'"/></div></div>'+
   '<div id="rInstWrap" style="display:'+(isInst?'':'none')+'"><div class="row2"><div class="fld"><label for="rTotal">סכום כולל</label><input id="rTotal" type="number" inputmode="decimal" placeholder="0" value="'+(isInst?Math.round(r.amount*r.installmentTotal*100)/100:'')+'"/></div>'+
     '<div class="fld"><label for="rCount">מספר תשלומים</label><input id="rCount" type="number" min="2" value="'+(isInst?r.installmentTotal:12)+'"/></div></div>'+
     '<div class="mini" id="rInstPrev" style="margin-bottom:4px"></div>'+
     (isInst?'<div class="mini">כבר בוצעו '+monthsBetweenYM(r.startDate,curYM())+' מתוך '+r.installmentTotal+' תשלומים</div>':'')+'</div>';
}
function openRecurring(editId,presetCatId,presetDir,presetGoalId,presetAmt){
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
   '<div class="fld"><label for="rName">שם</label><input id="rName" type="text" placeholder="'+(recDir==='in'?'הכנסה נוספת':'ביטוח רכב')+'" value="'+(r?esc(r.name):'')+'"/></div>'+
   '<div class="fld"><label for="rCat">קטגוריה</label><select id="rCat">'+recCatOptions(selCat)+'</select></div>'+
   '<div class="fld" id="rIncTypeWrap" style="display:'+(recDir==='in'?'':'none')+'"><label for="rIncType">סוג הכנסה</label><select id="rIncType">'+
     [['salary','משכורת'],['reserve','מענק מילואים'],['other','אחר']].map(function(p){return '<option value="'+p[0]+'" '+((r?r.incomeType===p[0]:p[0]==='salary')?'selected':'')+'>'+p[1]+'</option>';}).join('')+'</select></div>'+
   (DB.goals.length?'<div class="fld" id="rGoalWrap" style="display:'+(recDir==='in'?'none':'')+'"><label for="rGoal">קשר ליעד חיסכון (אופציונלי)</label><select id="rGoal"><option value="">ללא — לא קשור ליעד</option>'+
     DB.goals.map(g=>'<option value="'+g.id+'" '+((r?r.goalId===g.id:presetGoalId===g.id)?'selected':'')+'>'+esc(g.name)+'</option>').join('')+'</select>'+
     '<div class="hint">אם ההוראה היא הפקדה לחיסכון — קשר אותה ליעד כדי שהוא יתעדכן אוטומטית בכל חיוב</div></div>':'')+
   '<div id="rMethodDaySection">'+recMethodDayHTML(r)+'</div>'+
   '<div id="rAmtSection">'+recAmtSectionHTML(r,isInst,presetAmt)+'</div>'+
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
   '<div class="fld"><label for="viName">שם</label><input id="viName" type="text" placeholder="משכורת" value="'+(v?esc(v.name):'')+'"/></div>'+
   '<div class="fld"><label for="viCat">קטגוריה</label><select id="viCat">'+cats.map(c=>'<option value="'+c.id+'" '+(selCat===c.id?'selected':'')+'>'+c.icon+' '+esc(c.name)+'</option>').join('')+'</select></div>'+
   '<div class="fld"><label for="viIncType">סוג הכנסה</label><select id="viIncType">'+
     [['salary','משכורת'],['reserve','מענק מילואים'],['other','אחר']].map(function(p){return '<option value="'+p[0]+'" '+((v?v.incomeType===p[0]:p[0]==='salary')?'selected':'')+'>'+p[1]+'</option>';}).join('')+'</select></div>'+
   '<div class="fld"><label for="viDay">בסביבות איזה יום בחודש היא מגיעה</label><input id="viDay" type="number" min="1" max="31" value="'+(v?v.dayOfMonth:10)+'"/><div class="hint">אם עד היום הזה לא הזנת את הסכום בפועל, נזכיר לך בהתראות</div></div>'+
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
   '<div class="fld"><label for="gName">שם</label><input id="gName" type="text" placeholder="'+(type==='fund'?'קרן עתיד':'טיול לחו"ל')+'"/></div>'+
   '<div class="row2"><div class="fld"><label for="gTgt">'+(type==='fund'?'יעד (אופציונלי)':'סכום היעד')+'</label><input id="gTgt" type="number" inputmode="decimal" placeholder="0"/></div>'+
   '<div class="fld"><label for="gPlan">הפרשה חודשית</label><input id="gPlan" type="number" inputmode="decimal" placeholder="0"/></div></div>'+
   '<div class="hint" style="margin:-8px 0 12px">זה רק יעד תכנון — לא יוצר הפקדה אוטומטית מהעו"ש. כדי שכל חודש באמת יירד סכום קבוע, מוסיפים אחר כך "הוראת קבע" ומקשרים אותה ליעד הזה.</div>'+
   (type==='personal'?'<div class="fld"><label for="gDate">תאריך יעד</label><input id="gDate" type="date"/></div>':'')+
   '<div class="row2"><div class="fld"><label for="gSaved">כבר נצבר</label><input id="gSaved" type="number" inputmode="decimal" value="0"/></div>'+
   '<div class="fld"><label for="gSavedDate">תאריך ההפקדה הראשונית</label><input id="gSavedDate" type="date" value="'+iso(today())+'"/></div></div>'+
   '<div class="hint" style="margin:-8px 0 12px">שני השדות האלה הם רק נקודת פתיחה (למשל כסף שכבר הפרשת בעבר) — לא יוצרים תנועה ולא משנים את יתרת העו"ש.</div>'+
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
    createdDate:el('gSavedDate').value||iso(today()),
    priority:DB.goals.length+1,color:colors[DB.goals.length%colors.length]});
  save();closeSheet();render();toast('היעד נוסף');
}
/* עריכת יעד קיים — שם/יעד/הפרשה חודשית/תאריך יעד/סה"כ נצבר/תאריך ההפקדה
   הראשונית (createdDate — נקודת העיגון של גרף הצמיחה, ראו goalGrowthChart) */
function openGoalEdit(id){
  const g=DB.goals.find(x=>x.id===id);if(!g)return;
  // האם כבר יש הוראת קבע פעילה שמקושרת ליעד הזה? אם כן, אין טעם להציע ליצור עוד אחת —
  // מציגים קישור לעריכת הקיימת במקום
  const linkedRec=DB.recurring.find(x=>x.goalId===id&&x.active);
  const savingCat=DB.categories.find(c=>c.kind==='saving');
  sheet('עריכת '+(g.type==='fund'?'קרן':'יעד'),
   '<div class="fld"><label for="geName">שם</label><input id="geName" type="text" value="'+esc(g.name)+'"/></div>'+
   '<div class="row2"><div class="fld"><label for="geTgt">'+(g.type==='fund'?'יעד (אופציונלי)':'סכום היעד')+'</label><input id="geTgt" type="number" inputmode="decimal" value="'+(g.targetAmount||'')+'"/></div>'+
   '<div class="fld"><label for="gePlan">הפרשה חודשית</label><input id="gePlan" type="number" inputmode="decimal" value="'+(g.monthlyPlan||'')+'"/></div></div>'+
   '<div class="hint" style="margin:-8px 0 12px">זה רק יעד תכנון — לא יוצר הפקדה אוטומטית מהעו"ש (ראו למטה).</div>'+
   (g.type==='personal'?'<div class="fld"><label for="geDate">תאריך יעד</label><input id="geDate" type="date" value="'+(g.targetDate||'')+'"/></div>':'')+
   '<div class="row2"><div class="fld"><label for="geSaved">סה"כ נצבר כרגע</label><input id="geSaved" type="number" inputmode="decimal" value="'+g.saved+'"/></div>'+
   '<div class="fld"><label for="geSavedDate">תאריך ההפקדה הראשונית</label><input id="geSavedDate" type="date" value="'+(g.createdDate||iso(today()))+'"/></div></div>'+
   '<div class="hint" style="margin:-8px 0 12px">שני השדות האלה הם רק נקודת פתיחה — לא יוצרים תנועה ולא משנים את יתרת העו"ש.</div>'+
   '<button class="btn" onclick="saveGoalEdit(\''+id+'\')">שמור</button>'+
   (linkedRec?
     '<div class="note" style="margin-top:14px">🔁 מקושרת אליו הוראת קבע פעילה ("'+esc(linkedRec.name)+'", '+fmt(linkedRec.amount)+'/חודש) — היא זו שבאמת מפקידה כל חודש.<button class="lnk" style="display:block;margin-top:6px" onclick="openRecurring(\''+linkedRec.id+'\')">ערוך אותה</button></div>'
     :'<div class="note" style="margin-top:14px">כדי שכל חודש באמת יירד סכום קבוע לחיסכון הזה — צריך הוראת קבע מקושרת (לא רק "הפרשה חודשית" למעלה, שהיא רק תכנון).<button class="lnk" style="display:block;margin-top:6px" onclick="openRecurring(null,\''+(savingCat?savingCat.id:'')+'\',\'out\',\''+id+'\','+(g.monthlyPlan||0)+')">+ צור הוראת קבע לחיסכון הזה</button></div>'));
}
function saveGoalEdit(id){
  const g=DB.goals.find(x=>x.id===id);if(!g)return;
  const n=el('geName').value.trim();if(!n)return toast('הזן שם');
  g.name=n;
  g.targetAmount=parseFloat(el('geTgt').value)||0;
  if(g.type==='personal')g.targetDate=el('geDate').value||null;
  g.monthlyPlan=parseFloat(el('gePlan').value)||0;
  g.saved=parseFloat(el('geSaved').value)||0;
  g.createdDate=el('geSavedDate').value||g.createdDate;
  save();closeSheet();render();toast('נשמר');
}
function openDeposit(id){
  const g=DB.goals.find(x=>x.id===id);
  sheet('הפקדה ל'+g.name,
   '<div class="fld"><input id="dAmt" class="amtin" type="number" inputmode="decimal" aria-label="סכום ההפקדה" value="'+(g.monthlyPlan||'')+'" placeholder="0"/></div>'+
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
  const method=loan?(loan.paymentMethod||'account'):'account';
  sheet(loan?'עריכת הלוואה':'הלוואה חדשה',
   '<div class="fld"><label for="lnName">שם ההלוואה</label><input id="lnName" type="text" placeholder="משכנתא" value="'+(loan?esc(loan.name):'')+'"/></div>'+
   '<div class="row2"><div class="fld"><label for="lnStart">תאריך תחילת ההלוואה</label><input id="lnStart" type="date" value="'+(loan?loan.startDate:iso(today()))+'"/></div>'+
   '<div class="fld"><label for="lnPayDay">יום חיוב בחודש</label><input id="lnPayDay" type="number" min="1" max="31" value="'+(loan?loan.payDay||10:10)+'"/></div></div>'+
   '<div class="row2"><div class="fld"><label for="lnMethod">אמצעי תשלום</label><select id="lnMethod" onchange="paintLoanCardField()">'+
     '<option value="account" '+(method==='account'?'selected':'')+'>ישירות מהעו"ש</option>'+
     '<option value="card" '+(method==='card'?'selected':'')+'>כרטיס אשראי</option></select></div>'+
   '<div class="fld" id="lnCardWrap"><label for="lnCard">כרטיס</label><select id="lnCard">'+
     (DB.cards.length?DB.cards.map(c=>'<option value="'+c.id+'" '+(loan&&loan.cardId===c.id?'selected':'')+'>'+esc(c.name)+'</option>').join(''):'<option value="">אין כרטיסים מוגדרים</option>')+
   '</select></div></div>'+
   '<div class="hint" style="margin:-8px 0 12px">קובע איפה תשלום ההלוואה יופיע: ישירות מהעו"ש נספר ב"תנועות שכבר ירדו" ברגע שהגיע יום החיוב, כרטיס אשראי נספר ב"חיובים והכנסות צפויים" עד תאריך החיוב של הכרטיס.</div>'+
   '<div class="stitle" style="margin-top:18px;font-size:13px">מסלולים</div>'+
   '<div id="trackRows"></div>'+
   '<button class="addrow" onclick="addTrackRow()">+ הוסף מסלול</button>'+
   (DB.settings.boiRate?'':'<div class="note" style="margin-top:14px">⚠️ ריבית בנק ישראל לא הוגדרה עדיין (הגדרות → הלוואות) — מסלולי פריים יחושבו לפי מרווח בלבד.</div>')+
   '<button class="btn" style="margin-top:16px" onclick="saveLoan('+(loan?"'"+loan.id+"'":'null')+')">שמור</button>'+
   (loan?'<button class="btn dgr" style="margin-top:10px" onclick="delLoan(\''+loan.id+'\')">מחק הלוואה</button>':''),
   function(){paintTrackRows();paintLoanCardField();});
}
// מציג/מסתיר את בורר הכרטיס לפי אמצעי התשלום הנבחר — נקרא גם בפתיחת הטופס
// (במקרה של עריכת הלוואה שכבר מוגדרת ל"כרטיס") וגם ב-onchange של הבורר עצמו
function paintLoanCardField(){
  const w=el('lnCardWrap');if(!w)return;
  w.style.display=el('lnMethod').value==='card'?'':'none';
}
function paintTrackRows(){
  const w=el('trackRows');if(!w)return;
  w.innerHTML=tmpTracks.map((tr,i)=>
   '<div class="cardrow"><div class="crh"><span>מסלול '+(i+1)+'</span>'+(tmpTracks.length>1?'<button class="delx" onclick="rmTrackRow('+i+')" aria-label="מחק מסלול">✕</button>':'')+'</div>'+
   '<div class="fld"><input placeholder="שם המסלול" aria-label="שם המסלול" value="'+esc(tr.name)+'" oninput="tmpTracks['+i+'].name=this.value"/></div>'+
   '<div class="row2"><div class="fld"><label for="trkType'+i+'">סוג ריבית</label><select id="trkType'+i+'" onchange="tmpTracks['+i+'].type=this.value;paintTrackRows()">'+
     Object.keys(TRACK_TYPES).map(k=>'<option value="'+k+'" '+(tr.type===k?'selected':'')+'>'+TRACK_TYPES[k]+'</option>').join('')+'</select></div>'+
   '<div class="fld"><label for="trkPrincipal'+i+'">קרן</label><input id="trkPrincipal'+i+'" type="number" value="'+tr.principal+'" oninput="tmpTracks['+i+'].principal=+this.value"/></div></div>'+
   '<div class="row2">'+
     (tr.type==='prime'
       ?'<div class="fld"><label for="trkMargin'+i+'">מרווח מריבית ב"י (%)</label><input id="trkMargin'+i+'" type="number" step="0.01" value="'+tr.margin+'" oninput="tmpTracks['+i+'].margin=+this.value"/><div class="hint">שלילי = הנחה, חיובי = תוספת</div></div>'
       :'<div class="fld"><label for="trkRate'+i+'">ריבית שנתית (%)</label><input id="trkRate'+i+'" type="number" step="0.01" value="'+(tr.fixedRate||0)+'" oninput="tmpTracks['+i+'].fixedRate=+this.value"/></div>')+
     '<div class="fld"><label for="trkTerm'+i+'">תקופה (חודשים)</label><input id="trkTerm'+i+'" type="number" min="1" value="'+tr.termMonths+'" oninput="tmpTracks['+i+'].termMonths=+this.value"/></div>'+
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
  const paymentMethod=el('lnMethod').value==='card'?'card':'account';
  const cardId=paymentMethod==='card'?(el('lnCard').value||null):null;
  if(paymentMethod==='card'&&!cardId)return toast('בחר כרטיס, או הגדר כרטיס בהגדרות קודם');
  if(editId){
    const loan=DB.loans.find(l=>l.id===editId);if(!loan)return;
    loan.name=n;loan.startDate=start;loan.tracks=clean;loan.payDay=payDay;
    loan.paymentMethod=paymentMethod;loan.cardId=cardId;
  }else{
    DB.loans.push({id:uid('loan'),name:n,startDate:start,payDay:payDay,tracks:clean,paymentMethod:paymentMethod,cardId:cardId});
  }
  save();genLoanPayments();closeSheet();render();toast('נשמר');
}
function delLoan(id){
  const loan=DB.loans.find(l=>l.id===id);if(!loan)return;
  // בניגוד ל-delRec()/delGoal() (עריכה/מחיקה משפיעה קדימה בלבד, היסטוריה נשארת) —
  // כאן העיקרון הוא כמו deleteInstallmentGroup(): מחיקת הלוואה מוחקת את כל תשלומיה
  // שנוצרו אוטומטית, כולל עבר. הסיבה: תשלומי הלוואה הם "סדרה" שנוצרה כולה על ידי
  // המערכת (genLoanPayments) מרגע שהוגדרה ההלוואה, לא תנועות שהמשתמש הזין/אישר
  // אחת-אחת — מחיקת ההלוואה אמורה להסיר גם את ההשפעה שלה על היתרה המוצגת, אחרת
  // המשתמש רואה תנועות "יתומות" ויתרה שממשיכה לשקף הלוואה שכבר לא קיימת (בדיוק
  // התלונה שהובילה לשינוי הזה).
  const txCount=DB.transactions.filter(x=>x.loanId===id).length;
  if(!confirm(txCount?'למחוק את ההלוואה? '+txCount+' תשלומים שכבר נרשמו (כולל מחודשים קודמים) יימחקו גם הם, וישפיעו על היתרה המוצגת. הפעולה לא הפיכה.':'למחוק את ההלוואה? הפעולה לא הפיכה — הנתונים לא נשמרים במקום אחר.'))return;
  DB.loans=DB.loans.filter(l=>l.id!==id);
  DB.transactions=DB.transactions.filter(x=>x.loanId!==id);
  save();closeSheet();render();toast('נמחק');
}
function loanDetail(id){
  const loan=DB.loans.find(l=>l.id===id);if(!loan)return;
  const lc=LOANS.loanCalc(loan),lcard=loan.paymentMethod==='card'?CALC.card(loan.cardId):null;
  let h='<div class="note" style="margin-bottom:16px">יתרה כוללת: <b>'+fmt(lc.totalBalance)+'</b> · החזר חודשי כולל: <b>'+fmt(lc.totalPayment)+'</b> · ריבית שתיוותר: <b>'+fmt(lc.totalInterest)+'</b></div>'+
    '<div class="mini" style="margin:-10px 0 14px">💳 נגבה '+(lcard?'מכרטיס '+esc(lcard.name):'ישירות מהעו"ש')+' · יום חיוב '+(loan.payDay||10)+' בחודש</div>';
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
