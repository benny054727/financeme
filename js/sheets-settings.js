function openSettings(){
  sheet('הגדרות',
   '<div class="eitem tap" onclick="openAccountSettings()"><div class="eico">👤</div><div class="einfo"><div class="ename">חשבון</div>'+
     '<div class="etag">מחובר כ-'+esc(CURRENT_USER?CURRENT_USER.email:'')+'</div></div></div>'+
   '<div class="eitem tap" onclick="openFinancialSettings()"><div class="eico">🎯</div><div class="einfo"><div class="ename">מדיניות פיננסית</div>'+
     '<div class="etag">כרית ביטחון · מסגרת · יעד הוצאות</div></div></div>'+
   '<div class="eitem tap" onclick="openLoanSettings()"><div class="eico">🏦</div><div class="einfo"><div class="ename">הלוואות וריבית</div>'+
     '<div class="etag">ריבית בנק ישראל · כלול ביתרה הזמינה</div></div></div>'+
   '<div class="eitem tap" onclick="openCats()"><div class="eico">🏷️</div><div class="einfo"><div class="ename">קטגוריות ותקציבים</div>'+
     '<div class="etag">'+DB.categories.length+' קטגוריות מוגדרות</div></div></div>'+
   '<div class="eitem tap" onclick="openCardSettings()"><div class="eico">💳</div><div class="einfo"><div class="ename">כרטיסי אשראי</div>'+
     '<div class="etag">'+(DB.cards.length?DB.cards.length+' כרטיסים':'לא הוגדרו כרטיסים')+'</div></div></div>'+
   '<div class="eitem tap" onclick="openBackupSettings()"><div class="eico">💾</div><div class="einfo"><div class="ename">גיבוי ואזור מסוכן</div>'+
     '<div class="etag">ייצוא/ייבוא · איפוס הכל</div></div></div>');
}
function openAccountSettings(){
  // שם פרטי/משפחה נשמרים ב-user_metadata של Supabase Auth (לא ב-DB.settings) —
  // זה מידע על החשבון עצמו (מסונכרן אוטומטית לכל מכשיר עם ההתחברות, לא צריך
  // לעבור גם דרך financeme_state בענן בנפרד)
  const meta=(CURRENT_USER&&CURRENT_USER.user_metadata)||{};
  sheet('חשבון',
   '<div class="note" style="margin-bottom:18px">מחובר כ-'+esc(CURRENT_USER?CURRENT_USER.email:'')+' · הנתונים מסונכרנים לענן ונגישים מכל מכשיר.</div>'+
   '<div class="row2"><div class="fld"><label for="acFirst">שם פרטי</label><input id="acFirst" type="text" value="'+esc(meta.first_name||'')+'"/></div>'+
   '<div class="fld"><label for="acLast">שם משפחה</label><input id="acLast" type="text" value="'+esc(meta.last_name||'')+'"/></div></div>'+
   '<button class="btn sec" onclick="saveAccountName()">שמור שם</button>'+
   '<div class="stitle" style="margin-top:24px"><span>🔒</span> שינוי סיסמה</div>'+
   '<div class="fld"><label for="acPw1">סיסמה חדשה</label><input id="acPw1" type="password" autocomplete="new-password" placeholder="לפחות 8 תווים"/></div>'+
   '<div class="fld"><label for="acPw2">אימות סיסמה חדשה</label><input id="acPw2" type="password" autocomplete="new-password"/></div>'+
   '<button class="btn sec" onclick="changePassword()">עדכן סיסמה</button>'+
   '<div class="hint" style="margin-top:16px">חושד שמישהו אחר מחובר לחשבון שלך? זה מבטל את כל הסשנים הפעילים בכל המכשירים — כולם יצטרכו להתחבר מחדש עם הסיסמה.</div>'+
   '<button class="btn sec" style="margin-top:8px" onclick="doSignOutAll()">התנתק מכל המכשירים</button>'+
   '<button class="btn sec" style="margin-top:22px" onclick="doSignOut()">התנתק</button>',null,'openSettings');
}
async function saveAccountName(){
  const first=el('acFirst').value.trim(),last=el('acLast').value.trim();
  const {data,error}=await sb.auth.updateUser({data:{first_name:first,last_name:last}});
  if(error)return toast('שגיאה בשמירת השם: '+error.message);
  if(data&&data.user)CURRENT_USER=data.user;
  toast('השם נשמר');render();
}
async function changePassword(){
  const p1=el('acPw1').value,p2=el('acPw2').value;
  if(!p1||p1.length<8)return toast('הסיסמה חייבת להיות לפחות 8 תווים');
  if(p1!==p2)return toast('הסיסמאות לא תואמות');
  const {error}=await sb.auth.updateUser({password:p1});
  if(error)return toast('שגיאה בעדכון סיסמה: '+error.message);
  el('acPw1').value='';el('acPw2').value='';
  toast('הסיסמה עודכנה ✓');
}
function openFinancialSettings(){
  const S=DB.settings;
  sheet('מדיניות פיננסית',
   '<div class="fld"><label for="stBuf">כרית ביטחון — סכום שלא לרדת מתחתיו</label><input id="stBuf" type="number" value="'+S.safetyBuffer+'"/></div>'+
   '<div class="fld"><label for="stOd">מסגרת אשראי בעו"ש</label><input id="stOd" type="number" value="'+S.overdraftLimit+'"/></div>'+
   '<div class="fld"><label for="stTarget">יעד הוצאות חודשי (0 = בלי יעד)</label><input id="stTarget" type="number" value="'+(S.monthlyExpenseTarget||0)+'"/><div class="hint">סכום ההוצאות הכולל שאתה שואף לא לחרוג ממנו — קבועות, משתנות, הלוואות וחיסכון ביחד</div></div>'+
   '<button class="btn" onclick="saveFinancialSettings()">שמור</button>',null,'openSettings');
}
function saveFinancialSettings(){
  DB.settings.safetyBuffer=+el('stBuf').value||0;
  DB.settings.overdraftLimit=+el('stOd').value||0;
  DB.settings.monthlyExpenseTarget=+el('stTarget').value||0;
  save();closeSheet();render();toast('נשמר');
}
function openLoanSettings(){
  const S=DB.settings;
  sheet('הלוואות וריבית',
   '<div class="fld"><label for="stBoi">ריבית בנק ישראל הנוכחית (%)</label><input id="stBoi" type="number" step="0.01" value="'+(S.boiRate||0)+'"/><div class="hint">משמשת לחישוב כל מסלולי הפריים בהלוואות. עדכן ידנית כשבנק ישראל משנה את הריבית — למערכת אין גישה לאינטרנט.'+(S.boiRateUpdated?' עודכן לאחרונה: '+dLabel(S.boiRateUpdated)+'.':'')+'</div></div>'+
   '<div class="fld"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input id="stLoanBal" type="checkbox" style="width:auto" '+(S.loansAffectBalance?'checked':'')+'/> כלול תשלומי הלוואות ביתרה הזמינה ובתחזית</label><div class="hint">כשמסומן, תשלום כל הלוואה (לפי "יום חיוב" ואמצעי התשלום שהגדרת לה — עו"ש או כרטיס אשראי) נרשם אוטומטית כתנועה אמיתית כל חודש, בדיוק כמו הוראת קבע — מופיע ב"תנועות שכבר ירדו"/"חיובים והכנסות צפויים" ונספר בתחזית וב"יתרה זמינה". בטל אם אתה כבר עוקב אחרי אותו חיוב בנפרד כהוראת קבע, כדי לא לספור פעמיים.</div></div>'+
   '<button class="btn" onclick="saveLoanSettings()">שמור</button>',null,'openSettings');
}
function saveLoanSettings(){
  const newBoi=+el('stBoi').value||0;
  if(newBoi!==DB.settings.boiRate)DB.settings.boiRateUpdated=iso(today());
  DB.settings.boiRate=newBoi;
  DB.settings.loansAffectBalance=el('stLoanBal').checked;
  save();genLoanPayments();closeSheet();render();toast('נשמר');
}
function openCardSettings(){
  sheet('כרטיסי אשראי',
   '<div id="stCards"></div>'+
   '<button class="addrow" onclick="addCardRow()">+ הוסף כרטיס</button>'+
   '<button class="btn" onclick="saveCards()">שמור</button>',
   drawCardRows,'openSettings');
}
function saveCards(){
  DB.cards=tmpCards.filter(c=>c.name.trim());
  DB.transactions.forEach(x=>{if(x.cardId&&!CALC.card(x.cardId))x.cardId=null;});
  save();closeSheet();render();toast('נשמר');
}
function openBackupSettings(){
  sheet('גיבוי ואזור מסוכן',
   '<div class="note" style="margin-bottom:12px">הנתונים מסונכרנים לענן אוטומטית, אבל עדיין כדאי לייצא גיבוי מקומי מדי פעם — רשת שלא זמינה זמנית לא תמחק כלום (יש מטמון מקומי), אבל גיבוי מקובץ הוא רשת ביטחון נוספת.</div>'+
   // אזהרה לפני ייצוא: הקובץ המורד הוא JSON גלוי (לא מוצפן) עם כל המצב הפיננסי —
   // תנועות, יתרות, הלוואות. חייבים לומר את זה לפני שהמשתמש מפיץ אותו בטעות
   // (מייל, Drive משותף וכו').
   '<div class="note" style="margin-bottom:12px;color:var(--crit)">⚠️ קובץ הגיבוי מכיל את כל המידע הפיננסי שלך בטקסט גלוי, בלי הצפנה — שמור אותו רק במקום מאובטח (לא במייל או בתיקייה משותפת).</div>'+
   '<div class="btnrow" style="margin-bottom:22px"><button class="btn sec" onclick="exportDB()">ייצא קובץ</button>'+
   '<button class="btn sec" onclick="el(\'impF\').click()">ייבא קובץ</button></div>'+
   '<input type="file" id="impF" accept=".json" style="display:none" onchange="importDB(this)"/>'+
   '<div class="dangerzone"><div class="dztitle">⚠️ אזור מסוכן</div>'+
   '<div class="note" style="margin-bottom:12px">איפוס ימחק את כל הנתונים המקומיים במכשיר הזה — תנועות, קטגוריות, הלוואות, יעדים וכל ההגדרות. הנתונים בענן (אם מחוברים) לא נמחקים — תתחבר שוב כדי לשחזר אותם.</div>'+
   '<button class="btn dgr" onclick="resetAll()">אפס נתונים מקומיים</button>'+
   '<div class="note" style="margin:16px 0 12px">כדי למחוק את הנתונים גם מהענן — מכל המכשירים, לצמיתות — ולהתנתק:</div>'+
   '<button class="btn dgr" onclick="deleteCloudData()">מחק את כל הנתונים מהענן</button></div>',null,'openSettings');
}
function drawCardRows(){
  tmpCards=JSON.parse(JSON.stringify(DB.cards));
  paintCardRows();
}
let tmpCards=[];
function paintCardRows(){
  const c=el('stCards');if(!c)return;
  c.innerHTML=tmpCards.map((x,i)=>
   '<div class="cardrow"><div class="crh"><span>כרטיס '+(i+1)+'</span><button class="delx" onclick="rmCard('+i+')" aria-label="מחק כרטיס">✕</button></div>'+
   '<div class="fld"><input placeholder="שם הכרטיס" aria-label="שם הכרטיס" value="'+esc(x.name)+'" oninput="tmpCards['+i+'].name=this.value"/></div>'+
   '<div class="row2"><div class="fld"><select aria-label="חברת האשראי" onchange="tmpCards['+i+'].brand=this.value">'+
     ['visa','mastercard','amex','isracard','diners'].map(b=>'<option value="'+b+'" '+(x.brand===b?'selected':'')+'>'+brandName(b)+'</option>').join('')+'</select></div>'+
   '<div class="fld"><input placeholder="4 ספרות" aria-label="4 ספרות אחרונות" maxlength="4" value="'+esc(x.last4)+'" oninput="tmpCards['+i+'].last4=this.value"/></div></div>'+
   '<div class="row2"><div class="fld"><label for="cardChargeDay'+i+'">יום חיוב</label><input id="cardChargeDay'+i+'" type="number" min="1" max="31" value="'+x.chargeDay+'" oninput="tmpCards['+i+'].chargeDay=+this.value"/><div class="hint">היום בחודש שהחיוב יורד בפועל מהעו"ש</div></div>'+
   '<div class="fld"><label for="cardCutoff'+i+'">יום חיתוך</label><input id="cardCutoff'+i+'" type="number" min="1" max="31" value="'+x.cutoffDay+'" oninput="tmpCards['+i+'].cutoffDay=+this.value"/><div class="hint">עסקאות עד היום הזה נכנסות לחיוב הקרוב</div></div></div>'+
   '<div class="fld"><label for="cardLimit'+i+'">מסגרת</label><input id="cardLimit'+i+'" type="number" value="'+x.limit+'" oninput="tmpCards['+i+'].limit=+this.value"/></div></div>').join('');
}
function addCardRow(){const cl=['#6366f1','#f59e0b','#10b981','#06b6d4'];
  tmpCards.push({id:uid('card'),name:'',brand:'visa',last4:'',color:cl[tmpCards.length%4],chargeDay:10,cutoffDay:25,limit:0,active:true});paintCardRows();}
function rmCard(i){tmpCards.splice(i,1);paintCardRows();}
function saveSettings(){
  DB.settings.safetyBuffer=+el('stBuf').value||0;
  DB.settings.overdraftLimit=+el('stOd').value||0;
  DB.settings.monthlyExpenseTarget=+el('stTarget').value||0;
  const newBoi=+el('stBoi').value||0;
  if(newBoi!==DB.settings.boiRate)DB.settings.boiRateUpdated=iso(today());
  DB.settings.boiRate=newBoi;
  DB.settings.loansAffectBalance=el('stLoanBal').checked;
  DB.cards=tmpCards.filter(c=>c.name.trim());
  DB.transactions.forEach(x=>{if(x.cardId&&!CALC.card(x.cardId))x.cardId=null;});
  save();closeSheet();render();toast('נשמר');
}
function exportDB(){
  DB.meta.lastBackup=iso(today());save();
  const b=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='financeme-'+iso(today())+'.json';a.click();toast('הגיבוי הורד');
}
function importDB(inp){
  const f=inp.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=e=>{try{const d=JSON.parse(e.target.result);if(!d.version)throw 0;
    DB=Object.assign(blank(),d);save();closeSheet();render();toast('הנתונים יובאו');}catch(err){toast('קובץ לא תקין');}};
  r.readAsText(f);
}
function resetAll(){
  if(!confirm('פעולה זו תמחק את כל הנתונים המקומיים במכשיר הזה לצמיתות (הענן לא נפגע — אם אתה מחובר, יימשך שחזור ממנו ברענון הבא). ודא שייצאת גיבוי אם אתה לא מחובר לענן.'))return;
  if(!confirm('בטוח? אין דרך חזרה.'))return;
  localStorage.removeItem(KEY);location.reload();
}
// מוחק את שורת הנתונים בענן (Supabase) של המשתמש המחובר + מתנתק + מנקה מקומי.
// חשוב: זה מוחק את *הנתונים הפיננסיים*, לא את חשבון ה-Auth (מייל+סיסמה) עצמו —
// מחיקת המשתמש מ-Supabase Auth דורשת service-role key בצד שרת, ולא ניתן לבצע
// אותה בבטחה מקוד צד-לקוח (זה היה חור אבטחה חמור: כל משתמש היה יכול למחוק כל
// חשבון). למחיקה מלאה של חשבון ה-Auth יש לפנות למפתח.
async function deleteCloudData(){
  if(!confirm('פעולה זו תמחק את כל הנתונים הפיננסיים שלך מהענן לצמיתות — מכל המכשירים המחוברים לאותו חשבון. הנתונים המקומיים במכשיר הזה יימחקו גם הם, ותנותק. אין דרך לשחזר.'))return;
  if(!confirm('בטוח לגמרי? זו הפעולה הכי בלתי-הפיכה באפליקציה.'))return;
  try{
    if(CURRENT_USER)await sb.from('financeme_state').delete().eq('user_id',CURRENT_USER.id);
  }catch(e){toast('שגיאה במחיקה מהענן — נסה שוב או פנה למפתח');return;}
  try{await sb.auth.signOut();}catch(e){}
  try{localStorage.removeItem(KEY);}catch(e){}
  location.reload();
}

