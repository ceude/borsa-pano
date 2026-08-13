/* ============================================================
   Borsa Pano — "Tüm Yatırımlarım" modülü (harici dosya)
   index.html'e tek <script src="portfoy.js"></script> ile bağlanır.
   Ana dosyanın closure'ındaki fonksiyonlara "bridge" (B) üzerinden erişir;
   böylece index.html şişmez ve tüm veri/senkron ana dosyayla ortaktır.
   ============================================================ */
(function(){
"use strict";
var B=null, ready=false;

/* index.html bu fonksiyonu köprü nesnesiyle çağırır */
window.PF_INIT=function(bridge){ if(ready) return; B=bridge; ready=true; injectCSS(); injectDOM(); wire(); };
/* index.html erken yüklenmişse köprü hazır olabilir */
if(window.__PF_BRIDGE) window.PF_INIT(window.__PF_BRIDGE);

/* goView('portfolio') ve veri yenilemesi buradan render tetikler */
window.PF={ render:function(){ if(ready) pfRender(); }, ready:function(){ return ready; } };

/* ---------------- kısayollar ---------------- */
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

/* ---------------- stil ---------------- */
function injectCSS(){
  if(document.getElementById('pfStyle')) return;
  var css=''+
  '.pfhead{display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; margin-bottom:14px}'+
  '.pfcur{display:flex; gap:4px; background:var(--bg); border:1px solid var(--line); border-radius:999px; padding:3px}'+
  '.pfcur button{border:none; background:transparent; padding:6px 14px; border-radius:999px; font-weight:700; font-size:13px; color:var(--dim); cursor:pointer}'+
  '.pfcur button.on{background:var(--brand); color:#fff}'+
  '.pfsechead{font-size:12px; color:var(--faint); text-transform:uppercase; letter-spacing:.05em; margin:16px 0 6px; font-weight:700}';
  var st=document.createElement('style'); st.id='pfStyle'; st.textContent=css; document.head.appendChild(st);
}

/* ---------------- DOM enjeksiyonu (pill + sekme + bölüm) ---------------- */
function injectDOM(){
  // 1) header pill
  if(!$('pfOpen')){
    var sw=$('mktSwitch');
    if(sw){ var b=document.createElement('button'); b.id='pfOpen'; b.className='ghost accent';
      b.style.fontWeight='700'; b.textContent='🧭 Tüm Yatırımlarım';
      sw.parentNode.insertBefore(b, sw.nextSibling); }
  }
  // 2) nav sekmesi
  if(!document.querySelector('.tab[data-v="portfolio"]')){
    var nav=$('nav'); if(nav){ var t=document.createElement('button'); t.className='tab'; t.dataset.v='portfolio';
      t.title='Tüm Yatırımlarım — tüm varlıkların tek ekranda'; t.textContent='Tüm Yatırımlarım'; nav.appendChild(t); }
  }
  // 3) görünüm bölümü
  if(!$('v-portfolio')){
    var main=document.querySelector('main');
    if(main){ var sec=document.createElement('section'); sec.className='view card'; sec.id='v-portfolio';
      sec.innerHTML='<div id="pfBody"></div>'; main.appendChild(sec); }
  }
}

function pfShow(){ pfRender(); B.goView('portfolio'); }
function wire(){
  var o=$('pfOpen'); if(o) o.onclick=pfShow;
  var t=document.querySelector('.tab[data-v="portfolio"]'); if(t) t.onclick=pfShow;
  pf(); // shape'i garanti et
}

/* ---------------- veri modeli ---------------- */
var PF_TYPES=[{k:'stock',t:'Hisse'},{k:'deposit',t:'Mevduat'},{k:'fund',t:'Yatırım Fonu'},
  {k:'gold',t:'Altın / Döviz'},{k:'crypto',t:'Kripto'},{k:'other',t:'Diğer'}];
function pfTypeLabel(k){ for(var i=0;i<PF_TYPES.length;i++) if(PF_TYPES[i].k===k) return PF_TYPES[i].t; return k; }
function pf(){
  var S=B.S;
  if(!S.pf) S.pf={disp:'TRY',assets:{},snaps:[],hist:{ccy:'TRY',points:[],rates:[]}};
  var p=S.pf; if(!p.assets)p.assets={}; if(!p.snaps)p.snaps=[]; if(!p.hist)p.hist={ccy:'TRY',points:[],rates:[]}; if(!p.disp)p.disp='TRY';
  return p;
}
function pcy(){ return pf().disp; }
function psymCcy(c){ return c==='TRY'?'₺':c==='USD'?'$':'€'; }
function psym(){ return psymCcy(pcy()); }
function pf$(v){ return v==null?'—':psym()+fmt(v); }

/* para çevirimi (yalnız güncel kur; tarihsel kur ileride) */
function toTRY(v,c){ var R=RATES(); if(v==null)return null; if(c==='TRY')return v; if(c==='EUR')return R.EURTRY?v*R.EURTRY:null; if(c==='USD')return R.USDTRY?v*R.USDTRY:null; return v; }
function frTRY(v,c){ var R=RATES(); if(v==null)return null; if(c==='TRY')return v; if(c==='EUR')return R.EURTRY?v/R.EURTRY:null; if(c==='USD')return R.USDTRY?v/R.USDTRY:null; return v; }
function pfConv(v,from,to){ return frTRY(toTRY(v,from),to); }

/* varlık hesapları */
function aNativeCcy(a){ return a.type==='stock'? ccyCode(a.market||'BIST') : (a.ccy||'TRY'); }
function aQty(a){ if(a.valMode==='amount') return null; var q=0; (a.tx||[]).forEach(function(t){ q+=(t.side==='sell'?-1:1)*t.qty; }); return q; }
function aAvgCost(a){ if(a.valMode==='amount') return null; var q=0,cost=0;
  (a.tx||[]).slice().sort(function(x,y){return x.t-y.t;}).forEach(function(t){
    if(t.side==='sell'){ if(q>0){ var s=Math.min(t.qty,q),avg=cost/q; cost-=avg*s; q-=s; } }
    else { q+=t.qty; cost+=t.px*t.qty; } });
  return q>0?cost/q:null; }
function aCurUnit(a){ if(a.type==='stock'&&a.symbol){ var s=find(a.symbol); return s?s.price:null; } return a.curUnit!=null?a.curUnit:null; }
function aValueNative(a){ if(a.valMode==='amount') return a.curValue!=null?a.curValue:null; var q=aQty(a),u=aCurUnit(a); return (q!=null&&u!=null)?q*u:null; }
function aCostNative(a){ if(a.valMode==='amount') return a.cost!=null?a.cost:null; var q=aQty(a),ac=aAvgCost(a); return (q!=null&&ac!=null)?q*ac:null; }
function aValueDisp(a){ var v=aValueNative(a); return v==null?null:pfConv(v,aNativeCcy(a),pcy()); }
function aCostDisp(a){ var c=aCostNative(a); return c==null?null:pfConv(c,aNativeCcy(a),pcy()); }

function pfTotals(){ var val=0,cost=0,has=false;
  Object.keys(pf().assets).forEach(function(id){ var a=pf().assets[id]; var v=aValueDisp(a); if(v!=null){val+=v;has=true;} var c=aCostDisp(a); if(c!=null)cost+=c; });
  return {value:has?val:null, cost:cost, pnl:has?val-cost:null}; }
function pfSnapVals(){ var o={TRY:0,USD:0,EUR:0},has=false;
  Object.keys(pf().assets).forEach(function(id){ var a=pf().assets[id]; var v=aValueNative(a); if(v==null)return; has=true; var c=aNativeCcy(a);
    o.TRY+=pfConv(v,c,'TRY')||0; o.USD+=pfConv(v,c,'USD')||0; o.EUR+=pfConv(v,c,'EUR')||0; });
  return has?o:null; }
function pfSaveDay(){ var v=pfSnapVals(); if(!v){ dlg('Kayıt yok','<p>Önce en az bir varlık ekle.</p>',[{label:'Tamam',primary:true}]); return; }
  var d=new Date().toISOString().slice(0,10); pf().snaps=pf().snaps.filter(function(s){return s.date!==d;});
  pf().snaps.push({date:d,TRY:v.TRY,USD:v.USD,EUR:v.EUR}); save(); pfRender(); }

function pfHistRate(date){ var R=pf().hist.rates||[]; if(!R.length) return null; var best=null;
  R.forEach(function(r){ if(r.date<=date){ if(!best||r.date>best.date) best=r; } }); if(!best) best=R[0];
  return best?{usdtry:best.usdtry, eurtry:best.eurtry}:null; }
function pfSeries(){ var d=pcy(), map={}, H=pf().hist, warn=false, hc=H.ccy||'TRY';
  (H.points||[]).forEach(function(p){ var val;
    if(d===hc) val=p.value;
    else { var r=pfHistRate(p.date);
      var tryv = hc==='TRY'?p.value:(hc==='USD'?(r?p.value*r.usdtry:pfConv(p.value,'USD','TRY')):(r?p.value*r.eurtry:pfConv(p.value,'EUR','TRY')));
      if(d==='TRY') val=tryv; else if(d==='USD') val=r?tryv/r.usdtry:pfConv(tryv,'TRY','USD'); else val=r?tryv/r.eurtry:pfConv(tryv,'TRY','EUR');
      if(!r) warn=true; }
    if(val!=null&&!isNaN(val)) map[p.date]={y:val}; });
  (pf().snaps||[]).forEach(function(s){ if(s[d]!=null) map[s.date]={y:s[d]}; });
  var pts=Object.keys(map).sort().map(function(k){ return {y:map[k].y, label:k.slice(5)}; });
  return {pts:pts, warn:warn}; }

function pfResolve(sym,mk){ sym=(sym||'').trim().toUpperCase(); if(!sym) return null;
  if(find(sym)) return sym; if(mk==='BIST'&&find(sym+'.IS')) return sym+'.IS'; if(mk==='DAX'&&find(sym+'.DE')) return sym+'.DE'; return null; }

/* ---------------- render ---------------- */
function pfRender(){ var box=$('pfBody'); if(!box) return; var P=pf(), t=pfTotals(), cur=pcy();
  var curBtns=['TRY','USD','EUR'].map(function(c){ return '<button data-pc="'+c+'" class="'+(c===cur?'on':'')+'">'+psymCcy(c)+' '+c+'</button>'; }).join('');
  var stat='<div class="stat">'+
    '<div><div class="k">Toplam varlık</div><div class="v">'+pf$(t.value)+'</div></div>'+
    '<div><div class="k">Toplam maliyet</div><div class="v">'+pf$(t.cost)+'</div></div>'+
    '<div><div class="k">Toplam K/Z</div><div class="v '+pnlCls(t.pnl)+'">'+(t.pnl==null?'—':(t.pnl>0?'+':'')+pf$(t.pnl)+(t.cost>0?' ('+(t.pnl>0?'+':'')+fmt(t.pnl/t.cost*100,1)+'%)':''))+'</div></div></div>';
  var ids=Object.keys(P.assets), byType={};
  ids.forEach(function(id){ var a=P.assets[id]; (byType[a.type]=byType[a.type]||[]).push(a); });
  var holdHtml='';
  PF_TYPES.forEach(function(T){ var list=byType[T.k]; if(!list||!list.length) return;
    var sub=list.reduce(function(s,a){ return s+(aValueDisp(a)||0); },0);
    holdHtml+='<div class="pfsechead">'+T.t+' <span style="color:var(--faint); font-weight:600">· '+pf$(sub)+'</span></div>';
    holdHtml+='<div class="scroll"><table><thead><tr><th class="l">Varlık</th><th>Adet</th><th>Ort. maliyet</th><th>Güncel fiyat</th><th>Değer</th><th>Maliyet</th><th>K/Z</th><th></th></tr></thead><tbody>';
    list.forEach(function(a){ var q=aQty(a),ac=aAvgCost(a),u=aCurUnit(a),v=aValueDisp(a),c=aCostDisp(a),pnl=(v!=null&&c!=null)?v-c:null,nc=aNativeCcy(a);
      holdHtml+='<tr><td><b>'+(a.name||'—')+'</b>'+(a.symbol?' <span class="nm">'+clean(a.symbol)+'</span>':'')+'<div class="nm">'+psymCcy(nc)+(a.note?(' · '+a.note.slice(0,24)):'')+'</div></td>'+
        '<td>'+(q==null?'—':fmt(q,q%1?4:0))+'</td><td>'+(ac==null?'—':fmt(ac))+'</td><td>'+(u==null?'—':fmt(u))+'</td>'+
        '<td>'+pf$(v)+'</td><td>'+pf$(c)+'</td><td class="'+pnlCls(pnl)+'">'+(pnl==null?'—':(pnl>0?'+':'')+pf$(pnl))+'</td>'+
        '<td style="white-space:nowrap">'+(a.valMode==='qty'?'<button class="miniact" data-pftx="'+a.id+'">İşlem</button> ':'')+
        '<button class="miniact" data-pfed="'+a.id+'">Düzenle</button> <button class="miniact" data-pfdel="'+a.id+'">Sil</button></td></tr>'; });
    holdHtml+='</tbody></table></div>'; });
  if(!ids.length) holdHtml='<div class="empty">Henüz varlık yok — "＋ Varlık ekle" ile başla.</div>';
  var ser=pfSeries();
  var chart=ser.pts.length?(B.lineChart(ser.pts,'#0bbfa6',psym())+(ser.warn?'<div class="hint down" style="margin-top:6px">⚠ Bazı geçmiş noktalar tarihsel kur olmadığı için <b>güncel kurla</b> çevrildi. Doğru çeviri için "Geçmiş yükle"de tarihsel kur dosyası da ver.</div>':'')):'<div class="empty">Grafik için "Günü grafiğe kaydet" ya da geçmiş veri yükle.</div>';
  var logs=[]; ids.forEach(function(id){ var a=P.assets[id]; (a.tx||[]).forEach(function(x){ logs.push({a:a,x:x}); }); });
  logs.sort(function(m,n){return n.x.t-m.x.t;});
  var logHtml=logs.length?logs.slice(0,40).map(function(L){ var x=L.x,a=L.a,sc=x.side==='buy'?'up':'down',st=x.side==='buy'?'AL':'SAT';
    return '<div class="e"><span><b class="'+sc+'">'+st+'</b> '+(a.name||clean(a.symbol||''))+' × '+fmt(x.qty,x.qty%1?4:0)+' @ '+fmt(x.px)+' '+psymCcy(aNativeCcy(a))+(x.note?(' · '+x.note):'')+'</span><span class="t">'+new Date(x.t).toLocaleDateString('tr-TR')+'</span></div>'; }).join(''):'<div class="empty">işlem yok</div>';
  box.innerHTML='<div class="pfhead"><div><h2 style="margin:0; font-size:22px">Tüm Yatırımlarım</h2><div class="sub">Tüm borsalar, mevduat, fon, altın/döviz, kripto ve diğer varlıklar tek ekranda. Değerler '+psym()+' cinsinden.</div></div><div class="pfcur" id="pfCur">'+curBtns+'</div></div>'+
    stat+'<div style="display:flex; gap:8px; flex-wrap:wrap; margin:6px 0 16px"><button class="ghost accent" id="pfAddBtn">＋ Varlık ekle</button><button class="ghost" id="pfSaveDayBtn">Günü grafiğe kaydet</button><button class="ghost" id="pfUploadBtn">⤒ Geçmiş yükle (Excel/CSV)</button><button class="ghost" id="pfCsvBtn">⤓ Dışa aktar</button></div>'+
    '<h3 style="font-size:16px; margin:0 0 8px">Portföy değeri</h3>'+chart+'<div style="margin-top:20px">'+holdHtml+'</div>'+
    '<h3 style="font-size:16px; margin:22px 0 8px">İşlem geçmişi</h3><div class="log scroll" style="max-height:260px">'+logHtml+'</div>'+
    '<div class="disclaimer">Bu ekran tamamen senin girdiğin verilere dayanır ve bulut hesabınla eşitlenir. Hisse fiyatları ~15 dk gecikmeli panodan gelir; mevduat/fon/altın/diğer varlıkların güncel değerini kendin güncellersin. Yatırım tavsiyesi değildir.</div>';
  box.querySelectorAll('#pfCur button').forEach(function(b){ b.onclick=function(){ pf().disp=b.dataset.pc; save(); pfRender(); }; });
  $('pfAddBtn').onclick=function(){ pfAdd(null); }; $('pfSaveDayBtn').onclick=pfSaveDay; $('pfUploadBtn').onclick=pfUpload; $('pfCsvBtn').onclick=pfExport;
  box.querySelectorAll('[data-pftx]').forEach(function(b){ b.onclick=function(){ pfTx(b.dataset.pftx); }; });
  box.querySelectorAll('[data-pfed]').forEach(function(b){ b.onclick=function(){ pfAdd(b.dataset.pfed); }; });
  box.querySelectorAll('[data-pfdel]').forEach(function(b){ b.onclick=function(){ pfDel(b.dataset.pfdel); }; });
}

/* ---------------- diyaloglar ---------------- */
function pfDel(id){ var a=pf().assets[id]; if(!a)return;
  dlg('Varlığı sil','<p><b>'+(a.name||clean(a.symbol||''))+'</b> ve tüm işlem geçmişi silinsin mi?</p>',
    [{label:'Evet, sil',primary:true,fn:function(){ delete pf().assets[id]; save(); pfRender(); }},{label:'Vazgeç'}]); }
function pfTx(id){ var a=pf().assets[id]; if(!a)return; var q=aQty(a);
  dlg('İşlem — '+(a.name||clean(a.symbol||'')),
    '<div class="tpfield"><label>Yön</label><select class="fld" id="pftxSide" style="width:100%"><option value="buy">AL</option><option value="sell">SAT</option></select></div>'+
    '<div class="tpfield"><label>Adet</label><input class="fld" id="pftxQty" type="number" step="any" style="width:100%"></div>'+
    '<div class="tpfield"><label>Fiyat ('+psymCcy(aNativeCcy(a))+')</label><input class="fld" id="pftxPx" type="number" step="any" style="width:100%" '+(a.type==='stock'&&aCurUnit(a)!=null?('value="'+aCurUnit(a)+'"'):'')+'></div>'+
    '<div class="tpfield"><label>Tarih</label><input class="fld" id="pftxDate" type="date" value="'+new Date().toISOString().slice(0,10)+'" style="width:100%"></div>'+
    '<div class="tpfield"><label>Not (ops.)</label><input class="fld" id="pftxNote" style="width:100%"></div>'+
    '<div class="hint">Mevcut: '+(q==null?'0':fmt(q,q%1?4:0))+' adet.</div>',
    [{label:'Kaydet',primary:true,fn:function(){ var side=$('pftxSide').value,qq=parseFloat($('pftxQty').value),px=parseFloat($('pftxPx').value);
        if(isNaN(qq)||qq<=0||isNaN(px)) return false;
        if(side==='sell'&&qq>(aQty(a)||0)){ $('dlgBody').insertAdjacentHTML('beforeend','<div class="hint down">Elindekinden fazla satamazsın.</div>'); return false; }
        var d=$('pftxDate').value,tt=d?new Date(d+'T12:00:00').getTime():Date.now();
        a.tx=a.tx||[]; a.tx.push({t:tt,side:side,qty:qq,px:px,note:$('pftxNote').value||''}); save(); pfRender(); }},{label:'Vazgeç'}]); }

function pfaFillSyms(mk){ var dl=$('pfaSymList'); if(!dl) return;
  dl.innerHTML=STOCKS().filter(function(s){return s.market===mk;}).sort(function(a,b){return a.symbol.localeCompare(b.symbol);}).map(function(s){ return '<option value="'+clean(s.symbol)+'">'+(s.name||'')+'</option>'; }).join(''); }
function pfaToggle(){ var type=$('pfaType').value,isStock=(type==='stock'),mode=isStock?'qty':$('pfaMode').value;
  $('pfaStockBox').style.display=isStock?'block':'none'; $('pfaCcyBox').style.display=isStock?'none':'block'; $('pfaModeBox').style.display=isStock?'none':'block';
  $('pfaQtyBox').style.display=(mode==='qty')?'block':'none'; $('pfaAmtBox').style.display=(mode==='amount')?'block':'none';
  $('pfaUnitBox').style.display=(!isStock&&mode==='qty')?'block':'none'; if(isStock) pfaFillSyms($('pfaMkt').value); }
function pfAdd(editId){ var a=editId?pf().assets[editId]:null;
  var body='<div class="tpfield"><label>Ad</label><input class="fld" id="pfaName" style="width:100%" placeholder="örn. THY / Vadeli TL / QNB Fonu"></div>'+
    '<div class="tpfield"><label>Tür</label><select class="fld" id="pfaType" style="width:100%">'+PF_TYPES.map(function(T){return '<option value="'+T.k+'">'+T.t+'</option>';}).join('')+'</select></div>'+
    '<div id="pfaStockBox"><div class="tpfield"><label>Piyasa</label><select class="fld" id="pfaMkt" style="width:100%"><option>BIST</option><option>DAX</option><option>NASDAQ</option></select></div>'+
    '<div class="tpfield"><label>Sembol</label><input class="fld" id="pfaSym" list="pfaSymList" style="width:100%" placeholder="örn. THYAO"><datalist id="pfaSymList"></datalist><div class="tphelp">Panodaki hisselerden seç; fiyatı otomatik gelir.</div></div></div>'+
    '<div class="tpfield" id="pfaCcyBox"><label>Para birimi</label><select class="fld" id="pfaCcy" style="width:100%"><option>TRY</option><option>EUR</option><option>USD</option></select></div>'+
    '<div class="tpfield" id="pfaModeBox"><label>Değerleme</label><select class="fld" id="pfaMode" style="width:100%"><option value="qty">Adet bazlı (alım/satım + güncel birim fiyat)</option><option value="amount">Tutar bazlı (güncel toplam değeri gir)</option></select></div>'+
    '<div id="pfaQtyBox"><div class="tpfield"><label>Elindeki adet (ops.)</label><input class="fld" id="pfaQty" type="number" step="any" style="width:100%" placeholder="varsa başlangıç adedi"></div>'+
    '<div class="tpfield"><label>Ortalama alış fiyatı (ops.)</label><input class="fld" id="pfaAvg" type="number" step="any" style="width:100%"></div>'+
    '<div class="tpfield" id="pfaUnitBox"><label>Güncel birim fiyat</label><input class="fld" id="pfaUnit" type="number" step="any" style="width:100%"><div class="tphelp">Fiyatı otomatik gelmeyen varlıklarda güncel birim değeri buraya yaz.</div></div></div>'+
    '<div id="pfaAmtBox" style="display:none"><div class="tpfield"><label>Güncel toplam değer</label><input class="fld" id="pfaVal" type="number" step="any" style="width:100%"></div>'+
    '<div class="tpfield"><label>Maliyet / anapara (ops.)</label><input class="fld" id="pfaCost" type="number" step="any" style="width:100%"></div></div>'+
    '<div class="tpfield"><label>Not (ops.)</label><input class="fld" id="pfaNote" style="width:100%"></div>';
  dlg(a?'Varlığı düzenle':'Varlık ekle',body,[{label:'Kaydet',primary:true,fn:function(){ return pfSave(editId); }},{label:'Vazgeç'}]);
  var ts=$('pfaType'); if(ts) ts.onchange=function(){ var m=$('pfaMode'); m.value=(ts.value==='deposit'||ts.value==='other')?'amount':'qty'; pfaToggle(); };
  var mk=$('pfaMkt'); if(mk) mk.onchange=function(){ pfaFillSyms(mk.value); };
  var md=$('pfaMode'); if(md) md.onchange=pfaToggle;
  if(a){ $('pfaName').value=a.name||''; $('pfaType').value=a.type;
    if(a.type==='stock'){ $('pfaMkt').value=a.market||'BIST'; pfaFillSyms(a.market||'BIST'); $('pfaSym').value=a.symbol?clean(a.symbol):''; }
    $('pfaCcy').value=a.ccy||'TRY'; $('pfaMode').value=a.valMode||'qty';
    if(a.valMode==='amount'){ $('pfaVal').value=a.curValue!=null?a.curValue:''; $('pfaCost').value=a.cost!=null?a.cost:''; }
    else { $('pfaUnit').value=a.curUnit!=null?a.curUnit:''; var qf=$('pfaQty'),af=$('pfaAvg'); if(qf)qf.parentNode.style.display='none'; if(af)af.parentNode.style.display='none'; }
    $('pfaNote').value=a.note||''; }
  pfaToggle(); }
function pfSave(editId){ var name=$('pfaName').value.trim(),type=$('pfaType').value; if(!name) return false;
  var a=editId?pf().assets[editId]:{id:genId(),tx:[]}; a.name=name; a.type=type; a.note=$('pfaNote').value||'';
  if(type==='stock'){ var mk=$('pfaMkt').value,sym=pfResolve($('pfaSym').value,mk);
    if(!sym){ $('dlgBody').insertAdjacentHTML('beforeend','<div class="hint down">Sembol panoda bulunamadı.</div>'); return false; }
    a.market=mk; a.symbol=sym; a.ccy=ccyCode(mk); a.valMode='qty'; a.priceMode='auto'; a.curUnit=null; }
  else { a.market=null; a.symbol=null; a.ccy=$('pfaCcy').value; a.valMode=$('pfaMode').value; a.priceMode='manual';
    if(a.valMode==='amount'){ var vv=parseFloat($('pfaVal').value); a.curValue=isNaN(vv)?null:vv; var cc=parseFloat($('pfaCost').value); a.cost=isNaN(cc)?null:cc; }
    else { var uu=parseFloat($('pfaUnit').value); a.curUnit=isNaN(uu)?null:uu; } }
  if(!editId && a.valMode==='qty'){ var sq=parseFloat($('pfaQty').value),sa=parseFloat($('pfaAvg').value);
    if(!isNaN(sq)&&sq>0) a.tx=[{t:Date.now(),side:'buy',qty:sq,px:(isNaN(sa)?(aCurUnit(a)||0):sa),note:'başlangıç'}]; }
  pf().assets[a.id]=a; save(); pfRender(); }

function pfExport(){ var rows=[['Ad','Tür','Sembol','Para','Adet','Ort. maliyet','Güncel fiyat','Değer('+pcy()+')','Maliyet('+pcy()+')','K/Z('+pcy()+')']];
  Object.keys(pf().assets).forEach(function(id){ var a=pf().assets[id],v=aValueDisp(a),c=aCostDisp(a);
    rows.push([a.name,pfTypeLabel(a.type),a.symbol?clean(a.symbol):'',aNativeCcy(a),aQty(a),aAvgCost(a),aCurUnit(a),v,c,(v!=null&&c!=null)?v-c:'']); });
  B.downloadCSV('tum-yatirimlarim.csv',B.toCSV(rows)); }

/* --- geçmiş yükleme (XLSX/CSV; SheetJS gecikmeli) --- */
function pfLoadXLSX(cb){ if(window.XLSX){ cb(true); return; }
  var s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  s.onload=function(){ cb(!!window.XLSX); }; s.onerror=function(){ cb(false); }; document.head.appendChild(s); }
function pfDate(v){ if(v==null) return null; if(v instanceof Date) return v.toISOString().slice(0,10);
  var s=String(v).trim(),m;
  if(m=s.match(/^(\d{4})-(\d{2})-(\d{2})/)) return m[1]+'-'+m[2]+'-'+m[3];
  if(m=s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/)) return m[3]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2);
  var d=new Date(s); return isNaN(d)?null:d.toISOString().slice(0,10); }
function pfNum(v){ if(v==null) return null; if(typeof v==='number') return v;
  var s=String(v).replace(/[^\d,.\-]/g,'').replace(/\.(?=\d{3}\b)/g,'').replace(',','.'); var n=parseFloat(s); return isNaN(n)?null:n; }
function pfParse(file,cb){ pfLoadXLSX(function(ok){ if(!ok){ cb(null,'XLSX kütüphanesi yüklenemedi (internet?)'); return; }
  var fr=new FileReader(); fr.onload=function(){ try{ var wb=XLSX.read(new Uint8Array(fr.result),{type:'array',cellDates:true});
    var ws=wb.Sheets[wb.SheetNames[0]]; cb(XLSX.utils.sheet_to_json(ws,{header:1,raw:true}),null); }catch(e){ cb(null,e.message||'okunamadı'); } };
  fr.onerror=function(){ cb(null,'dosya okunamadı'); }; fr.readAsArrayBuffer(file); }); }
function pfUpload(){ dlg('Geçmiş değer yükle',
  '<p>Excel/CSV: <b>ilk sütun tarih</b>, <b>ikinci sütun değer</b>. Başlık satırı otomatik atlanır.</p>'+
  '<div class="tpfield"><label>Serinin para birimi</label><select class="fld" id="pfuCcy" style="width:100%"><option>TRY</option><option>USD</option><option>EUR</option></select></div>'+
  '<div class="tpfield"><label>Dosya</label><input class="fld" id="pfuFile" type="file" accept=".xlsx,.xls,.csv" style="width:100%"></div>'+
  '<div class="tpfield"><label>Tarihsel kur dosyası (opsiyonel)</label><input class="fld" id="pfuRates" type="file" accept=".xlsx,.xls,.csv" style="width:100%"><div class="tphelp">tarih · USDTRY · EURTRY sütunları — farklı para birimine <b>doğru</b> çeviri için. Vermezsen çeviri güncel kurla yapılır.</div></div>'+
  '<div class="hint" id="pfuMsg" style="margin-top:8px"></div>',
  [{label:'Yükle',primary:true,fn:function(){ pfDoUpload(); return false; }},{label:'Kapat'}]); }
function pfDoUpload(){ var f=$('pfuFile').files[0]; if(!f){ $('pfuMsg').textContent='Dosya seç.'; return; }
  var ccy=$('pfuCcy').value, rf=$('pfuRates').files[0]; $('pfuMsg').textContent='okunuyor…';
  pfParse(f,function(rows,err){ if(err){ $('pfuMsg').innerHTML='<span class="down">'+err+'</span>'; return; }
    var pts=[]; rows.forEach(function(r){ if(!r||r.length<2) return; var d=pfDate(r[0]),v=pfNum(r[1]); if(d&&v!=null) pts.push({date:d,value:v}); });
    if(!pts.length){ $('pfuMsg').innerHTML='<span class="down">Geçerli tarih/değer bulunamadı.</span>'; return; }
    var seen={}; pts.forEach(function(p){ seen[p.date]=p; }); var out=Object.keys(seen).sort().map(function(k){ return seen[k]; });
    pf().hist={ccy:ccy,points:out,rates:(pf().hist&&pf().hist.rates)||[]};
    function finish(){ save(); dlgClose(); pfRender(); }
    if(rf){ pfParse(rf,function(rr,e2){ if(!e2&&rr){ var R=[]; rr.forEach(function(r){ if(!r||r.length<3) return; var d=pfDate(r[0]),u=pfNum(r[1]),e=pfNum(r[2]); if(d&&u!=null&&e!=null) R.push({date:d,usdtry:u,eurtry:e}); });
      R.sort(function(a,b){return a.date<b.date?-1:1;}); pf().hist.rates=R; } finish(); }); }
    else finish(); }); }

})();
