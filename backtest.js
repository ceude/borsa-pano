/* ================= GEÇMİŞTE TEST (backtest) =================
   Veri: history.js → HIST[sym].d = [zaman, açılış, yüksek, düşük, kapanış] günlük.
   Test edilen kural (şeffaf, günlük): fiyat MA'yı YUKARI keserse al ·
   stop = giriş − ATRçarpanı×ATR14 · hedef = giriş + R katı · kapanış MA altına
   düşerse çık. Pozisyon boyutu: özkaynağın risk%'i / stop mesafesi (tek pozisyon
   en çok %25). Spread+komisyon isteğe bağlı uygulanır. */
function btPrep(bars, maN){
  var n=bars.length, close=[], ma=[], atr=[], trs=[], i;
  for(i=0;i<n;i++) close.push(bars[i][4]);
  var s=0;
  for(i=0;i<n;i++){ s+=close[i]; if(i>=maN) s-=close[i-maN]; ma.push(i>=maN-1? s/maN : null); }
  for(i=0;i<n;i++){ var h=bars[i][2], l=bars[i][3], pc=i?close[i-1]:close[i];
    trs.push(Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc))); }
  var s2=0;
  for(i=0;i<n;i++){ s2+=trs[i]; if(i>=14) s2-=trs[i-14]; atr.push(i>=13? s2/14 : null); }
  return {close:close, ma:ma, atr:atr};
}
function btLabel(t){ return new Date(t*1000).toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit'}); }
function btCfg(){
  return {
    bars:    Math.max(60, parseInt($('btPeriod').value,10)||250),
    cash:    parseFloat($('btCash').value) || (MK==='BIST'?100000:10000),
    risk:    parseFloat($('btRisk').value)||1,
    atrMult: parseFloat($('btAtr').value)||1.5,
    targetR: parseFloat($('btTargetR').value)||2,
    maN:     Math.max(5, parseInt($('btMa').value,10)||50),
    maxPos:  Math.max(1, parseInt($('btMaxPos').value,10)||5),
    costs:   $('btCosts').checked
  };
}
function btExecute(){
  var cfg=btCfg();
  var sp   = cfg.costs? spreadPct()/100 : 0;
  var comm = cfg.costs? commOf(MK) : 0;
  var syms=marketStocks().map(function(s){return s.symbol;})
    .filter(function(sym){ var h=HIST[sym]; return h && h.d && h.d.length>cfg.maN+25; });
  if(!syms.length){ $('btStats').innerHTML='<div class="hint down">Bu piyasada geçmiş veri bulunamadı (history.js içinde bu semboller yok).</div>'; return; }

  var D={}, dset={};
  syms.forEach(function(sym){
    var bars=HIST[sym].d.slice(-cfg.bars);
    D[sym]={bars:bars, p:btPrep(bars,cfg.maN), idx:{}};
    bars.forEach(function(b,i){ D[sym].idx[b[0]]=i; dset[b[0]]=1; });
  });
  var days=Object.keys(dset).map(Number).sort(function(a,b){return a-b;});
  if(days.length<30){ $('btStats').innerHTML='<div class="hint down">Yeterli gün yok.</div>'; return; }

  var cash=cfg.cash, pos={}, trades=[], eq=[], peak=0, maxDD=0, openCount=0;
  function sell(sym, price, t, why){
    var P=pos[sym]; if(!P) return;
    var fill=price*(1-sp), proceeds=fill*P.qty-comm;
    cash+=proceeds;
    var pnl=proceeds-P.cost;
    trades.push({sym:sym,tIn:P.t,tOut:t,qty:P.qty,inPx:P.fill,outPx:fill,pnl:pnl,
                 r:(P.risk>0? pnl/P.risk : null), why:why});
    delete pos[sym]; openCount--;
  }
  days.forEach(function(t){
    Object.keys(pos).forEach(function(sym){
      var d=D[sym], i=d.idx[t]; if(i==null) return;
      var b=d.bars[i], P=pos[sym];
      if(b[3]<=P.stop)        sell(sym,P.stop,t,'stop');          // aynı gün ikisi de olursa stop varsayılır (kötümser)
      else if(b[2]>=P.target) sell(sym,P.target,t,'hedef');
      else if(d.p.ma[i]!=null && b[4]<d.p.ma[i]) sell(sym,b[4],t,'trend kırıldı');
    });
    var mv=0;
    Object.keys(pos).forEach(function(sym){ var d=D[sym], i=d.idx[t];
      mv += (i!=null? d.bars[i][4]*pos[sym].qty : pos[sym].cost); });
    var equity=cash+mv;
    eq.push({y:equity, label:btLabel(t)});
    if(equity>peak) peak=equity;
    if(peak>0){ var dd=(peak-equity)/peak*100; if(dd>maxDD) maxDD=dd; }

    if(openCount<cfg.maxPos){
      var cands=[];
      syms.forEach(function(sym){
        if(pos[sym]) return;
        var d=D[sym], i=d.idx[t]; if(i==null||i<1) return;
        var ma=d.p.ma[i], mp=d.p.ma[i-1], a=d.p.atr[i];
        if(ma==null||mp==null||a==null||a<=0) return;
        var c=d.p.close[i], cp=d.p.close[i-1];
        if(cp<=mp && c>ma) cands.push({sym:sym,c:c,atr:a,ext:(c/ma-1)*100});
      });
      cands.sort(function(a,b){return a.ext-b.ext;});
      for(var k=0;k<cands.length && openCount<cfg.maxPos;k++){
        var x=cands[k];
        var stop=x.c-cfg.atrMult*x.atr, per=x.c-stop; if(per<=0) continue;
        var fill=x.c*(1+sp);
        var qty=Math.min(Math.floor(equity*cfg.risk/100/per),
                         Math.floor(equity*0.25/fill),
                         Math.floor((cash-comm)/fill));
        if(qty<1) continue;
        var cost=fill*qty+comm; if(cost>cash) continue;
        cash-=cost; openCount++;
        pos[x.sym]={qty:qty, fill:fill, cost:cost, stop:stop,
                    target:x.c+cfg.targetR*per, risk:per*qty, t:t};
      }
    }
  });
  var lastT=days[days.length-1];
  Object.keys(pos).forEach(function(sym){
    var d=D[sym], i=d.idx[lastT];
    sell(sym, (i!=null? d.bars[i][4] : pos[sym].fill), lastT, 'test sonu');
  });
  var finalEq=cash;
  eq.push({y:finalEq, label:btLabel(lastT)});

  var bh=0, bhN=0;
  syms.forEach(function(sym){ var b=D[sym].bars; if(b.length>1){ bh+=(b[b.length-1][4]/b[0][4]-1)*100; bhN++; } });
  bh = bhN? bh/bhN : null;

  btRender(cfg, eq, trades, maxDD, finalEq, bh, days.length, syms.length);
}
function btRender(cfg, eq, trades, maxDD, finalEq, bh, nDays, nSyms){
  var ret=(finalEq/cfg.cash-1)*100;
  var wins=trades.filter(function(t){return t.pnl>0;});
  var loss=trades.filter(function(t){return t.pnl<=0;});
  var gp=wins.reduce(function(a,t){return a+t.pnl;},0);
  var gl=Math.abs(loss.reduce(function(a,t){return a+t.pnl;},0));
  var pf=gl>0? gp/gl : null;
  var rs=trades.filter(function(t){return t.r!=null;}).map(function(t){return t.r;});
  var avgR=rs.length? rs.reduce(function(a,b){return a+b;},0)/rs.length : null;
  var c=ccySym(MK);
  $('btStats').innerHTML=
    '<div class="metrics">'+
    '<div class="metric"><div class="k">Toplam getiri</div><div class="v '+pnlCls(ret)+'">'+(ret>0?'+':'')+fmt(ret,1)+'%</div></div>'+
    '<div class="metric"><div class="k">Son özkaynak</div><div class="v">'+c+fmt(finalEq,0)+'</div></div>'+
    '<div class="metric"><div class="k">Al&amp;tut ortalaması</div><div class="v '+pnlCls(bh)+'">'+(bh==null?'—':(bh>0?'+':'')+fmt(bh,1)+'%')+'</div></div>'+
    '<div class="metric"><div class="k">İşlem sayısı</div><div class="v">'+trades.length+'</div></div>'+
    '<div class="metric"><div class="k">Kazanma oranı</div><div class="v">'+(trades.length? Math.round(wins.length/trades.length*100)+'%':'—')+'</div></div>'+
    '<div class="metric"><div class="k">Ortalama R</div><div class="v '+pnlCls(avgR)+'">'+(avgR==null?'—':(avgR>0?'+':'')+fmt(avgR,2)+'R')+'</div></div>'+
    '<div class="metric"><div class="k">Kâr faktörü</div><div class="v">'+(pf==null?'—':fmt(pf,2))+'</div></div>'+
    '<div class="metric"><div class="k">Maks. düşüş</div><div class="v down">−'+fmt(maxDD,1)+'%</div></div>'+
    '</div>'+
    '<div class="hint" style="margin-top:8px">'+nSyms+' hisse · '+nDays+' işlem günü · MA'+cfg.maN+
    ' · stop '+cfg.atrMult+'×ATR · hedef '+cfg.targetR+'R · risk %'+cfg.risk+
    ' · en fazla '+cfg.maxPos+' pozisyon · maliyet '+(cfg.costs?'açık':'kapalı')+'</div>';

  var step=Math.max(1, Math.ceil(eq.length/70));
  var pts=eq.filter(function(_,i){return i%step===0 || i===eq.length-1;});
  $('btChart').innerHTML=lineChart(pts, ret>=0?'#0bbfa6':'#f0556b');

  $('btLog').innerHTML = trades.length? trades.slice().sort(function(a,b){return b.tOut-a.tOut;}).map(function(t){
    return '<div class="e"><span><b class="'+(t.pnl>0?'up':'down')+'">'+(t.pnl>0?'+':'')+c+fmt(t.pnl)+'</b> '+
      clean(t.sym)+' × '+t.qty+' · '+fmt(t.inPx)+' → '+fmt(t.outPx)+
      (t.r!=null?' <span class="cov">('+(t.r>0?'+':'')+fmt(t.r,2)+'R)</span>':'')+
      ' <span class="bottag">'+t.why+'</span></span>'+
      '<span class="t">'+btLabel(t.tIn)+' → '+btLabel(t.tOut)+'</span></div>';
  }).join('') : '<div class="empty">bu ayarlarla hiç işlem açılmadı — MA süresini kısalt ya da dönemi uzat</div>';
}
