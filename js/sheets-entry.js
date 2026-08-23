/* ============================================================
   7. SHEETS — מודאלים
   ============================================================ */
// backFn (אופציונלי): שם פונקציה (מחרוזת, בלי ()) שפותחת את המסך ההורה — למשל
// 'openSettings'. כשמוגדר, מוצג כפתור "‹ חזרה" ליד הכותרת, בנוסף ל-✕ שסוגר לגמרי.
// שומר את האלמנט שהיה בפוקוס לפני פתיחת החלונית, כדי להחזיר אליו פוקוס בסגירה —
// בלי זה, משתמש מקלדת/קורא-מסך "מאבד" את המקום שלו בדף אחרי כל חלונית שנסגרת
let sheetReturnFocus=null;
function sheet(title,body,onOpen,backFn){
  closeSheet();
  sheetReturnFocus=document.activeElement;
  const ov=document.createElement('div');ov.className='ov';ov.id='ov';
  ov.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle" tabindex="-1"><div class="grab"></div><div class="shead"><div class="shead-lead">'+
    (backFn?'<button class="backbtn" onclick="'+backFn+'()">‹ חזרה</button>':'')+
    '<h3 id="sheetTitle">'+esc(title)+'</h3></div><button class="xbtn" onclick="closeSheet()" aria-label="סגור">✕</button></div>'+body+'</div>';
  ov.addEventListener('click',e=>{if(e.target===ov)closeSheet();});
  // Esc סוגר; Tab/Shift+Tab נשארים כלואים בתוך החלונית (focus trap) כדי שמשתמש מקלדת
  // לא "יברח" בטעות לתוכן שמאחורי ה-overlay בזמן שהיא פתוחה
  ov.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeSheet();return;}
    if(e.key==='Tab'){
      const f=ov.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
      if(!f.length)return;
      const first=f[0],last=f[f.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  document.body.appendChild(ov);
  const sh=ov.querySelector('.sheet');if(sh)sh.focus();
  if(onOpen)onOpen();
}
function closeSheet(){
  const o=el('ov');if(o)o.remove();
  if(sheetReturnFocus&&sheetReturnFocus.focus)try{sheetReturnFocus.focus();}catch(e){}
  sheetReturnFocus=null;
}

/* ---- הזנה מהירה ---- */
let E={dir:'out',cat:null,method:null,cardId:null,inst:1,freq:'once'};
function openEntry(){
  incType='salary';E={dir:'out',cat:null,kind:'variable',method:DB.meta.lastMethod||(DB.cards[0]?'card':'account'),cardId:DB.meta.lastCard||(DB.cards[0]?DB.cards[0].id:null),inst:1,freq:'once'};
  const b=
   '<div class="seg"><button id="dOut" class="on" onclick="setDir(\'out\')">הוצאה</button><button id="dIn" onclick="setDir(\'in\')">הכנסה</button></div>'+
   '<div class="fld"><input id="eAmt" class="amtin" type="number" inputmode="decimal" placeholder="0" aria-label="סכום" oninput="prevCharge()"/></div>'+
   '<div class="fld" id="eKindWrap"><label>סוג ההוצאה</label><div id="eKinds" class="chips" role="group" aria-label="סוג ההוצאה">'+
     '<button class="chip" data-k="fixed" onclick="setKind(this)">קבועה</button>'+
     '<button class="chip on" data-k="variable" onclick="setKind(this)">משתנה</button></div></div>'+
   '<div class="fld"><label>קטגוריה</label><div id="eCats" class="catgrid" role="group" aria-label="קטגוריה"></div></div>'+
   '<div class="fld" id="eMethodWrap"><label>אמצעי תשלום</label><div id="eMethods" class="chips" role="group" aria-label="אמצעי תשלום"></div></div>'+
   '<div class="fld" id="eIncWrap" style="display:none"><label>סוג הכנסה</label><div class="chips" role="group" aria-label="סוג הכנסה">'+
     '<button class="chip on" data-it="salary" onclick="setInc(this)">משכורת</button>'+
     '<button class="chip" data-it="reserve" onclick="setInc(this)">מענק מילואים</button>'+
     '<button class="chip" data-it="other" onclick="setInc(this)">אחר</button></div></div>'+
   '<div class="row2"><div class="fld"><label for="eDate">תאריך</label><input id="eDate" type="date" value="'+iso(today())+'"/></div>'+
   '<div class="fld" id="eInstWrap"><label>תדירות</label><div class="seg" id="eFreqSeg" role="group" aria-label="תדירות">'+
     '<button class="on" data-f="once" onclick="setFreq(\'once\')">פעם אחת</button>'+
     '<button data-f="inst" onclick="setFreq(\'inst\')">בתשלומים</button>'+
     '<button data-f="rec" onclick="setFreq(\'rec\')">הוראת קבע</button></div>'+
     '<div id="eInstCountWrap" style="display:none;margin-top:10px"><select id="eInst" onchange="prevCharge()">'+
       [2,3,4,5,6,8,10,12,18,24,36].map(n=>'<option value="'+n+'">'+n+' תשלומים</option>').join('')+'</select></div></div></div>'+
   '<div class="fld"><label for="eNote">הערה</label><input id="eNote" type="text" placeholder="למשל: סופר, דלק..."/></div>'+
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
  h+='<div class="fld"><label for="tAmt">סכום</label><input id="tAmt" class="amtin" type="number" inputmode="decimal" value="'+x.amount+'"/></div>'+
     '<div class="fld"><label for="tCat">קטגוריה</label><select id="tCat">'+cats.map(k=>'<option value="'+k.id+'" '+(k.id===x.categoryId?'selected':'')+'>'+k.icon+' '+esc(k.name)+'</option>').join('')+'</select></div>'+
     '<div class="fld"><label for="tDate">תאריך ההוצאה</label><input id="tDate" type="date" value="'+x.date+'"/></div>'+
     '<div class="fld"><label for="tNote">הערה</label><input id="tNote" type="text" value="'+esc(x.note||'')+'"/></div>'+
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
   '<div class="fld"><label for="rName">שם ההוצאה</label><input id="rName" type="text" value="'+esc(x.note||CALC.cat(x.categoryId).name)+'"/></div>'+
   '<div class="fld"><label for="rCat">קטגוריה</label><select id="rCat">'+cats.map(k=>'<option value="'+k.id+'" '+(k.id===x.categoryId?'selected':'')+'>'+k.icon+' '+esc(k.name)+'</option>').join('')+'</select></div>'+
   '<div class="row2"><div class="fld"><label for="rMethod">אמצעי תשלום</label><select id="rMethod"><option value="account" '+(!x.cardId?'selected':'')+'>מהעו"ש</option>'+
     DB.cards.map(c=>'<option value="'+c.id+'" '+(x.cardId===c.id?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></div>'+
   '<div class="fld"><label for="rDay">יום בחודש</label><input id="rDay" type="number" min="1" max="31" value="'+day+'"/></div></div>'+
   '<div class="fld"><label for="rAmt">סכום</label><input id="rAmt" type="number" inputmode="decimal" placeholder="0" value="'+x.amount+'"/></div>'+
   '<button class="btn sec" onclick="saveFixedTxOnly(\''+id+'\')">שמור (רק את התנועה הזו)</button>'+
   '<div class="fld" style="margin-top:18px"><label>סוג הוראת קבע (אופציונלי — רק אם לוחצים למטה)</label><div class="seg" role="group" aria-label="סוג הוראת קבע"><button id="rTypeReg" class="on" onclick="setRecType(false)">רגיל · כל חודש</button><button id="rTypeInst" onclick="setRecType(true)">תשלומים · מספר קבוע</button></div></div>'+
   '<div id="rRegWrap" class="mini">משתמש בסכום שהוזן למעלה כסכום החודשי הקבוע.</div>'+
   '<div id="rInstWrap" style="display:none"><div class="row2"><div class="fld"><label for="rTotal">סכום כולל</label><input id="rTotal" type="number" inputmode="decimal" placeholder="0"/></div>'+
     '<div class="fld"><label for="rCount">מספר תשלומים</label><input id="rCount" type="number" min="2" value="12"/></div></div>'+
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
   '<div class="fld"><input id="vAmt" class="amtin" type="number" inputmode="decimal" aria-label="סכום" value="'+x.amount+'"/></div>'+
   '<div class="fld"><label for="vName">שם ההוצאה</label><input id="vName" type="text" value="'+esc(x.note||'')+'"/></div>'+
   '<div class="fld"><label for="vCat">קטגוריה</label><select id="vCat">'+cats.map(k=>'<option value="'+k.id+'" '+(k.id===x.categoryId?'selected':'')+'>'+k.icon+' '+esc(k.name)+'</option>').join('')+'</select></div>'+
   '<div class="row2"><div class="fld"><label for="vMethod">אמצעי תשלום</label><select id="vMethod"><option value="cash" '+(x.method==='cash'?'selected':'')+'>מזומן</option><option value="account" '+(x.method==='account'?'selected':'')+'>מהעו"ש</option>'+
     DB.cards.map(c=>'<option value="'+c.id+'" '+(x.cardId===c.id?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></div>'+
   '<div class="fld"><label for="vDate">תאריך ההוצאה</label><input id="vDate" type="date" value="'+x.date+'"/></div></div>'+
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
      '<button class="delx" onclick="rmCat('+i+')" aria-label="מחק קטגוריה">✕</button></div>'+
      '<div class="row2"><div class="fld"><input placeholder="שם" aria-label="שם הקטגוריה" value="'+esc(c.name)+'" oninput="tmpCats['+i+'].name=this.value"/></div>'+
      '<div class="fld"><select aria-label="סמל" onchange="tmpCats['+i+'].icon=this.value">'+ICONS.map(ic=>'<option value="'+ic+'" '+(c.icon===ic?'selected':'')+'>'+ic+'</option>').join('')+'</select></div></div>'+
      '<div class="row2"><div class="fld"><label for="catKind'+i+'">סוג</label><select id="catKind'+i+'" onchange="tmpCats['+i+'].kind=this.value;paintCats()">'+
        ['fixed','variable','saving','income'].map(k=>'<option value="'+k+'" '+(c.kind===k?'selected':'')+'>'+lbl[k]+'</option>').join('')+'</select></div>'+
      '<div class="fld"><label for="catBudget'+i+'">תקציב חודשי</label><input id="catBudget'+i+'" type="number" value="'+(c.budget||0)+'" oninput="tmpCats['+i+'].budget=+this.value"/></div></div>'+
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

