/* ============================================================
   6. UI — רינדור
   ============================================================ */
let PAGE='home',selYM=null,expTab='fixed',recBoxOpen=false;
const el=id=>document.getElementById(id);
// מערים טוסטים זה מעל זה (margin-bottom לפי כמה כבר על המסך) במקום לתת להם
// לחפוף בול על אותו מיקום — קורה בפועל כשפעולה אחת מייצרת שני טוסטים ברצף
// (למשל שמירת הוראת קבע + עדכון אוטומטי של יתרת הבנק, ראו genRecurring())
function toast(msg){
  const t=document.createElement('div');t.className='toast';t.textContent=msg;
  const stacked=document.querySelectorAll('.toast').length;
  if(stacked)t.style.marginBottom=(stacked*54)+'px';
  document.body.appendChild(t);setTimeout(()=>t.remove(),2200);
}
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
  h+='<div class="hgreet" style="display:flex;align-items:center;gap:11px;margin-bottom:16px">'+
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
  // kpiwrap עוטף את הכרטיס + ההערה מתחתיו כיחידה אחת — כדי שברשת הדו-טורית
  // (מסך רחב) הם לא ייקרעו זה מזה בשבירת עמודה, וההערה לא תישאר לבד בראש עמודה
  h+='<div class="kpiwrap"><div class="kpi">'+
     '<div class="kcard inc"><div class="klbl"><span class="dot"></span>הכנסות</div><div class="kamt">'+fmt(m.income)+'</div></div>'+
     '<div class="kcard exp"><div class="klbl"><span class="dot"></span>הוצאות</div><div class="kamt">'+fmt(m.out+loanPay+m.saving)+'</div></div>'+
     '<div class="kcard sav"><div class="klbl"><span class="dot"></span>לחיסכון</div><div class="kamt">'+fmt(totalSaved)+'</div></div>'+
     '</div>'+
     (loanPay>0?'<div class="mini">💡 "הוצאות" כולל '+fmt(loanPay)+' החזרי הלוואות ו-'+fmt(m.saving)+' הפקדה לחיסכון החודש</div>':'')+
     '</div>';
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
  h+=expenseTrendChart();
  const recent=DB.transactions.filter(x=>x.date<=iso(today())).sort((a,b)=>b.date<a.date?-1:1).slice(0,6);
  h+='<div class="box"><div class="stitle"><span>🕐</span> תנועות אחרונות</div>';
  h+=recent.length?recent.map(txRow).join(''):'<div class="empty"><b>עדיין אין תנועות</b>לחץ על + כדי לרשום את הראשונה</div>';
  h+='</div>';
  return h;
}
/* גרף מגמת הוצאות וחיסכון ל-6 חודשים אחרונים (פריט מהביקורת המקצועית — היה
   בורר "6 חודשים אחרונים" בדף ההוצאות, אבל בלי שום גרף שבאמת משווה ביניהם).
   שתי עמודות לכל חודש — הוצאות (CALC.month(y).out, קבועות+משתנות) וחיסכון
   (CALC.month(y).saving) — בכוונה זו לצד זו ולא מוערמות זו על זו: החיסכון הוא
   לא "עוד סוג הוצאה" (ראו catSummary/vExpenses — הוא נשאר קטגוריה נפרדת בכל
   מקום באפליקציה), רק רוצים להשוות את שתי המגמות באותו גרף. עמודות החודש
   הנוכחי (עדיין לא נגמר) מסומנות אחרת — מקווקוות ובצבע בהיר יותר — כדי לא
   להטעות בהשוואה מול חודשים שלמים. */
function expenseTrendChart(){
  const months=[];for(let i=5;i>=0;i--)months.push(addM(curYM(),-i));
  const expVals=months.map(y=>CALC.month(y).out);
  const savVals=months.map(y=>CALC.month(y).saving);
  const mx=Math.max(...expVals,...savVals,1);
  // שתי שורות הסכומים קבועות במקום למעלה — לא "צפות" מעל כל עמודה לפי הגובה
  // שלה (זה מה שגרם למספרים להיראות לא מיושרים/מתנגשים בין חודשים שונים).
  // העמודות עצמן גדלות מלמטה עד גובה מקסימלי שנשאר תמיד מתחת לשורות הסכום.
  const W=320,H=158,expLblY=16,savLblY=32,baseY=124,maxH=56;
  const slotW=W/6,barW=13,barGap=4,groupW=barW*2+barGap,groupOff=(slotW-groupW)/2;
  let bars='<g font-family="Heebo">';
  bars+='<line x1="2" y1="'+baseY+'" x2="'+(W-2)+'" y2="'+baseY+'" stroke="#eef1f6" stroke-width="1"/>';
  months.forEach((y,i)=>{
    const isCur=y===curYM();
    const gx=slotW*i+groupOff,cx1=gx+barW/2,cx2=gx+barW+barGap+barW/2;
    const ev=expVals[i],eh=mx?Math.round((ev/mx)*maxH):0;
    const sv=savVals[i],sh=mx?Math.round((sv/mx)*maxH):0;
    const expFill=isCur?'#f6b8b8':'#e5383b',savFill=isCur?'#c8b3f5':'#7c3aed';
    const mLbl=isCur?'#2563eb':'#94a3b8';
    bars+=(eh?'<rect x="'+gx+'" y="'+(baseY-eh)+'" width="'+barW+'" height="'+eh+'" rx="4" fill="'+expFill+'"/>':'')+
      (sh?'<rect x="'+(gx+barW+barGap)+'" y="'+(baseY-sh)+'" width="'+barW+'" height="'+sh+'" rx="4" fill="'+savFill+'"/>':'')+
      (ev>0?'<text x="'+cx1+'" y="'+expLblY+'" text-anchor="middle" font-size="7.5" font-weight="700" fill="#e5383b">'+fmt(ev)+'</text>':'')+
      (sv>0?'<text x="'+cx2+'" y="'+savLblY+'" text-anchor="middle" font-size="7.5" font-weight="700" fill="#7c3aed">'+fmt(sv)+'</text>':'')+
      '<text x="'+(gx+groupW/2)+'" y="'+(baseY+16)+'" text-anchor="middle" font-size="9" font-weight="'+(isCur?'800':'600')+'" fill="'+mLbl+'">'+esc(ymShort(y))+'</text>'+
      (isCur?'<text x="'+(gx+groupW/2)+'" y="'+(baseY+29)+'" text-anchor="middle" font-size="7" fill="#94a3b8">עד כה</text>':'');
  });
  bars+='</g>';
  const legend='<span class="mini" style="display:inline-flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:2.5px;background:#e5383b;display:inline-block"></span>הוצאות</span>'+
    '<span class="mini" style="display:inline-flex;align-items:center;gap:5px;margin-inline-start:14px"><span style="width:8px;height:8px;border-radius:2.5px;background:#7c3aed;display:inline-block"></span>חיסכון</span>';
  // max-width קבוע (לא width:100% טהור): בלי זה, ב-viewBox עם יחס רוחב-גובה קבוע,
  // "height:auto" גורם לגובה בפועל (וכל מה שבפנים, כולל טקסט) לתפוח באותה מידה
  // שהרוחב תופח — בכרטיס רחב מאוד (למשל ברשת הדו-טורית של הדסקטופ), הסכומים היו
  // יוצאים ענקיים. אותו עיקרון בדיוק שכבר קיים בעוגה (.dsvg — גודל קבוע, לא %).
  return '<div class="box"><div class="stitle"><span>📈</span> מגמת הוצאות וחיסכון — 6 חודשים אחרונים</div>'+
    '<div style="margin-bottom:6px">'+legend+'</div>'+
    '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;max-width:360px;height:auto;display:block;margin:0 auto">'+bars+'</svg></div>';
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
