/* ============================================================
   Borsa Pano — "Yatırımlarım" modülü v2 (harici dosya)
   - Ana ekran: her varlık TEK satır (adet + ortalama maliyet + değer + K/Z)
   - Aynı hisseyi tekrar alınca YENİ satır değil, aynı satırın ortalaması güncellenir
   - Satıra tıkla → varlığın kendi sayfası: özet + ort. maliyet + fiyat grafiği + işlem geçmişi
   - Üstte hızlı AL kutusu; varlık sayfasında AL/SAT + "Grafik & RSI"
   index.html'e tek <script src="portfoy.js"></script> ile bağlanır (köprü: B).
   ============================================================ */
(function(){
"use strict";
var B=null, ready=false;
var VIEW={mode:'list', id:null};   // 'list' | 'asset'

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
  '.pfarrow{color:var(--faint); font-weight:700}';
  var st=document.createElement('style'); st.id='pfStyle'; st.textContent=css; document.head.appendChild(st);
}

/* --- DOM enjeksiyonu --- */
function injectDOM(){
  if(!$('pfOpen')){ var sw=$('mktSwitch');
    if(sw){ var b=document.createElement('button'); b.id='pfOpen'; b.className='ghost accent'; b.style.fontWeight='700'; b.textContent='🧭 Yatırımlarım';
      sw.parentNode.insertBefore(b, sw.nextSibling); } }
  if(!document.querySelector('.tab[data-v="portfolio"]')){ var nav=$('nav');
    if(nav){ var t=document.createElement('button'); t.className='tab'; t.dataset.v='portfolio'; t.title='Yatırımlarım — tüm varlıkların tek ekranda'; t.textContent='Yatırımlarım'; nav.appendChild(t); } }
  if(!$('v-portfolio')){ var main=document.querySelector('main');
    if(main){ var sec=document.createElement('section'); sec.className='view card'; sec.id='v-portfolio'; sec.innerHTML='<div id="pfBody"></div>'; main.appendChild(sec); } }
}
function pfShow(){ VIEW={mode:'list',id:null}; pfRender(); B.goView('portfolio'); }
function wire(){ var o=$('pfOpen'); if(o) o.onclick=pfShow; var t=document.querySelector('.tab[data-v="portfolio"]'); if(t) t.onclick=pfShow; pf(); }

/* --- veri modeli --- */
var PF_TYPES=[{k:'stock',t:'Hisse'},{k:'deposit',t:'Mevduat'},{k:'fund',t:'Yatırım Fonu'},
  {k:'gold',t:'Altın / Döviz'},{k:'crypto',t:'Kripto'},{k:'other',t:'Diğer'}];
function pfTypeLabel(k){ for(var i=0;i<PF_TYPES.length;i++) if(PF_TYPES[i].k===k) return PF_TYPES[i].t; return k; }
function pf(){ var S=B.S;
  if(!S.pf) S.pf={disp:'TRY',assets:{},snaps:[],hist:{ccy:'TRY',points:[],rates:[]}};
  var p=S.pf; if(!p.assets)p.assets={}; if(!p.snaps)p.snaps=[]; if(!p.hist)p.hist={ccy:'TRY',points:[],rates:[]}; if(!p.disp)p.disp='TRY'; return p; }
function pcy(){ return pf().disp; }
function psymCcy(c){ return c==='TRY'?'₺':c==='USD'?'$':'€'; }
function psym(){ return psymCcy(pcy()); }
function pf$(v){ return v==null?'—':psym()+fmt(v); }

function toTRY(v,c){ var R=RATES(); if(v==null)return null; if(c==='TRY')return v; if(c==='EUR')return R.EURTRY?v*R.EURTRY:null; if(c==='USD')return R.USDTRY?v*R.USDTRY:null; return v; }
function frTRY(v,c){ var R=RATES(); if(v==null)return null; if(c==='TRY')return v; if(c==='EUR')return R.EURTRY?v/R.EURTRY:null; if(c==='USD')return R.USDTRY?v/R.USDTRY:null; return v; }
function pfConv(v,from,to){ return frTRY(toTRY(v,from),to); }

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
function aRealizedNative(a){ if(a.valMode==='amount') return 0; var q=0,cost=0,real=0;
  (a.tx||[]).slice().sort(function(x,y){return x.t-y.t;}).forEach(function(t){
    if(t.side==='sell'){ if(q>0){ var s=Math.min(t.qty,q),avg=cost/q; real+=(t.px-avg)*s; cost-=avg*s; q-=s; } }
    else { q+=t.qty; cost+=t.px*t.qty; } });
  return real; }

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
  if(find(sym)) return sym; if(find(sym+'.IS')) return sym+'.IS'; if(find(sym+'.DE')) return sym+'.DE'; return null; }
function pfAssetForSymbol(sym){ var A=pf().assets; for(var id in A){ if(A[id].type==='stock' && A[id].symbol===sym) return A[id]; } return null; }
function pfAssetForName(name,type){ var A=pf().assets, n=(name||'').trim().toLowerCase();
  for(var id in A){ var a=A[id]; if(a.type!=='stock' && a.type===type && (a.name||'').trim().toLowerCase()===n) return a; } return null; }

/* =============== RENDER dispatcher =============== */
function pfRender(){ var box=$('pfBody'); if(!box) return;
  if(VIEW.mode==='asset' && pf().assets[VIEW.id]) pfRenderAsset(box, pf().assets[VIEW.id]);
  else { VIEW={mode:'list',id:null}; pfRenderList(box); } }

/* =============== LİSTE ekranı =============== */
function pfRenderList(box){ var P=pf(), t=pfTotals(), cur=pcy();
  var curBtns=['TRY','USD','EUR'].map(function(c){ return '<button data-pc="'+c+'" class="'+(c===cur?'on':'')+'">'+psymCcy(c)+' '+c+'</button>'; }).join('');
  var stat='<div class="stat">'+
    '<div><div class="k">Toplam varlık</div><div class="v">'+pf$(t.value)+'</div></div>'+
    '<div><div class="k">Toplam maliyet</div><div class="v">'+pf$(t.cost)+'</div></div>'+
    '<div><div class="k">Toplam K/Z</div><div class="v '+pnlCls(t.pnl)+'">'+(t.pnl==null?'—':(t.pnl>0?'+':'')+pf$(t.pnl)+(t.cost>0?' ('+(t.pnl>0?'+':'')+fmt(t.pnl/t.cost*100,1)+'%)':''))+'</div></div></div>';
  var rows=Object.keys(P.assets).map(function(id){ return P.assets[id]; })
    .sort(function(a,b){ return (aValueDisp(b)||0)-(aValueDisp(a)||0); });
  var listHtml;
  if(!rows.length) listHtml='<div class="empty">Henüz varlık yok — üstteki kutuya sembol yazıp <b>AL</b>, ya da "＋ Diğer varlık" ile başla.</div>';
  else {
    listHtml='<div class="scroll"><table><thead><tr><th class="l">Varlık</th><th>Adet</th><th>Ort. maliyet</th><th>Güncel</th><th title="Varlığın kendi para birimindeki güncel değeri">Orijinal</th><th title="Seçili gösterim para birimine ('+psym()+') çevrilmiş değer">Değer</th><th>K/Z</th><th></th></tr></thead><tbody>'+
    rows.map(function(a){ var q=aQty(a),ac=aAvgCost(a),u=aCurUnit(a),v=aValueDisp(a),c=aCostDisp(a),pnl=(v!=null&&c!=null)?v-c:null,pct=(c>0&&pnl!=null)?pnl/c*100:null,nc=aNativeCcy(a);
      return '<tr data-open="'+a.id+'"><td><b>'+(a.name||clean(a.symbol||'—'))+'</b>'+(a.symbol?' <span class="nm">'+clean(a.symbol)+'</span>':'')+' <span class="pfbadge">'+pfTypeLabel(a.type)+'</span><div class="nm">'+psymCcy(nc)+(a.note?(' · '+a.note.slice(0,26)):'')+'</div></td>'+
        '<td>'+(q==null?'—':fmt(q,q%1?4:0))+'</td>'+
        '<td>'+(ac==null?'—':fmt(ac))+'</td>'+
        '<td>'+(u==null?'—':fmt(u))+'</td>'+
        '<td>'+(function(){ var vn=aValueNative(a); return vn==null?'—':'<span class="nm" style="font-size:13px">'+psymCcy(nc)+fmt(vn)+'</span>'; })()+'</td>'+
        '<td><b>'+pf$(v)+'</b></td>'+
        '<td class="'+pnlCls(pnl)+'">'+(pnl==null?'—':(pnl>0?'+':'')+pf$(pnl)+(pct!=null?' ('+(pct>0?'+':'')+fmt(pct,1)+'%)':''))+'</td>'+
        '<td class="pfarrow">›</td></tr>'; }).join('')+'</tbody></table></div>';
  }
  var ser=pfSeries();
  var chart=ser.pts.length?(B.lineChart(ser.pts,'#0bbfa6',psym())+(ser.warn?'<div class="hint down" style="margin-top:6px">⚠ Bazı geçmiş noktalar tarihsel kur olmadığı için güncel kurla çevrildi.</div>':'')):'<div class="empty">Toplam portföy grafiği için "Günü kaydet" ya da geçmiş yükle.</div>';
  var syms=STOCKS().slice().sort(function(a,b){return a.symbol.localeCompare(b.symbol);}).map(function(s){ return '<option value="'+clean(s.symbol)+'">'+(s.name||'')+'</option>'; }).join('');
  box.innerHTML=''+
    '<div class="pfhead"><div><h2 style="margin:0; font-size:22px">Yatırımlarım</h2><div class="sub">Her varlık tek satır. Satıra tıkla → o varlığın sayfası. Değerler '+psym()+'.</div></div><div class="pfcur" id="pfCur">'+curBtns+'</div></div>'+
    stat+
    '<div class="pftypes" id="pfTypeBar">'+PF_TYPES.map(function(T){ return '<button data-t="'+T.k+'"'+(T.k===pfAddType?' class="on"':'')+'>'+T.t+'</button>'; }).join('')+'</div>'+
    '<div class="pfquick" id="pfQuickBar"></div>'+
    '<h3 style="font-size:16px; margin:0 0 8px">Toplam portföy değeri</h3>'+chart+
    '<div style="margin-top:18px">'+listHtml+'</div>'+
    '<div class="disclaimer">Bu ekran senin girdiğin verilere dayanır ve bulut hesabınla eşitlenir. Hisse fiyatları ~15 dk gecikmeli panodan; mevduat/fon/altın/diğer değerlerini kendin güncellersin. Yatırım tavsiyesi değildir.</div>';
  box.querySelectorAll('#pfCur button').forEach(function(b){ b.onclick=function(){ pf().disp=b.dataset.pc; save(); pfRender(); }; });
  box.querySelectorAll('tr[data-open]').forEach(function(tr){ tr.onclick=function(){ VIEW={mode:'asset',id:tr.dataset.open}; pfRender(); }; });
  $('pfTypeBar').querySelectorAll('button').forEach(function(b){ b.onclick=function(){ pfAddType=b.dataset.t; $('pfTypeBar').querySelectorAll('button').forEach(function(x){ x.classList.toggle('on', x.dataset.t===pfAddType); }); pfPaintQuick(syms); }; });
  pfPaintQuick(syms);
}
var pfAddType='stock';
function pfPaintQuick(syms){ var bar=$('pfQuickBar'); if(!bar) return;
  var tools='<button class="ghost" id="pfSaveDayBtn">Günü kaydet</button>'+
    '<button class="ghost" id="pfUploadBtn">⤒ Geçmiş yükle</button>'+
    '<button class="ghost" id="pfCsvBtn">⤓ Dışa aktar</button>';
  if(pfAddType==='stock'){
    bar.innerHTML='<input class="search fld" id="pfQSym" list="pfQList" placeholder="hisse ara (örn. ENKAI) → AL"><datalist id="pfQList">'+(syms||'')+'</datalist>'+
      '<button class="go buy" id="pfQBuy" style="padding:10px 18px">AL</button><span style="flex:1"></span>'+tools;
    $('pfQBuy').onclick=pfQuickBuy;
    $('pfQSym').onkeydown=function(e){ if(e.key==='Enter') pfQuickBuy(); };
  } else {
    var lbl=pfTypeLabel(pfAddType);
    bar.innerHTML='<div class="hint" style="flex:1; min-width:160px"><b>'+lbl+'</b> eklemek için formu aç.</div>'+
      '<button class="go buy" id="pfAddTypeBtn" style="padding:10px 18px">＋ '+lbl+' ekle</button><span style="flex:1"></span>'+tools;
    $('pfAddTypeBtn').onclick=function(){ pfAddOther(null, pfAddType); };
  }
  $('pfSaveDayBtn').onclick=pfSaveDay; $('pfUploadBtn').onclick=pfUpload; $('pfCsvBtn').onclick=pfExport;
}
function pfQuickBuy(){ var raw=$('pfQSym').value, sym=pfResolve(raw); if(!sym){ dlg('Bulunamadı','<p><b>'+(raw||'')+'</b> panodaki hisseler arasında yok. Listeden seç ya da "＋ Diğer varlık" kullan.</p>',[{label:'Tamam',primary:true}]); return; }
  var a=pfAssetForSymbol(sym); if(a){ pfTxDialog(a,null,'buy'); } else pfTxDialog(null, sym); }

/* =============== VARLIK sayfası =============== */
function pfRenderAsset(box, a){
  var q=aQty(a),ac=aAvgCost(a),u=aCurUnit(a),v=aValueDisp(a),c=aCostDisp(a),pnl=(v!=null&&c!=null)?v-c:null,pct=(c>0&&pnl!=null)?pnl/c*100:null,nc=aNativeCcy(a);
  var real=pfConv(aRealizedNative(a),nc,pcy());
  var isStock=(a.type==='stock');
  var head='<button class="back" id="pfBack">← Yatırımlarım</button>'+
    '<div class="dhead"><div><h2 style="margin:0; font-size:24px">'+(a.name||clean(a.symbol||'—'))+(a.symbol?' <span class="nm" style="font-size:15px">'+clean(a.symbol)+'</span>':'')+' <span class="pfbadge">'+pfTypeLabel(a.type)+'</span></h2>'+
      '<div class="nm" style="font-size:13px; margin-top:4px">'+psymCcy(nc)+(a.note?(' · '+a.note):'')+'</div></div>'+
      '<div style="text-align:right"><div class="px">'+pf$(v)+'</div><div class="'+pnlCls(pnl)+'" style="font-weight:700">'+(pnl==null?'':(pnl>0?'+':'')+pf$(pnl)+(pct!=null?' ('+(pct>0?'+':'')+fmt(pct,1)+'%)':''))+'</div></div></div>';
  var metrics='<div class="metrics">'+
    '<div class="metric"><div class="k">Adet</div><div class="v">'+(q==null?'—':fmt(q,q%1?4:0))+'</div></div>'+
    '<div class="metric"><div class="k">Ortalama maliyet</div><div class="v">'+(ac==null?(a.valMode==='amount'?'elle değer':'—'):psymCcy(nc)+fmt(ac))+'</div></div>'+
    '<div class="metric"><div class="k">Güncel birim fiyat</div><div class="v">'+(u==null?'—':psymCcy(nc)+fmt(u))+'</div></div>'+
    '<div class="metric"><div class="k">Toplam maliyet</div><div class="v">'+pf$(c)+'</div></div>'+
    '<div class="metric"><div class="k">Güncel değer</div><div class="v">'+pf$(v)+'</div></div>'+
    '<div class="metric"><div class="k">Açık K/Z</div><div class="v '+pnlCls(pnl)+'">'+(pnl==null?'—':(pnl>0?'+':'')+pf$(pnl))+'</div></div>'+
    (a.valMode==='qty'?'<div class="metric"><div class="k">Gerçekleşen K/Z (satışlar)</div><div class="v '+pnlCls(real)+'">'+(real?((real>0?'+':'')+pf$(real)):pf$(0))+'</div></div>':'')+
    '</div>';
  var actions='<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:18px">'+
    (a.valMode==='qty'?'<button class="go buy" id="pfBuy" style="padding:10px 18px">AL</button><button class="go sell" id="pfSell" style="padding:10px 18px">SAT</button>':'')+
    (isStock?'<button class="ghost accent" id="pfChartFull">📈 Grafik & RSI (detay)</button>':'')+
    '<button class="ghost" id="pfEdit">Düzenle</button><button class="ghost" id="pfDel">Sil</button></div>';
  var tx=(a.tx||[]).slice().sort(function(x,y){return y.t-x.t;});
  var txHtml=tx.length?tx.map(function(x){ var sc=x.side==='buy'?'up':'down', st=x.side==='buy'?'AL':'SAT';
    return '<div class="e"><span><b class="'+sc+'">'+st+'</b> '+fmt(x.qty,x.qty%1?4:0)+' × '+psymCcy(nc)+fmt(x.px)+' = '+psymCcy(nc)+fmt(x.qty*x.px)+(x.note?(' · '+x.note):'')+'</span><span class="t">'+new Date(x.t).toLocaleDateString('tr-TR')+'</span></div>'; }).join(''):'<div class="empty">işlem yok</div>';
  box.innerHTML=head+metrics+actions+
    '<h3 style="font-size:16px; margin:0 0 8px">'+(isStock?'Fiyat geçmişi':'Değer')+'</h3><div id="pfAssetChart"></div>'+
    '<h3 style="font-size:16px; margin:20px 0 8px">Bu varlıktaki işlemlerim</h3><div class="log scroll" style="max-height:300px">'+txHtml+'</div>'+
    '<div class="disclaimer">Ortalama maliyet, tüm alış/satışlar sonrası ağırlıklı ortalamadır. Satışta ortalama maliyet düşülerek gerçekleşen K/Z hesaplanır. Yatırım tavsiyesi değildir.</div>';
  $('pfBack').onclick=function(){ VIEW={mode:'list',id:null}; pfRender(); };
  var bb=$('pfBuy'); if(bb) bb.onclick=function(){ pfTxDialog(a,null,'buy'); };
  var sb=$('pfSell'); if(sb) sb.onclick=function(){ pfTxDialog(a,null,'sell'); };
  var cf=$('pfChartFull'); if(cf) cf.onclick=function(){ if(a.symbol) B.openStock(a.symbol); };
  $('pfEdit').onclick=function(){ if(isStock) dlg('Notu düzenle','<div class="tpfield"><label>Not</label><input class="fld" id="pfEdNote" style="width:100%" value="'+(a.note||'').replace(/"/g,'&quot;')+'"></div><div class="hint">Hisse varlıkları AL/SAT ile yönetilir; burada yalnız notu değiştirebilirsin.</div>',[{label:'Kaydet',primary:true,fn:function(){ a.note=$('pfEdNote').value||''; save(); pfRender(); }},{label:'Vazgeç'}]); else pfAddOther(a.id); };
  $('pfDel').onclick=function(){ pfDel(a.id); };
  pfAssetChart(a, $('pfAssetChart'));
}
function pfAssetChart(a, mount){ if(!mount) return;
  if(a.type!=='stock'||!a.symbol){ mount.innerHTML='<div class="hint">Bu varlığın değerini elle güncelliyorsun; otomatik fiyat geçmişi yok. Toplam portföy değeri grafiği için ana ekranda "Günü kaydet".</div>'; return; }
  function draw(){ var H=B.HIST; if(!H||!H[a.symbol]||!H[a.symbol].d){ mount.innerHTML='<div class="hint">Fiyat geçmişi bulunamadı. Mum grafiği, RSI ve çizimler için <b>Grafik & RSI</b>.</div>'; return; }
    var d=H[a.symbol].d.slice(-250).map(function(b){ return {y:b[4], label:new Date(b[0]*1000).toLocaleDateString('tr-TR').slice(0,5)}; });
    mount.innerHTML=B.lineChart(d,'#3b82f6',psymCcy(aNativeCcy(a)))+'<div class="hint" style="margin-top:6px">Son ~1 yıl fiyatı. Ortalama maliyetin: <b>'+(aAvgCost(a)==null?'—':psymCcy(aNativeCcy(a))+fmt(aAvgCost(a)))+'</b>. Mum grafiği, RSI, indikatörler ve çizimler için <b>Grafik & RSI</b>.</div>'; }
  if(B.HIST && B.HIST[a.symbol]) draw();
  else if(B.loadHistory){ mount.innerHTML='<div class="hint">grafik yükleniyor…</div>'; B.loadHistory(function(){ draw(); }); }
  else mount.innerHTML='<div class="hint">Fiyat grafiği için <b>Grafik & RSI</b>ı aç.</div>';
}

/* =============== İŞLEM (AL/SAT) — hisse için tek satır birleşme =============== */
function pfTxDialog(asset, newSym, forceSide){
  var isNew=!asset;
  var nc = asset?aNativeCcy(asset):ccyCode(find(newSym)?find(newSym).market:'BIST');
  var s = asset ? (asset.symbol?find(asset.symbol):null) : find(newSym);
  var title = asset ? ((asset.name||clean(asset.symbol||''))+' — işlem') : ('AL — '+clean(newSym));
  var q = asset?aQty(asset):0;
  var sideSel = (isNew) ? '<input type="hidden" id="pftxSide" value="buy">'
    : '<div class="tpfield"><label>Yön</label><select class="fld" id="pftxSide" style="width:100%"><option value="buy"'+(forceSide!=='sell'?' selected':'')+'>AL</option><option value="sell"'+(forceSide==='sell'?' selected':'')+'>SAT</option></select></div>';
  dlg(title, sideSel+
    '<div class="tpfield"><label>Adet</label><input class="fld" id="pftxQty" type="number" step="any" style="width:100%"></div>'+
    '<div class="tpfield"><label>Fiyat ('+psymCcy(nc)+')</label><input class="fld" id="pftxPx" type="number" step="any" style="width:100%"'+((s&&s.price!=null)?(' value="'+s.price+'"'):'')+'></div>'+
    '<div class="tpfield"><label>Tarih</label><input class="fld" id="pftxDate" type="date" value="'+new Date().toISOString().slice(0,10)+'" style="width:100%"></div>'+
    '<div class="tpfield"><label>Not (ops.)</label><input class="fld" id="pftxNote" style="width:100%"></div>'+
    (asset?('<div class="hint">Mevcut: '+fmt(q,q%1?4:0)+' adet. AL yaparsan ortalama maliyet güncellenir; yeni satır <b>açılmaz</b>.</div>'):'<div class="hint">Bu semboldeki ilk alımın. Sonraki alımlar aynı satırda birleşir.</div>'),
    [{label:'Kaydet',primary:true,fn:function(){
      var side=$('pftxSide').value, qq=parseFloat($('pftxQty').value), px=parseFloat($('pftxPx').value);
      if(isNaN(qq)||qq<=0||isNaN(px)) return false;
      var target=asset;
      if(!target){ var mk=(find(newSym)?find(newSym).market:'BIST'); target={id:genId(), name:clean(newSym), type:'stock', market:mk, symbol:newSym, ccy:ccyCode(mk), valMode:'qty', priceMode:'auto', curUnit:null, tx:[]}; }
      if(side==='sell' && qq>(aQty(target)||0)){ $('dlgBody').insertAdjacentHTML('beforeend','<div class="hint down">Elindekinden fazla satamazsın.</div>'); return false; }
      var d=$('pftxDate').value, tt=d?new Date(d+'T12:00:00').getTime():Date.now();
      target.tx=target.tx||[]; target.tx.push({t:tt, side:side, qty:qq, px:px, note:$('pftxNote').value||''});
      pf().assets[target.id]=target; save();
      if(isNew){ VIEW={mode:'asset', id:target.id}; } pfRender();
    }},{label:'Vazgeç'}]); }

/* =============== DİĞER varlık (mevduat/fon/altın/kripto/diğer) =============== */
function pfaToggle(){ var mode=$('pfaMode').value;
  $('pfaQtyBox').style.display=(mode==='qty')?'block':'none'; $('pfaAmtBox').style.display=(mode==='amount')?'block':'none'; }
function pfAddOther(editId, preType){ var a=editId?pf().assets[editId]:null;
  var types=PF_TYPES.filter(function(T){return T.k!=='stock';});
  var body='<div class="tpfield"><label>Ad</label><input class="fld" id="pfaName" style="width:100%" placeholder="örn. Vadeli TL / QNB Fonu / Gram Altın"></div>'+
    '<div class="tpfield"><label>Tür</label><select class="fld" id="pfaType" style="width:100%">'+types.map(function(T){return '<option value="'+T.k+'">'+T.t+'</option>';}).join('')+'</select></div>'+
    '<div class="tpfield"><label>Para birimi</label><select class="fld" id="pfaCcy" style="width:100%"><option>TRY</option><option>EUR</option><option>USD</option></select></div>'+
    '<div class="tpfield"><label>Değerleme</label><select class="fld" id="pfaMode" style="width:100%"><option value="amount">Tutar bazlı (güncel toplam değeri gir)</option><option value="qty">Adet bazlı (alım/satım + birim fiyat)</option></select></div>'+
    '<div id="pfaAmtBox"><div class="tpfield"><label>Güncel toplam değer</label><input class="fld" id="pfaVal" type="number" step="any" style="width:100%"></div>'+
      '<div class="tpfield"><label>Maliyet / anapara (ops.)</label><input class="fld" id="pfaCost" type="number" step="any" style="width:100%"></div></div>'+
    '<div id="pfaQtyBox" style="display:none"><div class="tpfield"><label>Elindeki adet (ops.)</label><input class="fld" id="pfaQty" type="number" step="any" style="width:100%"></div>'+
      '<div class="tpfield"><label>Ortalama alış fiyatı (ops.)</label><input class="fld" id="pfaAvg" type="number" step="any" style="width:100%"></div>'+
      '<div class="tpfield"><label>Güncel birim fiyat</label><input class="fld" id="pfaUnit" type="number" step="any" style="width:100%"></div></div>'+
    '<div class="tpfield"><label>Not (ops.)</label><input class="fld" id="pfaNote" style="width:100%"></div>';
  dlg(a?'Varlığı düzenle':'Diğer varlık ekle',body,[{label:'Kaydet',primary:true,fn:function(){ return pfSaveOther(editId); }},{label:'Vazgeç'}]);
  var md=$('pfaMode'); if(md) md.onchange=pfaToggle;
  if(a){ $('pfaName').value=a.name||''; $('pfaType').value=a.type; $('pfaCcy').value=a.ccy||'TRY'; $('pfaMode').value=a.valMode||'amount';
    if((a.valMode||'amount')==='amount'){ $('pfaVal').value=a.curValue!=null?a.curValue:''; $('pfaCost').value=a.cost!=null?a.cost:''; }
    else { $('pfaUnit').value=a.curUnit!=null?a.curUnit:''; var qf=$('pfaQty'),af=$('pfaAvg'); if(qf)qf.parentNode.style.display='none'; if(af)af.parentNode.style.display='none'; }
    $('pfaNote').value=a.note||''; }
  if(!a && preType && preType!=='stock'){ var ty=$('pfaType'); if(ty) ty.value=preType;
    if(preType==='deposit'||preType==='other'){ $('pfaMode').value='amount'; } }
  pfaToggle(); }
function pfSaveOther(editId){ var name=$('pfaName').value.trim(); if(!name) return false;
  var typeSel=$('pfaType').value;
  if(!editId){ var ex=pfAssetForName(name,typeSel);
    if(ex){   // aynı ad+tür → yeni satır açma, mevcuda ekle/güncelle
      if(ex.valMode==='qty'){
        var uu=parseFloat($('pfaUnit').value); if(!isNaN(uu)) ex.curUnit=uu;
        var sq=parseFloat($('pfaQty').value), sa=parseFloat($('pfaAvg').value);
        if(!isNaN(sq)&&sq>0){ ex.tx=ex.tx||[]; ex.tx.push({t:Date.now(),side:'buy',qty:sq,px:(isNaN(sa)?(ex.curUnit||0):sa),note:$('pfaNote').value||'ekleme'}); }
      } else {
        var vv=parseFloat($('pfaVal').value); if(!isNaN(vv)) ex.curValue=vv;
        var cc=parseFloat($('pfaCost').value); if(!isNaN(cc)) ex.cost=cc;
      }
      var nn=$('pfaNote').value; if(nn) ex.note=nn;
      save(); VIEW={mode:'asset',id:ex.id}; pfRender(); return;
    }
  }
  var a=editId?pf().assets[editId]:{id:genId(),tx:[]};
  a.name=name; a.type=$('pfaType').value; a.market=null; a.symbol=null; a.ccy=$('pfaCcy').value; a.valMode=$('pfaMode').value; a.priceMode='manual'; a.note=$('pfaNote').value||'';
  if(a.valMode==='amount'){ var vv=parseFloat($('pfaVal').value); a.curValue=isNaN(vv)?null:vv; var cc=parseFloat($('pfaCost').value); a.cost=isNaN(cc)?null:cc; }
  else { var uu=parseFloat($('pfaUnit').value); a.curUnit=isNaN(uu)?null:uu;
    if(!editId){ var sq=parseFloat($('pfaQty').value),sa=parseFloat($('pfaAvg').value); if(!isNaN(sq)&&sq>0) a.tx=[{t:Date.now(),side:'buy',qty:sq,px:(isNaN(sa)?(a.curUnit||0):sa),note:'başlangıç'}]; } }
  pf().assets[a.id]=a; save(); if(!editId){ VIEW={mode:'asset',id:a.id}; } pfRender(); }
function pfDel(id){ var a=pf().assets[id]; if(!a)return;
  dlg('Varlığı sil','<p><b>'+(a.name||clean(a.symbol||''))+'</b> ve tüm işlem geçmişi silinsin mi?</p>',
    [{label:'Evet, sil',primary:true,fn:function(){ delete pf().assets[id]; VIEW={mode:'list',id:null}; save(); pfRender(); }},{label:'Vazgeç'}]); }

/* =============== dışa aktar + geçmiş yükle =============== */
function pfExport(){ var rows=[['Ad','Tür','Sembol','Para','Adet','Ort. maliyet','Güncel fiyat','Değer('+pcy()+')','Maliyet('+pcy()+')','K/Z('+pcy()+')']];
  Object.keys(pf().assets).forEach(function(id){ var a=pf().assets[id],v=aValueDisp(a),c=aCostDisp(a);
    rows.push([a.name,pfTypeLabel(a.type),a.symbol?clean(a.symbol):'',aNativeCcy(a),aQty(a),aAvgCost(a),aCurUnit(a),v,c,(v!=null&&c!=null)?v-c:'']); });
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
function pfUpload(){ dlg('Toplam portföy geçmişini yükle',
  '<p>Excel/CSV: <b>ilk sütun tarih</b>, <b>ikinci sütun toplam değer</b>. Başlık satırı otomatik atlanır. Bu, üstteki <b>toplam portföy grafiğini</b> besler.</p>'+
  '<div class="tpfield"><label>Serinin para birimi</label><select class="fld" id="pfuCcy" style="width:100%"><option>TRY</option><option>USD</option><option>EUR</option></select></div>'+
  '<div class="tpfield"><label>Dosya</label><input class="fld" id="pfuFile" type="file" accept=".xlsx,.xls,.csv" style="width:100%"></div>'+
  '<div class="hint" id="pfuMsg" style="margin-top:8px"></div>',
  [{label:'Yükle',primary:true,fn:function(){ pfDoUpload(); return false; }},{label:'Kapat'}]); }
function pfDoUpload(){ var f=$('pfuFile').files[0]; if(!f){ $('pfuMsg').textContent='Dosya seç.'; return; }
  var ccy=$('pfuCcy').value; $('pfuMsg').textContent='okunuyor…';
  pfParse(f,function(rows,err){ if(err){ $('pfuMsg').innerHTML='<span class="down">'+err+'</span>'; return; }
    var pts=[]; rows.forEach(function(r){ if(!r||r.length<2) return; var d=pfDate(r[0]),v=pfNum(r[1]); if(d&&v!=null) pts.push({date:d,value:v}); });
    if(!pts.length){ $('pfuMsg').innerHTML='<span class="down">Geçerli tarih/değer bulunamadı.</span>'; return; }
    var seen={}; pts.forEach(function(p){ seen[p.date]=p; }); var out=Object.keys(seen).sort().map(function(k){ return seen[k]; });
    pf().hist={ccy:ccy,points:out,rates:(pf().hist&&pf().hist.rates)||[]}; save(); dlgClose(); pfRender(); }); }

})();
