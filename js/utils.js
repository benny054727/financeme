/* ============================================================
   2. עזרי תאריך ומספר
   ============================================================ */
const MON=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const DOW=['יום ראשון','יום שני','יום שלישי','יום רביעי','יום חמישי','יום שישי','יום שבת'];
function todayLabel(){const d=today();return DOW[d.getDay()]+', '+d.getDate()+' ב'+MON[d.getMonth()]+' '+d.getFullYear();}
const MON_S=['ינו׳','פבר׳','מרץ','אפר׳','מאי','יוני','יולי','אוג׳','ספט׳','אוק׳','נוב׳','דצמ׳'];
function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function pd(s){const p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2]);}
function today(){const d=new Date();d.setHours(0,0,0,0);return d;}
function ym(s){return s.slice(0,7);}
function curYM(){return iso(today()).slice(0,7);}
function ymLabel(y){const p=y.split('-');return MON[+p[1]-1]+' '+p[0];}
function ymShort(y){return MON_S[+y.split('-')[1]-1];}
function addM(y,n){const p=y.split('-');const d=new Date(+p[0],+p[1]-1+n,1);return iso(d).slice(0,7);}
function monthsBetweenYM(a,b){const ap=a.slice(0,7).split('-'),bp=b.slice(0,7).split('-');return (+bp[0]-+ap[0])*12+(+bp[1]-+ap[1]);}
function daysIn(y){const p=y.split('-');return new Date(+p[0],+p[1],0).getDate();}
function dayIn(y,day){return y+'-'+String(Math.min(day,daysIn(y))).padStart(2,'0');}
function fmt(n){return '₪'+Math.round(n).toLocaleString('he-IL');}
function fmtS(n){return (n<0?'-':'')+'₪'+Math.abs(Math.round(n)).toLocaleString('he-IL');}
function dLabel(s){const d=pd(s);return d.getDate()+'/'+(d.getMonth()+1);}

