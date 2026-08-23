/* ============================================================
   8. SETUP — אשף התקנה ראשונית
   ============================================================ */
// שלבים 3-5 (הוצאות קבועות/הלוואה/יעד) הם תוספת מודעת ביחס לאשף המקורי בן 3
// השאלות: בלעדיהם, יום ראשון באפליקציה תמיד התחיל מ"0 הוצאות קבועות" והתחזית
// בדף הבית הייתה שקרית עד שממלאים הכל ידנית בהדרגה. כל שלב חדש כן ניתן לדילוג
// בלחיצה אחת — המטרה היא תחזית קרובה לאמת ביום הראשון, לא טופס ארוך יותר.
let sStep=0,sData={balance:0,buffer:1000,overdraft:0,cards:[],salary:0,salaryDay:10,incomeMode:'fixed',
  fixedExpenses:[],
  wantLoan:false,loan:{name:'',principal:0,type:'prime',margin:-0.5,fixedRate:0,termMonths:240,payDay:10},
  wantGoal:false,goal:{name:'',target:0,monthlyPlan:0,saved:0}};
function drawSetup(){
  const s=el('setup');
  let h='<div class="slogo"><div class="si">💰</div><h1>FinanceMe</h1><p>כמה שאלות קצרות ומתחילים.<br/>כל שלב אחרי הראשון אפשר לדלג עליו. הכל נשמר במכשיר שלך בלבד.</p></div>';
  h+='<div class="steps">'+[0,1,2,3,4,5].map(i=>'<i class="'+(i<=sStep?'on':'')+'"></i>').join('')+'</div>';
  if(sStep===0){
    h+='<div class="box"><div class="stitle"><span>🏦</span> החשבון שלך</div>'+
      '<div class="fld"><label for="i1">יתרה נוכחית בעו"ש</label><input id="i1" type="number" inputmode="decimal" value="'+sData.balance+'"/><div class="hint">הסכום שמופיע עכשיו באפליקציית הבנק</div></div>'+
      '<div class="fld"><label for="i2">כרית ביטחון</label><input id="i2" type="number" value="'+sData.buffer+'"/><div class="hint">סכום שאתה לא רוצה לרדת מתחתיו — נשתמש בו להתראות</div></div>'+
      '<div class="fld"><label for="i3">מסגרת אשראי (0 אם אין)</label><input id="i3" type="number" value="'+sData.overdraft+'"/></div>'+
      '<button class="btn" onclick="sNext()">המשך</button></div>';
  }else if(sStep===1){
    h+='<div class="box"><div class="stitle"><span>💳</span> כרטיסי האשראי</div>'+
      '<div class="note" style="margin-bottom:16px">יום החיוב הוא הדבר החשוב ביותר במערכת. הוא קובע מתי כל קנייה תרד מהעו"ש בפועל.</div>'+
      '<div id="stCards"></div><button class="addrow" onclick="addCardRow()">+ הוסף כרטיס</button>'+
      '<div class="btnrow"><button class="btn sec" onclick="sBack()">חזור</button><button class="btn" onclick="sNext()">המשך</button></div></div>';
  }else if(sStep===2){
    const isVar=sData.incomeMode==='variable';
    h+='<div class="box"><div class="stitle"><span>💼</span> ההכנסה הקבועה</div>'+
      '<div class="fld"><label>איך מתקבלת ההכנסה שלך?</label><div class="seg" role="group" aria-label="איך מתקבלת ההכנסה שלך"><button id="sIncFixed" class="'+(isVar?'':'on')+'" onclick="sSetIncomeMode(\'fixed\')">משכורת קבועה</button><button id="sIncVar" class="'+(isVar?'on':'')+'" onclick="sSetIncomeMode(\'variable\')">משתנה כל חודש</button></div></div>'+
      (isVar
        ?'<div class="fld"><label for="i2">בסביבות איזה יום בחודש היא מגיעה</label><input id="i2" type="number" min="1" max="31" value="'+sData.salaryDay+'"/></div>'+
         '<div class="note" style="margin-bottom:16px">למשכורת לפי שעות או כל הכנסה שהסכום שלה משתנה — לא קובעים סכום מראש. כל חודש נזכיר לך בהתראות להזין את הסכום בפועל, בטאב "הכנסות".</div>'
        :'<div class="fld"><label for="i1">משכורת חודשית נטו</label><input id="i1" type="number" inputmode="decimal" value="'+(sData.salary||'')+'" placeholder="0"/></div>'+
         '<div class="fld"><label for="i2">יום כניסת המשכורת</label><input id="i2" type="number" min="1" max="31" value="'+sData.salaryDay+'"/></div>'+
         '<div class="note" style="margin-bottom:16px">מענק מילואים והכנסות חד-פעמיות תזין בנפרד — הן לא נכללות בבסיס החודשי בכוונה.</div>')+
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
      h+='<div class="fld"><label for="i1">שם ההלוואה</label><input id="i1" type="text" placeholder="משכנתא" value="'+esc(L.name)+'"/></div>'+
        '<div class="row2"><div class="fld"><label for="i2">יתרת קרן נוכחית</label><input id="i2" type="number" inputmode="decimal" value="'+(L.principal||'')+'"/></div>'+
        '<div class="fld"><label for="i3">יום חיוב בחודש</label><input id="i3" type="number" min="1" max="31" value="'+L.payDay+'"/></div></div>'+
        '<div class="fld"><label>סוג ריבית</label><div class="seg" role="group" aria-label="סוג ריבית"><button id="sLoanPrime" class="'+(L.type==='prime'?'on':'')+'" onclick="sSetLoanType(\'prime\')">פריים</button><button id="sLoanFixed" class="'+(L.type==='fixed'?'on':'')+'" onclick="sSetLoanType(\'fixed\')">קבועה</button></div></div>'+
        (L.type==='prime'
          ?'<div class="fld"><label for="i4">מרווח מריבית ב"י (%)</label><input id="i4" type="number" step="0.01" value="'+L.margin+'"/><div class="hint">שלילי = הנחה, חיובי = תוספת</div></div>'
          :'<div class="fld"><label for="i4">ריבית שנתית (%)</label><input id="i4" type="number" step="0.01" value="'+(L.fixedRate||0)+'"/></div>')+
        '<div class="fld"><label for="i5">תקופה שנותרה (חודשים)</label><input id="i5" type="number" min="1" value="'+L.termMonths+'"/></div>'+
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
      h+='<div class="fld"><label for="i1">שם היעד</label><input id="i1" type="text" placeholder="טיול לחו״ל" value="'+esc(G.name)+'"/></div>'+
        '<div class="row2"><div class="fld"><label for="i2">סכום היעד</label><input id="i2" type="number" inputmode="decimal" value="'+(G.target||'')+'"/></div>'+
        '<div class="fld"><label for="i3">הפרשה חודשית</label><input id="i3" type="number" inputmode="decimal" value="'+(G.monthlyPlan||'')+'"/></div></div>'+
        '<div class="fld"><label for="i4">כבר נצבר (0 אם מתחילים מאפס)</label><input id="i4" type="number" inputmode="decimal" value="'+(G.saved||'')+'"/></div>'+
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
      (f.checked?'<div class="row2" style="margin-top:10px"><div class="fld"><label for="fixAmt'+i+'">סכום חודשי</label><input id="fixAmt'+i+'" type="number" inputmode="decimal" placeholder="0" value="'+(f.amount||'')+'" oninput="sData.fixedExpenses['+i+'].amount=+this.value"/></div>'+
        '<div class="fld"><label for="fixDay'+i+'">יום חיוב</label><input id="fixDay'+i+'" type="number" min="1" max="31" value="'+f.day+'" oninput="sData.fixedExpenses['+i+'].day=+this.value"/></div></div>':'')+
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
// שדה הסכום (i1) קיים ב-DOM רק במצב "משכורת קבועה" — במצב "משתנה" אין סכום
// בכלל (זה בדיוק העניין), אז שומרים 0 ולא קוראים אלמנט שלא קיים.
function sReadIncomeFields(){
  if(sData.incomeMode==='fixed')sData.salary=+el('i1').value||0;else sData.salary=0;
  sData.salaryDay=+el('i2').value||10;
}
function sSetIncomeMode(mode){sReadIncomeFields();sData.incomeMode=mode;drawSetup();}
function sNext(){
  if(sStep===0){sData.balance=+el('i1').value||0;sData.buffer=+el('i2').value||0;sData.overdraft=+el('i3').value||0;
    if(!tmpCards.length)tmpCards=[];}
  if(sStep===1){sData.cards=tmpCards.filter(c=>c.name.trim());}
  if(sStep===2)sReadIncomeFields();
  if(sStep===4)sReadLoanFields();
  sStep++;drawSetup();
}
function sBack(){
  if(sStep===1)sData.cards=tmpCards.filter(c=>c.name.trim());
  if(sStep===2)sReadIncomeFields();
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
  if(sData.incomeMode==='variable'){
    // "משתנה כל חודש" — לא הוראת קבע (אין סכום קבוע ליצור ממנו תנועה לבד),
    // רק תזכורת חודשית שתופיע בטאב "הכנסות" (בדיוק כמו openVariableIncome)
    DB.variableIncomes.push({id:uid('vi'),name:'משכורת',categoryId:'c_salary',incomeType:'salary',dayOfMonth:sData.salaryDay,active:true});
  }else if(sData.salary>0){
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

