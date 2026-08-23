function vAccount(){
  const av=CALC.available(),monthEnd=CALC.monthEnd(),y=curYM(),t=iso(today());
  let h='';
  h+='<div class="hero"><div class="hlbl"><span class="dot" style="background:var(--balance)"></span>יתרה בבנק</div>'+
     '<div class="hamt '+(av.balance<0?'neg':'')+'">'+fmtS(av.balance)+'</div>'+
     '<div class="mini" style="margin-bottom:12px">עודכן: '+(DB.account.lastUpdated?dLabel(DB.account.lastUpdated):'מעולם לא')+'</div>'+
     '<button class="btn sec" onclick="openSync()">עדכן יתרה מהבנק</button></div>';
  h+='<div class="box"><div class="stitle"><span>🏦</span> הלוואות'+(DB.loans.length?'<span class="sright">'+fmt(LOANS.allMonthlyTotal())+' לחודש</span>':'')+'</div>';
  if(!DB.loans.length)h+='<div class="empty"><b>אין הלוואות רשומות</b>הוסף הלוואה כדי לעקוב אחרי החזר חודשי, יתרה וריבית</div>';
  else DB.loans.forEach(loan=>{
    const lc=LOANS.loanCalc(loan);
    h+='<div class="eitem tap" onclick="loanDetail(\''+loan.id+'\')"><div class="eico">🏦</div><div class="einfo"><div class="ename">'+esc(loan.name)+'</div>'+
      '<div class="etag">יתרה '+fmt(lc.totalBalance)+' · '+loan.tracks.length+' מסלולים</div></div>'+
      '<div class="eside"><div class="eamt">'+fmt(lc.totalPayment)+'</div><div class="edate">לחודש</div></div></div>';
  });
  h+='<button class="addrow" style="margin-top:14px;margin-bottom:0" onclick="openLoanForm()">+ הוסף הלוואה</button></div>';
  h+='<div class="box"><div class="stitle"><span>📉</span> תחזית לסוף החודש</div>'+
     '<div class="barpct" style="color:'+(monthEnd<0?'var(--expense)':monthEnd<DB.settings.safetyBuffer?'var(--warn)':'var(--income)')+'">'+fmtS(monthEnd)+'</div>'+
     '<div class="alert '+(monthEnd<0?'a-crit':monthEnd<DB.settings.safetyBuffer?'a-warn':'a-good')+'" style="margin-top:10px">'+
     '<div class="aic">'+(monthEnd<DB.settings.safetyBuffer?'⚠️':'✅')+'</div><div class="atx"><b>'+fmtS(monthEnd)+'</b>יתרה בבנק פחות כל ההוצאות הקבועות, המשתנות, ההלוואה וההפקדה לחיסכון שנרשמו החודש. אותו מספר בדיוק כמו בדף הבית.</div></div></div>';
  const up=DB.transactions.filter(x=>x.chargeDate>=t).sort((a,b)=>a.chargeDate<b.chargeDate?-1:1);
  h+='<div class="box"><div class="stitle"><span>📅</span> חיובים והכנסות צפויים<span class="sright">'+up.length+'</span></div>';
  if(!up.length)h+='<div class="empty"><b>אין חיובים עתידיים</b>הכל כבר ירד מהחשבון</div>';
  else{
    let run=av.balance;
    h+=up.slice(0,25).map(x=>{
      run+=(x.direction==='out'?-x.amount:x.amount);
      const c=CALC.cat(x.categoryId),cd=x.cardId?CALC.card(x.cardId):null;
      return '<div class="eitem"><div class="eico">'+c.icon+'</div><div class="einfo"><div class="ename">'+esc(x.note||c.name)+'</div>'+
        '<div class="etag">'+(cd?'<span class="tdot" style="background:'+cd.color+'"></span>'+esc(cd.name):'מהעו"ש')+
        (x.installment?' · תשלום '+x.installment.index+'/'+x.installment.total:'')+'</div></div>'+
        '<div class="eside"><div class="eamt '+(x.direction==='in'?'in':'')+'">'+(x.direction==='in'?'+':'-')+fmt(x.amount)+'</div>'+
        '<div class="edate">'+dLabel(x.chargeDate)+' · יתרה '+fmtS(run)+'</div></div></div>';
    }).join('');
  }
  h+='</div>';
  const past=DB.transactions.filter(x=>x.chargeDate<t).sort((a,b)=>b.chargeDate<a.chargeDate?-1:1).slice(0,15);
  h+='<div class="box"><div class="stitle"><span>🕐</span> תנועות שכבר ירדו</div>';
  h+=past.length?past.map(txRow).join(''):'<div class="empty">אין עדיין</div>';
  h+='</div>';
  return h;
}

/* ---------- CARDS ---------- */
function vCards(){
  let h='';
  if(!DB.cards.length)return '<div class="box"><div class="empty"><b>לא הוגדרו כרטיסים</b>הוסף כרטיס בהגדרות כדי לעקוב אחרי חיובים</div></div>';
  h+='<div class="ccgrid">';
  DB.cards.forEach((c,i)=>{
    const cy=CALC.cycle(c.id);
    const grad=['linear-gradient(135deg,#4f46e5,#7c3aed)','linear-gradient(135deg,#d97706,#f59e0b)','linear-gradient(135deg,#059669,#10b981)','linear-gradient(135deg,#0891b2,#06b6d4)'][i%4];
    const usePct=c.limit>0?Math.min(100,(cy.used/c.limit)*100):0;
    h+='<div class="cc" style="background:'+grad+'" onclick="cardDetail(\''+c.id+'\')">'+
       '<div class="ccbdg">'+esc(brandName(c.brand))+'</div><div class="ccchip">💎</div>'+
       '<div class="ccname">'+esc(c.name)+'</div><div class="ccnum">•••• '+esc(c.last4||'____')+'</div>'+
       '<div class="ccfoot"><div><div class="cclbl">חיוב קרוב'+(cy.nextDate?' · '+dLabel(cy.nextDate):'')+'</div><div class="ccamt">'+fmt(cy.nextAmount)+'</div></div>'+
       '<div class="ccopen"><div class="cclbl">צבירה פתוחה</div><div class="ccamt" style="font-size:15px">'+fmt(cy.open)+'</div></div></div>'+
       (c.limit>0?'<div class="ccbar"><i style="width:'+usePct+'%"></i></div><div class="cclbl" style="margin-top:6px">'+fmt(cy.used)+' מתוך מסגרת '+fmt(c.limit)+'</div>':'')+
       '</div>';
  });
  h+='</div>';
  const ins={};
  DB.transactions.filter(x=>x.installment&&x.chargeDate>=iso(today())).forEach(x=>{
    const g=x.installment.groupId;
    if(!ins[g])ins[g]={note:x.note,cat:x.categoryId,total:x.installment.total,left:0,sum:0,next:x.installment.index};
    ins[g].left++;ins[g].sum+=x.amount;ins[g].next=Math.min(ins[g].next,x.installment.index);
  });
  const ik=Object.keys(ins);
  if(ik.length){
    h+='<div class="box" style="margin-top:16px"><div class="stitle"><span>🧾</span> תשלומים פעילים</div>';
    ik.forEach(k=>{const g=ins[k],c=CALC.cat(g.cat);
      h+='<div class="eitem tap" onclick="installmentGroupDetail(\''+k+'\')"><div class="eico">'+c.icon+'</div><div class="einfo"><div class="ename">'+esc(g.note||c.name)+'</div>'+
        '<div class="etag">תשלום '+g.next+' מתוך '+g.total+' · נותרו '+g.left+'</div></div>'+
        '<div class="eside"><div class="eamt">'+fmt(g.sum)+'</div><div class="edate">נותר לשלם</div></div></div>';});
    h+='</div>';
  }
  return h;
}
function brandName(b){return{visa:'ויזה',mastercard:'מאסטרקארד',amex:'אמריקן אקספרס',isracard:'ישראכרט',diners:'דיינרס'}[b]||'אשראי';}
function cardDetail(id){
  const c=CALC.card(id),cy=CALC.cycle(id);
  const txs=DB.transactions.filter(x=>x.cardId===id).sort((a,b)=>b.chargeDate<a.chargeDate?-1:1);
  const groups={};txs.forEach(x=>{(groups[ym(x.chargeDate)]=groups[ym(x.chargeDate)]||[]).push(x);});
  let h='<div class="note" style="margin-bottom:16px">חיוב קרוב: <b>'+fmt(cy.nextAmount)+'</b>'+(cy.nextDate?' ב-'+dLabel(cy.nextDate):'')+' · צבירה פתוחה: <b>'+fmt(cy.open)+'</b></div>';
  const ks=Object.keys(groups).sort().reverse();
  if(!ks.length)h+='<div class="empty"><b>אין עסקאות בכרטיס</b></div>';
  ks.forEach(k=>{
    const sum=groups[k].reduce((s,x)=>s+x.amount,0);
    h+='<div class="stitle" style="margin-top:18px;font-size:13px">חיוב '+ymLabel(k)+'<span class="sright">'+fmt(sum)+'</span></div>';
    h+=groups[k].map(txRow).join('');
  });
  sheet(c.name,h);
}

/* ---------- EXPENSES ---------- */
