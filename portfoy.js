/* ============================================================
   Borsa Pano — "Yatırımlarım" modülü v4 (harici dosya)
   Yenilikler (v4):
   - Her işlem (AL/SAT) tek tek EDİT/SİL edilebilir (varlık sayfasında ✎ / 🗑).
   - Döviz varlığına HESAP ADI eklendi. Birleşme anahtarı = hesap adı + döviz.
     (ör. "Almanya EUR" ile "TR EUR" ayrı satırlarda durur.)
   - AL/SAT ekranındaki kaydet butonu, yöne göre "AL" ya da "SAT" yazar.
   - Satışta alışa özel ifadeler ("ödedin/aldın") satışa uygun hale getirildi.
   - Tarih seçilince o güne ait öneri fiyat gelir (hisse: kapanış, döviz: o günkü kur,
     altın: güncel gram fiyatının o günkü kura göre karşılığı); sen istersen değiştirirsin.
   index.html'e tek <script src="portfoy.js"></script> ile bağlanır (köprü: B).
   ============================================================ */
(function(){
"use strict";
var B=null, ready=false;
var VIEW={mode:'list', id:null};

window.PF_INIT=function(bridge){ if(ready) return; B=bridge; ready=true; injectCSS(); injectDOM(); wire(); };
if(window.__PF_BRIDGE) window.PF_INIT(window.__PF_BRIDGE);
window.PF={ render:function(){ if(ready) pfRender(); }, ready:function(){ return ready; } };

/* --- kısayollar --- */
function $(id){ return B.$(id); }
function fmt(n,d){ return B.fmt(n,d); }
function clean(s){ return B.clean(s); }
function pnlCls(v){ return B.pnlCls(v); }
function ccyCode(m){ return B.ccyCode(m); }
function find(s){ return B.find(s); }
function save(){ B.save(); }
function genId(){ return B.genId(); }
function dlg(t,b,btns){ return B.dlg(t,b,btns); }
function dlgClose(){ return B.dlgClose(); }
function RATES(){ return B.RATES||{}; }
function STOCKS(){ return B.STOCKS||[]; }

/* --- stil --- */
function injectCSS(){
  if(document.getElementById('pfStyle')) return;
  var css=''+
  '.pfhead{display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; margin-bottom:14px}'+
  '.pfcur{display:flex; gap:4px; background:var(--bg); border:1px solid var(--line); border-radius:999px; padding:3px}'+
  '.pfcur button{border:none; background:transparent; padding:6px 14px; border-radius:999px; font-weight:700; font-size:13px; color:var(--dim); cursor:pointer}'+
  '.pfcur button.on{background:var(--brand); color:#fff}'+
  '.pfquick{display:flex; gap:8px; flex-wrap:wrap; align-items:center; background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:10px 12px; margin:8px 0 16px}'+
  '.pfquick input.search{flex:1; min-width:150px; background:var(--surface)}'+
  '.pftypes{display:flex; gap:5px; flex-wrap:wrap; margin:8px 0 10px}'+
  '.pftypes button{border:1px solid var(--line); background:var(--surface); color:var(--dim); font-weight:700; font-size:12.5px; padding:7px 13px; border-radius:999px; cursor:pointer}'+
  '.pftypes button.on{background:var(--brand); color:#fff; border-color:var(--brand)}'+
  '.pfbadge{font-size:10px; padding:2px 7px; border-radius:6px; font-weight:700; background:var(--line2); color:var(--dim); vertical-align:middle}'+
  '#v-portfolio tbody tr{cursor:pointer}'+
  '.pfarrow{color:var(--faint); font-weight:700}'+
  '.pftxE,.pftxD{border:none; background:transparent; cursor:pointer; font-size:12.5px; padding:2px 5px; margin-left:2px; opacity:.65; border-radius:6px}'+
  '.pftxE:hover,.pftxD:hover{opacity:1; background:var(--line2)}'+
  '.log .e .t{white-space:nowrap}'+
  '.pfchart{position:relative}'+
  '.pfchart .pfdot{cursor:pointer}'+
  '.pftip{position:absolute; z-index:20; background:var(--surface); border:1px solid var(--line); font-size:12px; padding:6px 9px; border-radius:8px; pointer-events:none; box-shadow:0 6px 18px rgba(0,0,0,.20); max-width:240px; line-height:1.35}';
  var st=document.createElement('style'); st.id='pfStyle'; st.textContent=css; document.head.appendChild(st);
}

/* --- DOM enjeksiyonu --- */
function injectDOM(){
  if(!$('pfOpen')){ var sw=$('mktSwitch');
    if(sw){ var b=document.createElement('button'); b.id='pfOpen'; b.className='ghost accent'; b.style.fontWeight='700'; b.textContent='🧭 Yatırımlarım';
      sw.parentNode.insertBefore(b, sw.nextSibling); } }
  if(!document.querySelector('.tab[data-v="portfolio"]')){ var nav=$('nav');
    if(nav){ var t=document.createElement('button'); t.className='tab'; t.dataset.v='portfolio'; t.title='Yatırımlarım'; t.textContent='Yatırımlarım'; nav.appendChild(t); } }
  if(!$('v-portfolio')){ var main=document.querySelector('main');
    if(main){ var sec=document.createElement('section'); sec.className='view card'; sec.id='v-portfolio'; sec.innerHTML='<div id="pfBody"></div>'; main.appendChild(sec); } }
  hideRealPortfolio();
}
/* Gerçek Portföy sekmesini ve simülatördeki "gerçeğe aktar" butonlarını gizle */
function hideRealPortfolio(){
  var tab=document.querySelector('.tab[data-v="real"]'); if(tab) tab.style.display='none';
  var s2r=$('simToReal'); if(s2r) s2r.style.display='none';
  if(!document.getElementById('pfHideCss')){
    var st=document.createElement('style'); st.id='pfHideCss';
    st.textContent='.tab[data-v="real"]{display:none!important} #simToReal{display:none!important} [data-real]{display:none!important}';
    document.head.appendChild(st);
  }
  var rv=$('v-real'); if(rv && rv.classList.contains('active') && B && B.goView) B.goView('all');
}
function pfShow(){ pfUnlocked=false; VIEW={mode:'list',id:null}; B.goView('portfolio'); pfRender(); }
function wire(){ var o=$('pfOpen'); if(o) o.onclick=pfShow; var t=document.querySelector('.tab[data-v="portfolio"]'); if(t) t.onclick=pfShow; pf(); }

/* --- veri modeli --- */
var PF_TYPES=[{k:'stock',t:'Hisse'},{k:'deposit',t:'Mevduat'},{k:'fund',t:'Yatırım Fonu'},
  {k:'gold',t:'Altın'},{k:'fx',t:'Döviz'},{k:'crypto',t:'Kripto'},{k:'other',t:'Diğer'}];
function pfTypeLabel(k){ for(var i=0;i<PF_TYPES.length;i++) if(PF_TYPES[i].k===k) return PF_TYPES[i].t; return k; }
function pf(){ var S=B.S;
  if(!S.pf) S.pf={disp:'TRY',assets:{},snaps:[],hist:{ccy:'TRY',points:[],rates:[]}};
  var p=S.pf; if(!p.assets)p.assets={}; if(!p.snaps)p.snaps=[]; if(!p.hist)p.hist={ccy:'TRY',points:[],rates:[]}; if(!p.disp)p.disp='TRY'; return p; }
function pcy(){ return pf().disp; }
function psymCcy(c){ return c==='TRY'?'₺':c==='USD'?'$':'€'; }
function psym(){ return psymCcy(pcy()); }
function pf$(v){ return v==null?'—':psym()+fmt(v); }
function goldGramTRY(){ var g=RATES().goldGramTRY; return (g!=null&&!isNaN(g))?g:null; }

/* güncel kur çevirileri */
function toTRY(v,c){ var R=RATES(); if(v==null)return null; if(c==='TRY')return v; if(c==='EUR')return R.EURTRY?v*R.EURTRY:null; if(c==='USD')return R.USDTRY?v*R.USDTRY:null; return v; }
function frTRY(v,c){ var R=RATES(); if(v==null)return null; if(c==='TRY')return v; if(c==='EUR')return R.EURTRY?v/R.EURTRY:null; if(c==='USD')return R.USDTRY?v/R.USDTRY:null; return v; }
function pfConv(v,from,to){ return frTRY(toTRY(v,from),to); }

/* tarihsel kur (rates.js: window.RATE_HISTORY = [[epochSec,usdtry,eurtry],...] artan) */
var RATEHIST=null, ratesTried=false, ratesLoading=false;
function ratesReady(){ return !!(RATEHIST && RATEHIST.length); }
function pfLoadRates(cb){ if(ratesReady()){ if(cb)cb(true); return; }
  if(window.RATE_HISTORY){ RATEHIST=window.RATE_HISTORY; if(cb)cb(true); return; }
  if(ratesTried){ if(cb)cb(false); return; }
  if(ratesLoading){ setTimeout(function(){pfLoadRates(cb);},250); return; }
  ratesLoading=true;
  var s=document.createElement('script');
  s.src='rates.js'+((location.protocol.indexOf('http')===0)?('?t='+Math.floor(Date.now()/3600000)):'');
  s.onload=function(){ RATEHIST=window.RATE_HISTORY||null; ratesLoading=false; ratesTried=true; if(cb)cb(ratesReady()); if(s.parentNode)s.parentNode.removeChild(s); };
  s.onerror=function(){ ratesLoading=false; ratesTried=true; if(cb)cb(false); if(s.parentNode)s.parentNode.removeChild(s); };
  document.head.appendChild(s);
}
function pfRateAt(tsec){ if(!ratesReady()) return null; var R=RATEHIST, lo=0, hi=R.length-1, best=R[0];
  if(tsec<=R[0][0]) best=R[0]; else if(tsec>=R[hi][0]) best=R[hi];
  else { while(lo<=hi){ var m=(lo+hi)>>1; if(R[m][0]<=tsec){ best=R[m]; lo=m+1; } else hi=m-1; } }
  return {usdtry:best[1], eurtry:best[2]}; }
function pfRateAtDate(dateStr){ var t=Date.parse(dateStr+'T12:00:00Z'); if(isNaN(t)) return null; return pfRateAt(Math.floor(t/1000)); }
function convAtRate(v,from,to,r){ if(v==null||!r) return null;
  var tryv = from==='TRY'?v : from==='USD'?v*r.usdtry : v*r.eurtry;
  return to==='TRY'?tryv : to==='USD'?tryv/r.usdtry : tryv/r.eurtry; }
function convAtTime(v,from,to,tsec){ if(from===to) return v; var r=pfRateAt(tsec); if(r) return convAtRate(v,from,to,r); return pfConv(v,from,to); }

/* --- öneri fiyat yardımcıları (tarihe göre) --- */
/* 1 hold biriminin, pay biriminde o günkü değeri */
function pfFxRateSuggest(hold, pay, dateStr){
  if(hold===pay) return 1;
  var r=pfRateAtDate(dateStr); if(!r) return null;
  var holdTRY = hold==='TRY'?1 : hold==='USD'?r.usdtry : r.eurtry;
  var payTRY  = pay==='TRY'?1  : pay==='USD'?r.usdtry  : r.eurtry;
  if(!payTRY) return null;
  return holdTRY/payTRY;
}
/* güncel gram altının, pay biriminde o günkü kura göre karşılığı (gram fiyatı tarihsel değil, güncel!) */
function pfGoldPxSuggest(pay, dateStr){
  var g=goldGramTRY(); if(g==null) return null;
  if(pay==='TRY') return g;
  var r=pfRateAtDate(dateStr); if(!r) return null;
  return pay==='USD' ? g/r.usdtry : g/r.eurtry;
}
/* hisse: verilen tarihe en yakın (<=) kapanış */
function pfStockClose(sym, dateStr){
  var H=B.HIST; if(!H||!sym||!H[sym]||!H[sym].d||!H[sym].d.length) return null;
  var t=Date.parse(dateStr+'T12:00:00Z'); if(isNaN(t)) return null; var ts=Math.floor(t/1000);
  var d=H[sym].d, best=null;
  for(var i=0;i<d.length;i++){ if(d[i][0]<=ts) best=d[i]; else break; }
  if(!best) best=d[0];
  return best?best[4]:null;
}

/* --- varlık hesap motoru --- */
function aNativeCcy(a){ if(a.type==='stock') return a.ccy||ccyCode(a.market||'BIST'); if(a.type==='gold') return 'TRY'; if(a.type==='fx') return a.holdCcy||'EUR'; return a.ccy||'TRY'; }
function aUnitName(a){ if(a.type==='gold') return 'gram'; if(a.type==='fx') return a.holdCcy||''; return 'adet'; }
function txPay(a,t){ return t.payCcy || aNativeCcy(a); }
function aQty(a){ if(a.valMode==='amount') return null; var q=0; (a.tx||[]).forEach(function(t){ q+=(t.side==='sell'?-1:1)*t.qty; }); return q; }
function aUnitTRYnow(a){
  if(a.type==='stock'){ var s=a.symbol?find(a.symbol):null, nc=aNativeCcy(a);
    if(s&&s.price!=null) return toTRY(s.price, nc);
    if(a.curUnit!=null) return toTRY(a.curUnit, nc);
    return null; }
  if(a.type==='gold'){ return goldGramTRY(); }
  if(a.type==='fx'){ return toTRY(1, a.holdCcy||'EUR'); }
  return a.curUnit!=null?toTRY(a.curUnit, a.ccy||'TRY'):null;
}
function aValueTRY(a){
  if(a.valMode==='amount'){ return a.curValue!=null?toTRY(a.curValue, a.ccy||'TRY'):null; }
  var q=aQty(a); if(q==null) return null; var u=aUnitTRYnow(a); return u==null?null:q*u;
}
function aValueDisp(a){ var v=aValueTRY(a); return v==null?null:frTRY(v,pcy()); }
function aValueIn(a,dc){ var v=aValueTRY(a); return v==null?null:frTRY(v,dc); }
function aValueNative(a){ var v=aValueTRY(a); return v==null?null:frTRY(v,aNativeCcy(a)); }
function aCurUnitDisp(a){
  if(a.valMode==='amount') return null;
  if(a.type==='stock'){ var s=a.symbol?find(a.symbol):null, nc=aNativeCcy(a);
    if(s&&s.price!=null) return pfConv(s.price, nc, pcy());
    if(a.curUnit!=null) return pfConv(a.curUnit, nc, pcy());
    return null; }
  if(a.type==='gold'){ var g=goldGramTRY(); return g==null?null:frTRY(g,pcy()); }
  if(a.type==='fx'){ return pfConv(1, a.holdCcy||'EUR', pcy()); }
  return a.curUnit!=null?pfConv(a.curUnit, a.ccy||'TRY', pcy()):null;
}
function aCurUnitIn(a,dc){
  if(a.valMode==='amount') return null;
  if(a.type==='stock'){ var s=a.symbol?find(a.symbol):null, nc=aNativeCcy(a);
    if(s&&s.price!=null) return pfConv(s.price, nc, dc);
    if(a.curUnit!=null) return pfConv(a.curUnit, nc, dc);
    return null; }
  if(a.type==='gold'){ var g=goldGramTRY(); return g==null?null:frTRY(g,dc); }
  if(a.type==='fx'){ return pfConv(1, a.holdCcy||'EUR', dc); }
  return a.curUnit!=null?pfConv(a.curUnit, a.ccy||'TRY', dc):null;
}
function aRemCost(a, disp){
  if(a.valMode==='amount'){ return {qty:null, cost:(a.cost!=null?pfConv(a.cost, a.ccy||'TRY', disp):null)}; }
  var q=0, cost=0;
  (a.tx||[]).slice().sort(function(x,y){return x.t-y.t;}).forEach(function(t){
    var pay=txPay(a,t), line=convAtTime(t.px*t.qty, pay, disp, Math.floor(t.t/1000));
    if(line==null) line=pfConv(t.px*t.qty, pay, disp);
    if(t.side==='sell'){ if(q>0){ var s=Math.min(t.qty,q), avg=cost/q; cost-=avg*s; q-=s; } }
    else { q+=t.qty; cost+=line; }
  });
  return {qty:q, cost:q>0?cost:0};
}
function aCostDisp(a){ return aRemCost(a,pcy()).cost; }
function aAvgCostDisp(a){ var r=aRemCost(a,pcy()); return (r.qty!=null&&r.qty>0)?r.cost/r.qty:null; }
function aRealizedIn(a, disp){ if(a.valMode==='amount') return 0; var q=0, cost=0, real=0;
  (a.tx||[]).slice().sort(function(x,y){return x.t-y.t;}).forEach(function(t){
    var pay=txPay(a,t), line=convAtTime(t.px*t.qty, pay, disp, Math.floor(t.t/1000)); if(line==null) line=pfConv(t.px*t.qty, pay, disp);
    if(t.side==='sell'){ if(q>0){ var s=Math.min(t.qty,q), avg=cost/q; real+=line-avg*s; cost-=avg*s; q-=s; } }
    else { q+=t.qty; cost+=line; }
  });
  return real; }
function aRealizedDisp(a){ return aRealizedIn(a, pcy()); }

function pfTotals(){ var val=0,cost=0,has=false;
  Object.keys(pf().assets).forEach(function(id){ var a=pf().assets[id]; var v=aValueDisp(a); if(v!=null){val+=v;has=true;} var c=aCostDisp(a); if(c!=null)cost+=c; });
  return {value:has?val:null, cost:cost, pnl:has?val-cost:null}; }
function pfSnapVals(){ var o={TRY:0,USD:0,EUR:0},has=false;
  Object.keys(pf().assets).forEach(function(id){ var vt=aValueTRY(pf().assets[id]); if(vt==null)return; has=true;
    o.TRY+=vt; o.USD+=(frTRY(vt,'USD')||0); o.EUR+=(frTRY(vt,'EUR')||0); });
  return has?o:null; }
function pfSaveDay(){ var v=pfSnapVals(); if(!v){ dlg('Kayıt yok','<p>Önce en az bir varlık ekle.</p>',[{label:'Tamam',primary:true}]); return; }
  var d=new Date().toISOString().slice(0,10); pf().snaps=pf().snaps.filter(function(s){return s.date!==d;});
  pf().snaps.push({date:d,TRY:v.TRY,USD:v.USD,EUR:v.EUR}); save(); pfRender(); }
function pfHistRate(date){ var R=pf().hist.rates||[];
  if(R.length){ var best=null; R.forEach(function(r){ if(r.date<=date){ if(!best||r.date>best.date) best=r; } }); if(!best) best=R[0]; return {usdtry:best.usdtry, eurtry:best.eurtry}; }
  return pfRateAtDate(date); }
function pfConvHist(v, hc, d, date){
  if(v==null) return {v:null,warn:false};
  if(d===hc) return {v:v,warn:false};
  var r=pfHistRate(date), warn=!r;
  var tryv = hc==='TRY'?v:(hc==='USD'?(r?v*r.usdtry:pfConv(v,'USD','TRY')):(r?v*r.eurtry:pfConv(v,'EUR','TRY')));
  var out = d==='TRY'?tryv:(d==='USD'?(r?tryv/r.usdtry:pfConv(tryv,'TRY','USD')):(r?tryv/r.eurtry:pfConv(tryv,'TRY','EUR')));
  return {v:out, warn:warn};
}
function pfHasField(field){ return (pf().hist.points||[]).some(function(p){ return p[field]!=null && !isNaN(p[field]); }); }
function pfSeries(field){ field=field||'value'; var d=pcy(), map={}, notes={}, H=pf().hist, warn=false, hc=H.ccy||'TRY';
  (H.points||[]).forEach(function(p){ if(p.note) notes[p.date]=p.note; var raw=p[field]; if(raw==null||isNaN(raw)) return;
    var c=pfConvHist(raw, hc, d, p.date); if(c.warn) warn=true;
    if(c.v!=null&&!isNaN(c.v)) map[p.date]={y:c.v}; });
  if(field==='value'){ (pf().snaps||[]).forEach(function(s){ if(s[d]!=null && map[s.date]==null) map[s.date]={y:s[d]}; }); }
  var pts=Object.keys(map).sort().map(function(k){ return {y:map[k].y, label:k.slice(5), date:k, note:notes[k]||''}; });
  return {pts:pts, warn:warn}; }

/* Notlu günleri kırmızı nokta + hover ipucu ile çizen kendi SVG grafiğimiz */
function pfLineChart(pts, color, sym){
  if(!pts || !pts.length) return '';
  var W=680, H=210, PL=54, PR=14, PT=14, PB=26, n=pts.length;
  var ys=pts.map(function(p){return p.y;}), mn=Math.min.apply(null,ys), mx=Math.max.apply(null,ys);
  if(mn===mx){ var pad=Math.abs(mn)*0.05||1; mn-=pad; mx+=pad; }
  function X(i){ return PL + (n===1?(W-PL-PR)/2:(i/(n-1))*(W-PL-PR)); }
  function Y(v){ return PT + (1-(v-mn)/(mx-mn))*(H-PT-PB); }
  var line=pts.map(function(p,i){ return (i?'L':'M')+X(i).toFixed(1)+' '+Y(p.y).toFixed(1); }).join(' ');
  var grid='';
  [mn,(mn+mx)/2,mx].forEach(function(v){ var y=Y(v).toFixed(1);
    grid+='<line x1="'+PL+'" y1="'+y+'" x2="'+(W-PR)+'" y2="'+y+'" stroke="var(--line)" stroke-width="1"/>'+
      '<text x="'+(PL-6)+'" y="'+(Y(v)+3).toFixed(1)+'" text-anchor="end" font-size="10" fill="var(--faint)">'+(sym||'')+fmt(v,0)+'</text>'; });
  var xlab='';
  [0, n>2?Math.floor((n-1)/2):null, n>1?n-1:null].forEach(function(i){ if(i==null) return;
    xlab+='<text x="'+X(i).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" font-size="10" fill="var(--faint)">'+pts[i].label+'</text>'; });
  function isNote(p){ var t=(p.note||'').trim().toUpperCase(); return !!t && t!=='YOK'; }
  var dots=pts.map(function(p,i){ if(!isNote(p)) return '';
    var tip=(p.date+' · '+(sym||'')+fmt(p.y)+(p.note?(' · '+p.note):'')).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    return '<circle class="pfdot" cx="'+X(i).toFixed(1)+'" cy="'+Y(p.y).toFixed(1)+'" r="4.5" fill="#ef4444" stroke="var(--surface)" stroke-width="1.5" data-tip="'+tip+'"></circle>'; }).join('');
  return '<div class="pfchart"><svg viewBox="0 0 '+W+' '+H+'" width="100%" preserveAspectRatio="xMidYMid meet">'+
    grid+'<path d="'+line+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'+dots+xlab+
    '</svg><div class="pftip" style="display:none"></div></div>';
}
function pfWireChart(box){ var wrap=box.querySelector('.pfchart'); if(!wrap) return; var tip=wrap.querySelector('.pftip');
  wrap.querySelectorAll('.pfdot').forEach(function(c){
    c.addEventListener('mouseenter', function(){ tip.textContent=c.getAttribute('data-tip'); tip.style.display='block'; });
    c.addEventListener('mousemove', function(ev){ var r=wrap.getBoundingClientRect(); tip.style.left=(ev.clientX-r.left+12)+'px'; tip.style.top=(ev.clientY-r.top+12)+'px'; });
    c.addEventListener('mouseleave', function(){ tip.style.display='none'; });
  });
}

function pfResolve(sym){ sym=(sym||'').trim().toUpperCase(); if(!sym) return null;
  if(find(sym)) return sym; if(find(sym+'.IS')) return sym+'.IS'; if(find(sym+'.DE')) return sym+'.DE'; return null; }
function pfAssetForSymbol(sym){ var A=pf().assets; for(var id in A){ if(A[id].type==='stock' && A[id].symbol===sym) return A[id]; } return null; }
function pfAssetForName(name,type){ var A=pf().assets, n=(name||'').trim().toLowerCase();
  for(var id in A){ var a=A[id]; if(a.type===type && a.type!=='stock' && (a.name||'').trim().toLowerCase()===n) return a; } return null; }
function pfGoldAsset(){ var A=pf().assets; for(var id in A){ if(A[id].type==='gold') return A[id]; } return null; }
/* döviz birleşme anahtarı = hesap adı + döviz */
function pfFxAsset(hc, name){ var A=pf().assets, n=(name||'').trim().toLowerCase();
  for(var id in A){ var a=A[id]; if(a.type==='fx' && (a.holdCcy||'EUR')===hc && (a.name||(a.holdCcy||'EUR')).trim().toLowerCase()===n) return a; } return null; }

/* =============== RENDER =============== */
function pfRender(){ var box=$('pfBody'); if(!box) return;
  if(!pfUnlocked){ pfRenderLock(box); return; }
  if(!ratesReady() && !ratesTried) pfLoadRates(function(ok){ if(ok) pfRender(); });
  if(VIEW.mode==='asset' && pf().assets[VIEW.id]){ if(!VIEW.ccy) VIEW.ccy=pcy(); pfRenderAsset(box, pf().assets[VIEW.id]); }
  else { VIEW={mode:'list',id:null}; pfRenderList(box); } }

/* Hassas veri: her açılışta hesap şifresi sorulur (otomatik giriş yok) */
function pfRenderLock(box){
  box.innerHTML='<div class="card" style="max-width:380px; margin:44px auto; text-align:center">'+
    '<div style="font-size:34px">🔒</div>'+
    '<h2 style="margin:8px 0 4px; font-size:20px">Yatırımlarım kilitli</h2>'+
    '<div class="sub" style="margin-bottom:14px">Hassas veri. Devam etmek için hesap şifreni gir.</div>'+
    '<input class="fld" id="pfPw" type="password" placeholder="şifre" autocomplete="current-password" style="width:100%; text-align:center">'+
    '<div class="hint down" id="pfPwMsg" style="min-height:16px; margin:8px 0"></div>'+
    '<button class="go buy" id="pfPwBtn" style="width:100%; padding:11px">Kilidi aç</button></div>';
  var inp=$('pfPw'), btn=$('pfPwBtn'), msg=$('pfPwMsg');
  function submit(){ var pw=inp.value||''; if(!pw){ msg.textContent='Şifre gir.'; return; }
    btn.disabled=true; btn.textContent='kontrol ediliyor…'; msg.textContent='';
    pfVerifyPw(pw, function(ok){
      if(ok===true){ pfUnlocked=true; pfRender(); }
      else if(ok===false){ btn.disabled=false; btn.textContent='Kilidi aç'; msg.textContent='Şifre yanlış.'; inp.value=''; inp.focus(); }
      else { btn.disabled=false; btn.textContent='Kilidi aç'; msg.textContent='Şifre doğrulama bağlı değil (B.verifyPassword eksik).'; }
    });
  }
  btn.onclick=submit; inp.onkeydown=function(e){ if(e.key==='Enter') submit(); }; setTimeout(function(){ if($('pfPw')) $('pfPw').focus(); },50);
}
function pfVerifyPw(pw, cb){
  if(B && typeof B.verifyPassword==='function'){
    try{ Promise.resolve(B.verifyPassword(pw)).then(function(ok){ cb(!!ok); }).catch(function(){ cb(false); }); }
    catch(e){ cb(false); }
    return;
  }
  cb(null);
}

function pfRenderList(box){ var P=pf(), t=pfTotals(), cur=pcy();
  var curBtns=['TRY','USD','EUR'].map(function(c){ return '<button data-pc="'+c+'" class="'+(c===cur?'on':'')+'">'+psymCcy(c)+' '+c+'</button>'; }).join('');
  var stat='<div class="stat">'+
    '<div><div class="k">Toplam varlık</div><div class="v">'+pf$(t.value)+'</div></div>'+
    '<div><div class="k">Toplam maliyet</div><div class="v">'+pf$(t.cost)+'</div></div>'+
    '<div><div class="k">Toplam K/Z</div><div class="v '+pnlCls(t.pnl)+'">'+(t.pnl==null?'—':(t.pnl>0?'+':'')+pf$(t.pnl)+(t.cost>0?' ('+(t.pnl>0?'+':'')+fmt(t.pnl/t.cost*100,1)+'%)':''))+'</div></div></div>';
  var allA=Object.keys(P.assets).map(function(id){ return P.assets[id]; });
  function isClosed(a){ return a.valMode==='qty' && (a.tx&&a.tx.length) && (aQty(a)||0)<=0.0000001; }
  var rows=allA.filter(function(a){ return !isClosed(a); }).sort(function(a,b){ return (aValueDisp(b)||0)-(aValueDisp(a)||0); });
  var closed=allA.filter(isClosed).sort(function(a,b){ return (b.tx[b.tx.length-1].t)-(a.tx[a.tx.length-1].t); });
  var listHtml;
  if(!rows.length) listHtml='<div class="empty">Henüz açık varlık yok — üstten tür seç, sonra ekle.</div>';
  else {
    listHtml='<div class="scroll"><table><thead><tr><th class="l">Varlık</th><th>Adet</th><th>Ort. maliyet</th><th>Güncel</th><th title="Kendi para biriminde güncel değer">Orijinal</th><th title="'+psym()+' cinsinden değer">Değer</th><th>K/Z</th><th></th></tr></thead><tbody>'+
    rows.map(function(a){ var q=aQty(a),ac=aAvgCostDisp(a),u=aCurUnitDisp(a),v=aValueDisp(a),c=aCostDisp(a),pnl=(v!=null&&c!=null)?v-c:null,pct=(c>0&&pnl!=null)?pnl/c*100:null,nc=aNativeCcy(a),vn=aValueNative(a);
      return '<tr data-open="'+a.id+'"><td><b>'+(a.name||clean(a.symbol||'—'))+'</b>'+(a.symbol?' <span class="nm">'+clean(a.symbol)+'</span>':'')+' <span class="pfbadge">'+pfTypeLabel(a.type)+'</span><div class="nm">'+(a.note?a.note.slice(0,28):aUnitName(a))+'</div></td>'+
        '<td>'+(q==null?'—':fmt(q,q%1?4:0))+'</td>'+
        '<td>'+(ac==null?'—':psym()+fmt(ac))+'</td>'+
        '<td>'+(u==null?'—':psym()+fmt(u))+'</td>'+
        '<td><span class="nm" style="font-size:13px">'+(vn==null?'—':psymCcy(nc)+fmt(vn))+'</span></td>'+
        '<td><b>'+pf$(v)+'</b></td>'+
        '<td class="'+pnlCls(pnl)+'">'+(pnl==null?'—':(pnl>0?'+':'')+pf$(pnl)+(pct!=null?' ('+(pct>0?'+':'')+fmt(pct,1)+'%)':''))+'</td>'+
        '<td class="pfarrow">›</td></tr>'; }).join('')+'</tbody></table></div>';
  }
  var closedHtml='';
  if(closed.length){
    closedHtml='<details style="margin-top:16px"><summary style="cursor:pointer; font-weight:700; color:var(--dim); font-size:13px; padding:6px 0">Kapanmış varlıklar ('+closed.length+') — elde adet kalmadı</summary>'+
      '<div class="scroll" style="margin-top:8px"><table><thead><tr><th class="l">Varlık</th><th>Gerçekleşen K/Z</th><th>Son işlem</th><th></th></tr></thead><tbody>'+
      closed.map(function(a){ var real=aRealizedDisp(a), lt=a.tx[a.tx.length-1].t;
        return '<tr data-open="'+a.id+'"><td><b>'+(a.name||clean(a.symbol||'—'))+'</b>'+(a.symbol?' <span class="nm">'+clean(a.symbol)+'</span>':'')+' <span class="pfbadge">'+pfTypeLabel(a.type)+'</span></td>'+
          '<td class="'+pnlCls(real)+'">'+(real?((real>0?'+':'')+pf$(real)):pf$(0))+'</td>'+
          '<td class="nm">'+new Date(lt).toLocaleDateString('tr-TR')+'</td><td class="pfarrow">›</td></tr>'; }).join('')+'</tbody></table></div></details>';
  }
  var seriesDefs=[{k:'value',t:'Toplam',c:'#0bbfa6'},{k:'borsa',t:'Borsa',c:'#3b82f6'},{k:'doviz',t:'Döviz',c:'#f59e0b'},{k:'altin',t:'Altın',c:'#e0b000'}];
  var avail=seriesDefs.filter(function(sd){ return sd.k==='value' ? (pfHasField('value')||(P.snaps&&P.snaps.length)) : pfHasField(sd.k); });
  if(!avail.length) avail=[seriesDefs[0]];
  if(!avail.some(function(sd){return sd.k===pfSeriesSel;})) pfSeriesSel='value';
  var selDef=avail.filter(function(sd){return sd.k===pfSeriesSel;})[0]||avail[0];
  var ser=pfSeries(selDef.k);
  var selBtns=avail.length>1?('<div class="pfcur" id="pfSeriesSel" style="margin:0 0 10px; display:inline-flex">'+avail.map(function(sd){return '<button data-sk="'+sd.k+'" class="'+(sd.k===selDef.k?'on':'')+'">'+sd.t+'</button>';}).join('')+'</div>'):'';
  var chart=ser.pts.length?(pfLineChart(ser.pts,selDef.c,psym())+(ser.warn?'<div class="hint down" style="margin-top:6px">⚠ Bazı geçmiş noktalar tarihsel kur olmadığı için güncel kurla çevrildi.</div>':'')):'<div class="empty">Grafik için "Günü kaydet" ya da geçmiş yükle.</div>';
  var notesArr=(P.hist.points||[]).filter(function(p){return p.note;}).sort(function(a,b){return a.date<b.date?1:-1;});
  var notesHtml=notesArr.length?('<details style="margin-top:10px"><summary style="cursor:pointer; font-weight:700; color:var(--dim); font-size:13px; padding:4px 0">Günlük notlar ('+notesArr.length+')</summary><div class="log" style="margin-top:6px">'+notesArr.map(function(p){return '<div class="e"><span>'+clean(p.note)+'</span><span class="t">'+p.date+'</span></div>';}).join('')+'</div></details>'):'';
  var syms=STOCKS().slice().sort(function(a,b){return a.symbol.localeCompare(b.symbol);}).map(function(s){ return '<option value="'+clean(s.symbol)+'">'+(s.name||'')+'</option>'; }).join('');
  box.innerHTML=''+
    '<div class="pfhead"><div><h2 style="margin:0; font-size:22px">Yatırımlarım</h2><div class="sub">Her varlık tek satır. Satıra tıkla → o varlığın sayfası. Değerler '+psym()+'.</div></div><div class="pfcur" id="pfCur">'+curBtns+'</div></div>'+
    stat+
    '<div class="pftypes" id="pfTypeBar">'+PF_TYPES.map(function(T){ return '<button data-t="'+T.k+'"'+(T.k===pfAddType?' class="on"':'')+'>'+T.t+'</button>'; }).join('')+'</div>'+
    '<div class="pfquick" id="pfQuickBar"></div>'+
    '<h3 style="font-size:16px; margin:0 0 8px">Portföy grafiği</h3>'+selBtns+chart+notesHtml+
    '<div style="margin-top:18px">'+listHtml+closedHtml+'</div>'+
    '<div class="disclaimer">Bu ekran senin girdiğin verilere dayanır ve bulut hesabınla eşitlenir. Hisse fiyatı ~15 dk gecikmeli panodan, gram altın TL fiyatı data.js\'ten; mevduat/fon değerlerini kendin güncellersin. $/€ maliyet, her alımın kendi günkü kurundan hesaplanır. Yatırım tavsiyesi değildir.</div>';
  box.querySelectorAll('#pfCur button').forEach(function(b){ b.onclick=function(){ pf().disp=b.dataset.pc; save(); pfRender(); }; });
  var ssel=$('pfSeriesSel'); if(ssel) ssel.querySelectorAll('button').forEach(function(b){ b.onclick=function(){ pfSeriesSel=b.dataset.sk; pfRender(); }; });
  pfWireChart(box);
  box.querySelectorAll('tr[data-open]').forEach(function(tr){ tr.onclick=function(){ VIEW={mode:'asset',id:tr.dataset.open}; pfRender(); }; });
  $('pfTypeBar').querySelectorAll('button').forEach(function(b){ b.onclick=function(){ pfAddType=b.dataset.t; $('pfTypeBar').querySelectorAll('button').forEach(function(x){ x.classList.toggle('on', x.dataset.t===pfAddType); }); pfPaintQuick(syms); }; });
  pfPaintQuick(syms);
}
var pfAddType='stock';
var pfSeriesSel='value';
var pfUnlocked=false;   /* her sayfa yüklemesinde (oturumda) false başlar; her açılışta şifre sorulur */
function pfPaintQuick(syms){ var bar=$('pfQuickBar'); if(!bar) return;
  var tools='<button class="ghost" id="pfSaveDayBtn">Günü kaydet</button><button class="ghost" id="pfUploadBtn">⤒ Geçmiş yükle</button><button class="ghost" id="pfCsvBtn">⤓ Dışa aktar</button>';
  if(pfAddType==='stock'){
    bar.innerHTML='<input class="search fld" id="pfQSym" list="pfQList" placeholder="hisse ara veya kendi sembolünü yaz → AL"><datalist id="pfQList">'+(syms||'')+'</datalist><button class="go buy" id="pfQBuy" style="padding:10px 18px">AL</button><span style="flex:1"></span>'+tools;
    $('pfQBuy').onclick=pfQuickBuy; $('pfQSym').onkeydown=function(e){ if(e.key==='Enter') pfQuickBuy(); };
  } else if(pfAddType==='gold'){
    bar.innerHTML='<div class="hint" style="flex:1; min-width:160px"><b>Gram Altın</b> — kaç gram, ne ile ödedin?</div><button class="go buy" id="pfGoldBtn" style="padding:10px 18px">＋ Altın al</button><span style="flex:1"></span>'+tools;
    $('pfGoldBtn').onclick=function(){ pfBuyGold(null); };
  } else if(pfAddType==='fx'){
    bar.innerHTML='<div class="hint" style="flex:1; min-width:160px"><b>Döviz</b> — hesap adı + hangi dövizi, ne ile aldın?</div><button class="go buy" id="pfFxBtn" style="padding:10px 18px">＋ Döviz al</button><span style="flex:1"></span>'+tools;
    $('pfFxBtn').onclick=function(){ pfBuyFx(null); };
  } else {
    var lbl=pfTypeLabel(pfAddType);
    bar.innerHTML='<div class="hint" style="flex:1; min-width:160px"><b>'+lbl+'</b> eklemek için formu aç.</div><button class="go buy" id="pfAddTypeBtn" style="padding:10px 18px">＋ '+lbl+' ekle</button><span style="flex:1"></span>'+tools;
    $('pfAddTypeBtn').onclick=function(){ pfAddOther(null, pfAddType); };
  }
  $('pfSaveDayBtn').onclick=pfSaveDay; $('pfUploadBtn').onclick=pfUpload; $('pfCsvBtn').onclick=pfExport;
}
function pfQuickBuy(){ var raw=$('pfQSym').value, sym=pfResolve(raw);
  if(!sym){ var up=(raw||'').trim().toUpperCase(); if(!up){ dlg('Sembol gir','<p>Önce bir sembol yaz.</p>',[{label:'Tamam',primary:true}]); return; }
    var ex=pfAssetForSymbol(up); if(ex){ pfTxDialog(ex,null,'buy'); return; }
    pfManualStock(up); return; }
  var a=pfAssetForSymbol(sym); if(a){ pfTxDialog(a,null,'buy'); } else pfTxDialog(null, sym); }

/* Panoda olmayan (canlı fiyatı gelmeyen) hisseyi manuel ekle/düzenle */
function pfManualStock(sym, asset){
  var isNew=!asset, mkOpts=['BIST','NASDAQ','DAX','OTHER'], curMk=asset?(asset.market||'BIST'):'BIST', curCcy=asset?aNativeCcy(asset):'TRY';
  dlg(isNew?('Manuel hisse ekle — '+clean(sym)):((asset.name||clean(asset.symbol||''))+' — manuel hisse'),
    (isNew?'<div class="hint" style="margin-bottom:8px">Bu sembol panoda yok; canlı fiyat gelmez. Adet/fiyatları sen girersin, güncel fiyatı elle güncellersin. İleride pano listesine girerse otomatik canlı fiyata geçer.</div>':'')+
    (isNew?('<div class="tpfield"><label>Sembol</label><input class="fld" id="msSym" style="width:100%" value="'+clean(sym)+'"></div>'):'')+
    '<div class="tpfield"><label>Ad (ops.)</label><input class="fld" id="msName" style="width:100%" value="'+(asset?(asset.name||'').replace(/"/g,'&quot;'):'')+'"></div>'+
    '<div class="tpfield"><label>Pazar / borsa</label><select class="fld" id="msMkt" style="width:100%">'+mkOpts.map(function(m){return '<option'+(m===curMk?' selected':'')+'>'+m+'</option>';}).join('')+'</select></div>'+
    '<div class="tpfield"><label>Para birimi</label><select class="fld" id="msCcy" style="width:100%">'+['TRY','USD','EUR'].map(function(c){return '<option'+(c===curCcy?' selected':'')+'>'+c+'</option>';}).join('')+'</select></div>'+
    '<div class="tpfield"><label>Güncel fiyat (elle)</label><input class="fld" id="msCur" type="number" step="any" style="width:100%" value="'+(asset&&asset.curUnit!=null?asset.curUnit:'')+'"></div>'+
    (isNew?('<div class="tpfield"><label>Alış adedi</label><input class="fld" id="msQty" type="number" step="any" style="width:100%"></div>'+
      '<div class="tpfield"><label>Alış fiyatı</label><input class="fld" id="msPx" type="number" step="any" style="width:100%"></div>'+
      '<div class="tpfield"><label>Tarih</label><input class="fld" id="msDate" type="date" value="'+new Date().toISOString().slice(0,10)+'" style="width:100%"></div>'):'')+
    '<div class="tpfield"><label>Not (ops.)</label><input class="fld" id="msNote" style="width:100%" value="'+(asset?(asset.note||'').replace(/"/g,'&quot;'):'')+'"></div>',
    [{label:isNew?'AL':'Kaydet',primary:true,fn:function(){
      var mk=$('msMkt').value, ccy=$('msCcy').value, cur=parseFloat($('msCur').value), note=$('msNote').value||'', name=($('msName').value||'').trim();
      if(asset){ asset.market=mk; asset.ccy=ccy; asset.curUnit=isNaN(cur)?null:cur; asset.manual=true; if(name)asset.name=name; asset.note=note; save(); pfRender(); return; }
      var s2=($('msSym').value||sym||'').trim().toUpperCase(); if(!s2) return false;
      var qq=parseFloat($('msQty').value), px=parseFloat($('msPx').value);
      if(isNaN(qq)||qq<=0||isNaN(px)) return false;
      var target=pfAssetForSymbol(s2)||{id:genId(), type:'stock', symbol:s2, market:mk, ccy:ccy, name:name||s2, valMode:'qty', tx:[], manual:true};
      target.market=mk; target.ccy=ccy; if(name)target.name=name; target.manual=true; if(!isNaN(cur)) target.curUnit=cur; if(note)target.note=note;
      var d=$('msDate').value, tt=d?new Date(d+'T12:00:00').getTime():Date.now();
      target.tx=target.tx||[]; target.tx.push({t:tt, side:'buy', qty:qq, px:px, note:note});
      pf().assets[target.id]=target; save(); VIEW={mode:'asset', id:target.id}; pfRender();
    }},{label:'Vazgeç'}]); }

/* =============== VARLIK sayfası =============== */
function pfRenderAsset(box, a){
  var dc=VIEW.ccy||pcy(), dsym=psymCcy(dc);
  function d$(v){ return v==null?'—':dsym+fmt(v); }
  var q=aQty(a), rem=aRemCost(a,dc), ac=(rem.qty!=null&&rem.qty>0)?rem.cost/rem.qty:null, u=aCurUnitIn(a,dc), v=aValueIn(a,dc), c=rem.cost, pnl=(v!=null&&c!=null)?v-c:null, pct=(c>0&&pnl!=null)?pnl/c*100:null, nc=aNativeCcy(a);
  var real=aRealizedIn(a,dc), isStock=(a.type==='stock'), inPanel=(a.type==='stock' && !!find(a.symbol)), unit=aUnitName(a);
  var ccyBtns='<div class="pfcur" id="pfAssetCur" style="margin-top:8px">'+['TRY','USD','EUR'].map(function(cc){ return '<button data-ac="'+cc+'" class="'+(cc===dc?'on':'')+'">'+psymCcy(cc)+' '+cc+'</button>'; }).join('')+'</div>';
  var head='<button class="back" id="pfBack">← Yatırımlarım</button>'+
    '<div class="dhead"><div><h2 style="margin:0; font-size:24px">'+(a.name||clean(a.symbol||'—'))+(a.symbol?' <span class="nm" style="font-size:15px">'+clean(a.symbol)+'</span>':'')+' <span class="pfbadge">'+pfTypeLabel(a.type)+'</span></h2>'+
      '<div class="nm" style="font-size:13px; margin-top:4px">'+(a.note?a.note:('birim: '+unit))+'</div>'+ccyBtns+'</div>'+
      '<div style="text-align:right"><div class="px">'+d$(v)+'</div><div class="'+pnlCls(pnl)+'" style="font-weight:700">'+(pnl==null?'':(pnl>0?'+':'')+d$(pnl)+(pct!=null?' ('+(pct>0?'+':'')+fmt(pct,1)+'%)':''))+'</div></div></div>';
  var metrics='<div class="metrics">'+
    '<div class="metric"><div class="k">Adet ('+unit+')</div><div class="v">'+(q==null?'—':fmt(q,q%1?4:0))+'</div></div>'+
    '<div class="metric"><div class="k">Ort. maliyet ('+dsym+'/'+unit+')</div><div class="v">'+(ac==null?(a.valMode==='amount'?'elle değer':'—'):dsym+fmt(ac))+'</div></div>'+
    '<div class="metric"><div class="k">Güncel birim ('+dsym+')</div><div class="v">'+(u==null?'—':dsym+fmt(u))+'</div></div>'+
    '<div class="metric"><div class="k">Toplam maliyet</div><div class="v">'+d$(c)+'</div></div>'+
    '<div class="metric"><div class="k">Güncel değer</div><div class="v">'+d$(v)+'</div></div>'+
    '<div class="metric"><div class="k">Açık K/Z ('+dc+')</div><div class="v '+pnlCls(pnl)+'">'+(pnl==null?'—':(pnl>0?'+':'')+d$(pnl))+'</div></div>'+
    (a.valMode==='qty'?'<div class="metric"><div class="k">Gerçekleşen K/Z (satışlar)</div><div class="v '+pnlCls(real)+'">'+(real?((real>0?'+':'')+d$(real)):d$(0))+'</div></div>':'')+
    '</div>';
  var actions='<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:18px">'+
    (a.valMode==='qty'?'<button class="go buy" id="pfBuy" style="padding:10px 18px">AL</button><button class="go sell" id="pfSell" style="padding:10px 18px">SAT</button>':'')+
    (inPanel?'<button class="ghost accent" id="pfChartFull">📈 Grafik & RSI (detay)</button>':'')+
    '<button class="ghost" id="pfEdit">Düzenle</button><button class="ghost" id="pfDel">Sil</button></div>';
  var tx=(a.tx||[]).slice().sort(function(x,y){return y.t-x.t;});
  var txHtml=tx.length?tx.map(function(x){ var oi=(a.tx||[]).indexOf(x); var sc=x.side==='buy'?'up':'down', st=x.side==='buy'?'AL':'SAT', pay=txPay(a,x), tot=x.qty*x.px, tsec=Math.floor(x.t/1000);
    var usd=convAtTime(tot,pay,'USD',tsec), eur=convAtTime(tot,pay,'EUR',tsec);
    var alt=(usd!=null&&eur!=null)?(' <span class="cov">(≈ $'+fmt(usd)+' · €'+fmt(eur)+')</span>'):'';
    return '<div class="e"><span><b class="'+sc+'">'+st+'</b> '+fmt(x.qty,x.qty%1?4:0)+' '+unit+' × '+psymCcy(pay)+fmt(x.px)+' = '+psymCcy(pay)+fmt(tot)+alt+(x.note?(' · '+x.note):'')+'</span><span class="t">'+new Date(x.t).toLocaleDateString('tr-TR')+' <button class="pftxE" data-txi="'+oi+'" title="Düzenle">✎</button><button class="pftxD" data-txi="'+oi+'" title="Sil">🗑</button></span></div>'; }).join(''):'<div class="empty">işlem yok</div>';
  box.innerHTML=head+metrics+actions+
    (inPanel?'<h3 style="font-size:16px; margin:0 0 8px">Fiyat geçmişi</h3><div id="pfAssetChart"></div>':'')+
    '<h3 style="font-size:16px; margin:20px 0 8px">Bu varlıktaki işlemlerim <span class="nm" style="font-size:12px; font-weight:400">(✎ düzenle · 🗑 sil)</span></h3><div class="log scroll" style="max-height:300px">'+txHtml+'</div>'+
    '<div class="disclaimer">Değerler <b>'+dc+'</b> cinsinden. Ort. maliyet, her alımın <b>kendi günkü kuruyla</b> '+dc+' karşılığının ağırlıklı ortalamasıdır — yani '+dc+' getirisi gerçek kur farkını içerir. Üstteki TL/USD/EUR düğmeleriyle getirini karşılaştır. Yatırım tavsiyesi değildir.</div>';
  $('pfBack').onclick=function(){ VIEW={mode:'list',id:null}; pfRender(); };
  box.querySelectorAll('#pfAssetCur button').forEach(function(b){ b.onclick=function(){ VIEW.ccy=b.dataset.ac; pfRender(); }; });
  var bb=$('pfBuy'); if(bb) bb.onclick=function(){ pfAssetBuy(a,'buy'); };
  var sb=$('pfSell'); if(sb) sb.onclick=function(){ pfAssetBuy(a,'sell'); };
  var cf=$('pfChartFull'); if(cf) cf.onclick=function(){ if(a.symbol) B.openStock(a.symbol); };
  $('pfEdit').onclick=function(){ pfEditAsset(a); };
  $('pfDel').onclick=function(){ pfDel(a.id); };
  box.querySelectorAll('.pftxE').forEach(function(b){ b.onclick=function(ev){ ev.stopPropagation(); pfEditTx(a, parseInt(b.dataset.txi,10)); }; });
  box.querySelectorAll('.pftxD').forEach(function(b){ b.onclick=function(ev){ ev.stopPropagation(); pfDelTx(a, parseInt(b.dataset.txi,10)); }; });
  if(inPanel) pfAssetChart(a, $('pfAssetChart'));
}
function pfAssetBuy(a, side){ if(a.type==='gold') pfBuyGold(a, side); else if(a.type==='fx') pfBuyFx(a, side); else pfTxDialog(a, null, side); }
function pfEditAsset(a){
  if(a.type==='stock' && (a.manual || a.curUnit!=null || !find(a.symbol))){ pfManualStock(a.symbol, a); return; }
  if(a.type==='stock'||a.type==='gold'||a.type==='fx'){
    dlg('Notu düzenle','<div class="tpfield"><label>Not</label><input class="fld" id="pfEdNote" style="width:100%" value="'+(a.note||'').replace(/"/g,'&quot;')+'"></div><div class="hint">Bu varlık AL/SAT ile yönetilir; buradan notu değiştirebilir, işlemleri ise listedeki ✎ ile düzeltebilirsin.</div>',[{label:'Kaydet',primary:true,fn:function(){ a.note=$('pfEdNote').value||''; save(); pfRender(); }},{label:'Vazgeç'}]);
  } else pfAddOther(a.id); }
function pfAssetChart(a, mount){ if(!mount) return;
  function draw(){ var H=B.HIST; if(!H||!H[a.symbol]||!H[a.symbol].d){ mount.innerHTML='<div class="hint">Fiyat geçmişi bulunamadı. Mum grafiği, RSI ve çizimler için <b>Grafik & RSI</b>.</div>'; return; }
    var d=H[a.symbol].d.slice(-250).map(function(b){ return {y:b[4], label:new Date(b[0]*1000).toLocaleDateString('tr-TR').slice(0,5)}; });
    mount.innerHTML=B.lineChart(d,'#3b82f6',psymCcy(ccyCode(a.market||'BIST')))+'<div class="hint" style="margin-top:6px">Son ~1 yıl fiyatı. Mum grafiği, RSI, indikatörler ve çizimler için <b>Grafik & RSI</b>.</div>'; }
  if(B.HIST && B.HIST[a.symbol]) draw();
  else if(B.loadHistory){ mount.innerHTML='<div class="hint">grafik yükleniyor…</div>'; B.loadHistory(function(){ draw(); }); }
  else mount.innerHTML='<div class="hint">Fiyat grafiği için <b>Grafik & RSI</b>ı aç.</div>';
}

/* --- öneri fiyat wiring yardımcısı --- */
function pfWirePx(pxEl){ if(pxEl) pxEl.addEventListener('input', function(){ pxEl.dataset.touched='1'; }); }
function pfSetPx(pxEl, val, dec){ if(pxEl && val!=null && !isNaN(val) && pxEl.dataset.touched!=='1') pxEl.value = +Number(val).toFixed(dec==null?4:dec); }

/* =============== HİSSE AL/SAT =============== */
function pfTxDialog(asset, newSym, forceSide){
  var side=forceSide||'buy', isSell=(side==='sell'), isNew=!asset;
  var nc = asset?aNativeCcy(asset):ccyCode(find(newSym)?find(newSym).market:'BIST');
  var s = asset ? (asset.symbol?find(asset.symbol):null) : find(newSym);
  var q = asset?aQty(asset):0;
  var sym = asset?asset.symbol:newSym;
  dlg((asset?((asset.name||clean(asset.symbol||''))+' — '+(isSell?'SAT':'AL')):('AL — '+clean(newSym))),
    '<input type="hidden" id="pftxSide" value="'+side+'">'+
    '<div class="tpfield"><label>Adet</label><input class="fld" id="pftxQty" type="number" step="any" style="width:100%"></div>'+
    '<div class="tpfield"><label>Fiyat ('+psymCcy(nc)+')</label><input class="fld" id="pftxPx" type="number" step="any" style="width:100%"'+((s&&s.price!=null&&!isSell)?(' value="'+s.price+'"'):'')+'><div class="tphelp">Tarihi seçince o günün kapanış fiyatı öneri gelir; istersen değiştir.</div></div>'+
    '<div class="tpfield"><label>Tarih</label><input class="fld" id="pftxDate" type="date" value="'+new Date().toISOString().slice(0,10)+'" style="width:100%"></div>'+
    '<div class="tpfield"><label>Not (ops.)</label><input class="fld" id="pftxNote" style="width:100%"></div>'+
    (asset?('<div class="hint">Mevcut: '+fmt(q,q%1?4:0)+' adet. '+(isSell?'SAT yaparsan gerçekleşen K/Z hesaplanır.':'AL yaparsan ortalama maliyet güncellenir.')+'</div>'):'<div class="hint">Sonraki alımlar aynı satırda birleşir.</div>'),
    [{label:(isSell?'SAT':'AL'),primary:true,fn:function(){
      var sd=$('pftxSide').value, qq=parseFloat($('pftxQty').value), px=parseFloat($('pftxPx').value);
      if(isNaN(qq)||qq<=0||isNaN(px)) return false;
      var target=asset;
      if(!target){ var mk=(find(newSym)?find(newSym).market:'BIST'); target={id:genId(), name:clean(newSym), type:'stock', market:mk, symbol:newSym, valMode:'qty', tx:[]}; }
      if(sd==='sell' && qq>(aQty(target)||0)){ $('dlgBody').insertAdjacentHTML('beforeend','<div class="hint down">Elindekinden fazla satamazsın.</div>'); return false; }
      var d=$('pftxDate').value, tt=d?new Date(d+'T12:00:00').getTime():Date.now();
      target.tx=target.tx||[]; target.tx.push({t:tt, side:sd, qty:qq, px:px, note:$('pftxNote').value||''});
      pf().assets[target.id]=target; save(); if(isNew){ VIEW={mode:'asset', id:target.id}; } pfRender();
    }},{label:'Vazgeç'}]);
  var pxEl=$('pftxPx'), dEl=$('pftxDate'); pfWirePx(pxEl);
  function fillStock(){ if(!pxEl||!dEl) return;
    var c=pfStockClose(sym, dEl.value);
    if(c==null && B.loadHistory && !(B.HIST&&B.HIST[sym])){ B.loadHistory(function(){ pfSetPx(pxEl, pfStockClose(sym,dEl.value), 2); }); return; }
    pfSetPx(pxEl, c, 2);
  }
  if(dEl) dEl.addEventListener('change', fillStock);
  if(pxEl && !pxEl.value) fillStock();
}

/* =============== ALTIN AL/SAT =============== */
function pfBuyGold(asset, forceSide){
  var side=forceSide||'buy', isSell=(side==='sell');
  var g=goldGramTRY(); var q=asset?aQty(asset):0;
  dlg('Gram Altın — '+(isSell?'SAT':'AL'),
    '<input type="hidden" id="pgSide" value="'+side+'">'+
    '<div class="tpfield"><label>Kaç gram?</label><input class="fld" id="pgQty" type="number" step="any" style="width:100%"></div>'+
    '<div class="tpfield"><label>'+(isSell?'Karşılığında ne aldın?':'Ne ile ödedin?')+'</label><select class="fld" id="pgPay" style="width:100%"><option value="TRY">₺ TL</option><option value="EUR">€ EUR</option><option value="USD">$ USD</option></select></div>'+
    '<div class="tpfield"><label>Gram fiyatı ('+(isSell?'sattığın':'ödediğin')+' para biriminde)</label><input class="fld" id="pgPx" type="number" step="any" style="width:100%"><div class="tphelp">Tarihi/parayı seçince güncel gram fiyatı öneri gelir (geçmiş için sen düzelt).</div></div>'+
    '<div class="tpfield"><label>Tarih</label><input class="fld" id="pgDate" type="date" value="'+new Date().toISOString().slice(0,10)+'" style="width:100%"></div>'+
    '<div class="tpfield"><label>Not (ops.)</label><input class="fld" id="pgNote" style="width:100%"></div>'+
    '<div class="hint">'+(asset?('Mevcut: '+fmt(q,q%1?4:0)+' gram. '):'')+(g!=null?('Bugünkü gram altın ≈ ₺'+fmt(g)+'.'):'<b class="down">Gram altın fiyatı henüz data.js\'te yok.</b>')+' Tüm altın alımların tek "Gram Altın" satırında birleşir.</div>',
    [{label:(isSell?'SAT':'AL'),primary:true,fn:function(){
      var s=$('pgSide').value, qq=parseFloat($('pgQty').value), px=parseFloat($('pgPx').value), pay=$('pgPay').value;
      if(isNaN(qq)||qq<=0||isNaN(px)) return false;
      var target=asset||pfGoldAsset();
      if(!target){ target={id:genId(), name:'Gram Altın', type:'gold', valMode:'qty', tx:[]}; }
      if(s==='sell' && qq>(aQty(target)||0)){ $('dlgBody').insertAdjacentHTML('beforeend','<div class="hint down">Elindekinden fazla satamazsın.</div>'); return false; }
      var d=$('pgDate').value, tt=d?new Date(d+'T12:00:00').getTime():Date.now();
      target.tx=target.tx||[]; target.tx.push({t:tt, side:s, qty:qq, px:px, payCcy:pay, note:$('pgNote').value||''});
      pf().assets[target.id]=target; save(); VIEW={mode:'asset', id:target.id}; pfRender();
    }},{label:'Vazgeç'}]);
  var pxEl=$('pgPx'), dEl=$('pgDate'), payEl=$('pgPay'); pfWirePx(pxEl);
  function fillGold(){ pfSetPx(pxEl, pfGoldPxSuggest(payEl.value, dEl.value), 2); }
  if(dEl) dEl.addEventListener('change', function(){ pfLoadRates(fillGold); });
  if(payEl) payEl.addEventListener('change', function(){ pfLoadRates(fillGold); });
  pfLoadRates(function(){ if(pxEl && !pxEl.value) fillGold(); });
}

/* =============== DÖVİZ AL/SAT =============== */
function pfBuyFx(asset, forceSide){
  var side=forceSide||'buy', isSell=(side==='sell');
  var hc = asset?(asset.holdCcy||'EUR'):null; var q=asset?aQty(asset):0;
  var nameField = asset
    ? ('<div class="tpfield"><label>Hesap</label><input class="fld" value="'+(asset.name||hc).replace(/"/g,'&quot;')+'" disabled style="width:100%"></div>')
    : '<div class="tpfield"><label>Hesap adı</label><input class="fld" id="pxName" style="width:100%" placeholder="örn. Almanya EUR / TR EUR"></div>';
  var holdSel = asset
    ? ('<div class="tpfield"><label>Döviz</label><input class="fld" value="'+hc+'" disabled style="width:100%"></div>')
    : '<div class="tpfield"><label>Hangi dövizi?</label><select class="fld" id="pxHold" style="width:100%"><option value="EUR">€ EUR</option><option value="USD">$ USD</option></select></div>';
  dlg('Döviz — '+(isSell?'SAT':'AL'),
    '<input type="hidden" id="pxSide" value="'+side+'">'+nameField+holdSel+
    '<div class="tpfield"><label>'+(isSell?'Ne kadar sattın? (döviz miktarı)':'Ne kadar aldın? (döviz miktarı)')+'</label><input class="fld" id="pxQty" type="number" step="any" style="width:100%"></div>'+
    '<div class="tpfield"><label>'+(isSell?'Karşılığında ne aldın?':'Ne ile ödedin?')+'</label><select class="fld" id="pxPay" style="width:100%"><option value="TRY">₺ TL</option><option value="EUR">€ EUR</option><option value="USD">$ USD</option></select></div>'+
    '<div class="tpfield"><label>Birim fiyat (1 birim döviz = kaç '+(isSell?'karşılık':'ödeme')+' parası)</label><input class="fld" id="pxPx" type="number" step="any" style="width:100%"><div class="tphelp">Tarihi/paraları seçince o günün kuru öneri olarak gelir; istersen değiştir.</div></div>'+
    '<div class="tpfield"><label>Tarih</label><input class="fld" id="pxDate" type="date" value="'+new Date().toISOString().slice(0,10)+'" style="width:100%"></div>'+
    '<div class="tpfield"><label>Not (ops.)</label><input class="fld" id="pxNote" style="width:100%"></div>'+
    (asset?('<div class="hint">Mevcut: '+fmt(q,q%1?4:0)+' '+hc+' ('+(asset.name||hc)+'). Aynı hesap adı + döviz tek satırda birleşir.</div>'):'<div class="hint">Hesap adı + döviz aynıysa birleşir. Örn. "Almanya EUR" ve "TR EUR" ayrı kalır.</div>'),
    [{label:(isSell?'SAT':'AL'),primary:true,fn:function(){
      var s=$('pxSide').value, hold=asset?hc:$('pxHold').value, qq=parseFloat($('pxQty').value), px=parseFloat($('pxPx').value), pay=$('pxPay').value;
      var nm=asset?(asset.name||hold):((($('pxName').value||'').trim())||hold);
      if(isNaN(qq)||qq<=0||isNaN(px)) return false;
      var target=asset||pfFxAsset(hold, nm);
      if(!target){ target={id:genId(), name:nm, type:'fx', holdCcy:hold, valMode:'qty', tx:[]}; }
      if(s==='sell' && qq>(aQty(target)||0)){ $('dlgBody').insertAdjacentHTML('beforeend','<div class="hint down">Elindekinden fazla satamazsın.</div>'); return false; }
      var d=$('pxDate').value, tt=d?new Date(d+'T12:00:00').getTime():Date.now();
      target.tx=target.tx||[]; target.tx.push({t:tt, side:s, qty:qq, px:px, payCcy:pay, note:$('pxNote').value||''});
      pf().assets[target.id]=target; save(); VIEW={mode:'asset', id:target.id}; pfRender();
    }},{label:'Vazgeç'}]);
  var pxEl=$('pxPx'), dEl=$('pxDate'), payEl=$('pxPay'), holdEl=$('pxHold'); pfWirePx(pxEl);
  function curHold(){ return asset?hc:(holdEl?holdEl.value:'EUR'); }
  function fillFx(){ pfSetPx(pxEl, pfFxRateSuggest(curHold(), payEl.value, dEl.value), 4); }
  if(dEl) dEl.addEventListener('change', function(){ pfLoadRates(fillFx); });
  if(payEl) payEl.addEventListener('change', function(){ pfLoadRates(fillFx); });
  if(holdEl) holdEl.addEventListener('change', function(){ pfLoadRates(fillFx); });
  pfLoadRates(function(){ if(pxEl && !pxEl.value) fillFx(); });
}

/* =============== TEK İŞLEM DÜZENLE / SİL =============== */
function pfEditTx(a, i){
  var t=(a.tx||[])[i]; if(!t) return;
  var isFxG=(a.type==='gold'||a.type==='fx');
  var nc=aNativeCcy(a), unit=aUnitName(a);
  var payCur = t.payCcy || (isFxG?(a.type==='gold'?'TRY':(a.holdCcy||'EUR')):nc);
  var paySel = isFxG ? ('<div class="tpfield"><label>Ödeme / karşılık para birimi</label><select class="fld" id="etPay" style="width:100%">'+
      ['TRY','EUR','USD'].map(function(c){ return '<option value="'+c+'"'+(c===payCur?' selected':'')+'>'+psymCcy(c)+' '+c+'</option>'; }).join('')+'</select></div>') : '';
  var pxLbl = isFxG ? '(ödeme parası)' : psymCcy(nc);
  dlg('İşlemi düzenle',
    '<div class="tpfield"><label>Yön</label><select class="fld" id="etSide" style="width:100%"><option value="buy"'+(t.side!=='sell'?' selected':'')+'>AL</option><option value="sell"'+(t.side==='sell'?' selected':'')+'>SAT</option></select></div>'+
    '<div class="tpfield"><label>Adet ('+unit+')</label><input class="fld" id="etQty" type="number" step="any" style="width:100%" value="'+t.qty+'"></div>'+
    paySel+
    '<div class="tpfield"><label>Fiyat '+pxLbl+'</label><input class="fld" id="etPx" type="number" step="any" style="width:100%" value="'+t.px+'"></div>'+
    '<div class="tpfield"><label>Tarih</label><input class="fld" id="etDate" type="date" style="width:100%" value="'+new Date(t.t).toISOString().slice(0,10)+'"></div>'+
    '<div class="tpfield"><label>Not (ops.)</label><input class="fld" id="etNote" style="width:100%" value="'+(t.note||'').replace(/"/g,'&quot;')+'"></div>'+
    '<div class="hint">Bu tek işlemin her detayını düzeltebilirsin. Kaydedince ortalama maliyet ve K/Z yeniden hesaplanır.</div>',
    [{label:'Kaydet',primary:true,fn:function(){
      var qq=parseFloat($('etQty').value), px=parseFloat($('etPx').value);
      if(isNaN(qq)||qq<=0||isNaN(px)) return false;
      var d=$('etDate').value, tt=d?new Date(d+'T12:00:00').getTime():t.t;
      t.side=$('etSide').value; t.qty=qq; t.px=px; t.t=tt; t.note=$('etNote').value||'';
      if(isFxG){ t.payCcy=$('etPay').value; }
      save(); pfRender();
    }},{label:'Vazgeç'}]);
}
function pfDelTx(a, i){
  var t=(a.tx||[])[i]; if(!t) return;
  dlg('İşlemi sil','<p><b>'+(t.side==='sell'?'SAT':'AL')+'</b> '+fmt(t.qty,t.qty%1?4:0)+' '+aUnitName(a)+' — '+new Date(t.t).toLocaleDateString('tr-TR')+' işlemi silinsin mi?</p>',
    [{label:'Evet, sil',primary:true,fn:function(){ a.tx.splice(i,1); save(); pfRender(); }},{label:'Vazgeç'}]);
}

/* =============== MEVDUAT / FON / KRİPTO / DİĞER =============== */
function pfaToggle(){ var mode=$('pfaMode').value;
  $('pfaQtyBox').style.display=(mode==='qty')?'block':'none'; $('pfaAmtBox').style.display=(mode==='amount')?'block':'none'; }
function pfAddOther(editId, preType){ var a=editId?pf().assets[editId]:null;
  var types=PF_TYPES.filter(function(T){return T.k!=='stock'&&T.k!=='gold'&&T.k!=='fx';});
  var body='<div class="tpfield"><label>Ad</label><input class="fld" id="pfaName" style="width:100%" placeholder="örn. Vadeli TL / QNB Fonu"></div>'+
    '<div class="tpfield"><label>Tür</label><select class="fld" id="pfaType" style="width:100%">'+types.map(function(T){return '<option value="'+T.k+'">'+T.t+'</option>';}).join('')+'</select></div>'+
    '<div class="tpfield"><label>Para birimi</label><select class="fld" id="pfaCcy" style="width:100%"><option>TRY</option><option>EUR</option><option>USD</option></select></div>'+
    '<div class="tpfield"><label>Değerleme</label><select class="fld" id="pfaMode" style="width:100%"><option value="amount">Tutar bazlı (güncel toplam değeri gir)</option><option value="qty">Adet bazlı (alım/satım + birim fiyat)</option></select></div>'+
    '<div id="pfaAmtBox"><div class="tpfield"><label>Güncel toplam değer</label><input class="fld" id="pfaVal" type="number" step="any" style="width:100%"></div>'+
      '<div class="tpfield"><label>Maliyet / anapara (ops.)</label><input class="fld" id="pfaCost" type="number" step="any" style="width:100%"></div></div>'+
    '<div id="pfaQtyBox" style="display:none"><div class="tpfield"><label>Elindeki adet (ops.)</label><input class="fld" id="pfaQty" type="number" step="any" style="width:100%"></div>'+
      '<div class="tpfield"><label>Ortalama alış fiyatı (ops.)</label><input class="fld" id="pfaAvg" type="number" step="any" style="width:100%"></div>'+
      '<div class="tpfield"><label>Güncel birim fiyat</label><input class="fld" id="pfaUnit" type="number" step="any" style="width:100%"></div></div>'+
    '<div class="tpfield"><label>Not (ops.)</label><input class="fld" id="pfaNote" style="width:100%"></div>';
  dlg(a?'Varlığı düzenle':'Varlık ekle',body,[{label:'Kaydet',primary:true,fn:function(){ return pfSaveOther(editId); }},{label:'Vazgeç'}]);
  var md=$('pfaMode'); if(md) md.onchange=pfaToggle;
  if(a){ $('pfaName').value=a.name||''; $('pfaType').value=a.type; $('pfaCcy').value=a.ccy||'TRY'; $('pfaMode').value=a.valMode||'amount';
    if((a.valMode||'amount')==='amount'){ $('pfaVal').value=a.curValue!=null?a.curValue:''; $('pfaCost').value=a.cost!=null?a.cost:''; }
    else { $('pfaUnit').value=a.curUnit!=null?a.curUnit:''; var qf=$('pfaQty'),af=$('pfaAvg'); if(qf)qf.parentNode.style.display='none'; if(af)af.parentNode.style.display='none'; }
    $('pfaNote').value=a.note||''; }
  if(!a && preType){ var ty=$('pfaType'); if(ty) ty.value=preType; if(preType==='deposit'||preType==='other'){ $('pfaMode').value='amount'; } }
  pfaToggle(); }
function pfSaveOther(editId){ var name=$('pfaName').value.trim(); if(!name) return false;
  var typeSel=$('pfaType').value;
  if(!editId){ var ex=pfAssetForName(name,typeSel);
    if(ex){
      if(ex.valMode==='qty'){ var uu=parseFloat($('pfaUnit').value); if(!isNaN(uu)) ex.curUnit=uu;
        var sq=parseFloat($('pfaQty').value), sa=parseFloat($('pfaAvg').value);
        if(!isNaN(sq)&&sq>0){ ex.tx=ex.tx||[]; ex.tx.push({t:Date.now(),side:'buy',qty:sq,px:(isNaN(sa)?(ex.curUnit||0):sa),note:$('pfaNote').value||'ekleme'}); } }
      else { var vv=parseFloat($('pfaVal').value); if(!isNaN(vv)) ex.curValue=vv; var cc=parseFloat($('pfaCost').value); if(!isNaN(cc)) ex.cost=cc; }
      var nn=$('pfaNote').value; if(nn) ex.note=nn; save(); VIEW={mode:'asset',id:ex.id}; pfRender(); return;
    }
  }
  var a=editId?pf().assets[editId]:{id:genId(),tx:[]};
  a.name=name; a.type=typeSel; a.market=null; a.symbol=null; a.ccy=$('pfaCcy').value; a.valMode=$('pfaMode').value; a.note=$('pfaNote').value||'';
  if(a.valMode==='amount'){ var vv2=parseFloat($('pfaVal').value); a.curValue=isNaN(vv2)?null:vv2; var cc2=parseFloat($('pfaCost').value); a.cost=isNaN(cc2)?null:cc2; }
  else { var uu2=parseFloat($('pfaUnit').value); a.curUnit=isNaN(uu2)?null:uu2;
    if(!editId){ var sq2=parseFloat($('pfaQty').value),sa2=parseFloat($('pfaAvg').value); if(!isNaN(sq2)&&sq2>0) a.tx=[{t:Date.now(),side:'buy',qty:sq2,px:(isNaN(sa2)?(a.curUnit||0):sa2),note:'başlangıç'}]; } }
  pf().assets[a.id]=a; save(); if(!editId){ VIEW={mode:'asset',id:a.id}; } pfRender(); }
function pfDel(id){ var a=pf().assets[id]; if(!a)return;
  dlg('Varlığı sil','<p><b>'+(a.name||clean(a.symbol||''))+'</b> ve tüm işlem geçmişi silinsin mi?</p>',
    [{label:'Evet, sil',primary:true,fn:function(){ delete pf().assets[id]; VIEW={mode:'list',id:null}; save(); pfRender(); }},{label:'Vazgeç'}]); }

/* =============== dışa aktar + geçmiş yükle =============== */
function pfExport(){ var rows=[['Ad','Tür','Birim','Sembol','Adet','Ort. maliyet('+pcy()+')','Güncel birim('+pcy()+')','Değer('+pcy()+')','Maliyet('+pcy()+')','K/Z('+pcy()+')']];
  Object.keys(pf().assets).forEach(function(id){ var a=pf().assets[id],v=aValueDisp(a),c=aCostDisp(a);
    rows.push([a.name,pfTypeLabel(a.type),aUnitName(a),a.symbol?clean(a.symbol):'',aQty(a),aAvgCostDisp(a),aCurUnitDisp(a),v,c,(v!=null&&c!=null)?v-c:'']); });
  B.downloadCSV('yatirimlarim.csv',B.toCSV(rows)); }
function pfLoadXLSX(cb){ if(window.XLSX){ cb(true); return; }
  var s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  s.onload=function(){ cb(!!window.XLSX); }; s.onerror=function(){ cb(false); }; document.head.appendChild(s); }
function pfDate(v){ if(v==null) return null; if(v instanceof Date) return v.toISOString().slice(0,10); var s=String(v).trim(),m;
  if(m=s.match(/^(\d{4})-(\d{2})-(\d{2})/)) return m[1]+'-'+m[2]+'-'+m[3];
  if(m=s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/)) return m[3]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2);
  var d=new Date(s); return isNaN(d)?null:d.toISOString().slice(0,10); }
function pfNum(v){ if(v==null) return null; if(typeof v==='number') return v;
  var s=String(v).replace(/[^\d,.\-]/g,'').replace(/\.(?=\d{3}\b)/g,'').replace(',','.'); var n=parseFloat(s); return isNaN(n)?null:n; }
function pfParse(file,cb){ pfLoadXLSX(function(ok){ if(!ok){ cb(null,'XLSX kütüphanesi yüklenemedi (internet?)'); return; }
  var fr=new FileReader(); fr.onload=function(){ try{ var wb=XLSX.read(new Uint8Array(fr.result),{type:'array',cellDates:true});
    var ws=wb.Sheets[wb.SheetNames[0]]; cb(XLSX.utils.sheet_to_json(ws,{header:1,raw:true}),null); }catch(e){ cb(null,e.message||'okunamadı'); } };
  fr.onerror=function(){ cb(null,'dosya okunamadı'); }; fr.readAsArrayBuffer(file); }); }
function pfUpload(){ dlg('Portföy geçmişini yükle',
  '<p>Excel/CSV sütun sırası:<br><b>1) Tarih*&nbsp;&nbsp;2) Toplam varlık*&nbsp;&nbsp;3) Güne ait not&nbsp;&nbsp;4) Borsa&nbsp;&nbsp;5) Döviz&nbsp;&nbsp;6) Altın</b><br>İlk iki sütun zorunlu (*), son dördü opsiyonel — boş bırakabilirsin. Başlık satırı otomatik atlanır.</p>'+
  '<div class="hint" style="margin:-2px 0 10px">Borsa+Döviz+Altın toplamı "Toplam varlık"a eşit olmak zorunda değil (kripto/vadesiz vb. hariç). Her seri, grafik üstündeki düğmelerden ayrı çizilir.</div>'+
  '<div class="tpfield"><label>Serinin para birimi</label><select class="fld" id="pfuCcy" style="width:100%"><option>TRY</option><option>USD</option><option>EUR</option></select></div>'+
  '<div class="tpfield"><label>Dosya</label><input class="fld" id="pfuFile" type="file" accept=".xlsx,.xls,.csv" style="width:100%"></div>'+
  '<div class="hint" id="pfuMsg" style="margin-top:8px"></div>',
  [{label:'Yükle',primary:true,fn:function(){ pfDoUpload(); return false; }},{label:'Kapat'}]); }
function pfDoUpload(){ var f=$('pfuFile').files[0]; if(!f){ $('pfuMsg').textContent='Dosya seç.'; return; }
  var ccy=$('pfuCcy').value; $('pfuMsg').textContent='okunuyor…';
  pfParse(f,function(rows,err){ if(err){ $('pfuMsg').innerHTML='<span class="down">'+err+'</span>'; return; }
    var pts=[]; rows.forEach(function(r){ if(!r||r.length<2) return; var d=pfDate(r[0]),v=pfNum(r[1]); if(!d||v==null) return;
      var o={date:d, value:v};
      var note=(r.length>2 && r[2]!=null)?String(r[2]).trim():''; if(note) o.note=note;
      var b=pfNum(r[3]); if(b!=null) o.borsa=b;
      var x=pfNum(r[4]); if(x!=null) o.doviz=x;
      var g=pfNum(r[5]); if(g!=null) o.altin=g;
      pts.push(o); });
    if(!pts.length){ $('pfuMsg').innerHTML='<span class="down">Geçerli tarih/değer bulunamadı.</span>'; return; }
    var seen={}; pts.forEach(function(p){ seen[p.date]=p; }); var out=Object.keys(seen).sort().map(function(k){ return seen[k]; });
    pf().hist={ccy:ccy,points:out,rates:(pf().hist&&pf().hist.rates)||[]}; save(); dlgClose(); pfRender(); }); }

})();
