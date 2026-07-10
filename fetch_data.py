# -*- coding: utf-8 -*-
"""
Borsa Pano — veri çekici (TAM SÜRÜM v3)
======================================
Üretilenler:
  data.js     -> window.STOCK_DATA   : fiyat + temeller + teknikler (pano her 10 dk indirir)
  history.js  -> window.STOCK_HISTORY: grafik serileri (15m/5g gün içi, günlük 1y, haftalık 5y)

Yenilikler (v3):
  - 5 yıllık günlük geçmiş (tek toplu istek, hızlı)
  - ret1w / ret6m / ret1y / ret5y  (detay kartları)
  - earningsGrowth / revenueGrowth (Orta/Uzun skorda büyüme metrikleri)
  - history.js: hisse detayındaki etkileşimli grafik için OHLC serileri

GitHub Actions notu: workflow'un commit adımına history.js'i de ekle
(örn. `git add data.js history.js`).
"""

import json, math, time, datetime
import yfinance as yf
import pandas as pd

# =====================================================================
#  SEMBOL LİSTELERİ — KENDİ LİSTELERİNLE DEĞİŞTİR
#  (mevcut fetch_data.py'ndaki listeleri aynen buraya yapıştır)
# =====================================================================
SYMBOLS = {
    "DAX": [
        "ADS.DE","AIR.DE","ALV.DE","BAS.DE","BAYN.DE","BEI.DE","BMW.DE","BNR.DE",
        "CBK.DE","CON.DE","1COV.DE","DTG.DE","DBK.DE","DB1.DE","DHL.DE","DTE.DE",
        "EOAN.DE","FRE.DE","HNR1.DE","HEI.DE","HEN3.DE","IFX.DE","MBG.DE","MRK.DE",
        "MTX.DE","MUV2.DE","P911.DE","PAH3.DE","QIA.DE","RHM.DE","RWE.DE","SAP.DE",
        "SRT3.DE","SIE.DE","ENR.DE","SHL.DE","SY1.DE","VNA.DE","VOW3.DE","ZAL.DE",
    ],
    "NASDAQ": [
        "AAPL","MSFT","NVDA","AMZN","META","GOOGL","AVGO","TSLA","COST","NFLX",
        "AMD","PEP","ADBE","CSCO","QCOM","TMUS","INTC","INTU","TXN","AMAT",
        "CMCSA","HON","AMGN","BKNG","ISRG","SBUX","VRTX","GILD","ADI","MDLZ",
        "ADP","PDD","REGN","LRCX","MU","PANW","SNPS","KLAC","CDNS","MELI",
        "ASML","CRWD","ABNB","MAR","CSX","ORLY","NXPI","MRVL","FTNT","PYPL",
        "WDAY","ROP","MNST","ADSK","DASH","AEP","KDP","PCAR","CHTR","PAYX",
        "ROST","CPRT","ODFL","FAST","DDOG","EA","GEHC","KHC","EXC","CTAS",
        "VRSK","XEL","AZN","LULU","CCEP","TTWO","IDXX","CSGP","ZS","TEAM",
        "DXCM","MCHP","BIIB","ON","WBD","GFS","MDB","CEG","ARM","SMCI",
    ],
    "BIST": [
        "THYAO.IS","ASELS.IS","AKBNK.IS","GARAN.IS","ISCTR.IS","YKBNK.IS","SISE.IS",
        "EREGL.IS","KCHOL.IS","SAHOL.IS","TUPRS.IS","BIMAS.IS","FROTO.IS","TOASO.IS",
        "TCELL.IS","TTKOM.IS","PGSUS.IS","EKGYO.IS","PETKM.IS","KRDMD.IS","ARCLK.IS",
        "ENKAI.IS","HEKTS.IS","SASA.IS","KOZAL.IS","KOZAA.IS","GUBRF.IS","ALARK.IS",
        "VESTL.IS","ODAS.IS",
    ],
}

BENCH = {"DAX": "^GDAXI", "NASDAQ": "^NDX", "BIST": "XU100.IS"}

OUT_DATA    = "data.js"
OUT_HISTORY = "history.js"

# =====================================================================
#  yardımcılar
# =====================================================================
def r2(x, d=2):
    try:
        if x is None: return None
        f = float(x)
        if math.isnan(f) or math.isinf(f): return None
        return round(f, d)
    except Exception:
        return None

def px_round(x):
    """Fiyat yuvarlama: küçük fiyatlarda daha çok hane (history.js boyutu için)."""
    if x is None: return None
    f = float(x)
    if math.isnan(f) or math.isinf(f): return None
    if f >= 1000: return round(f, 1)
    if f >= 10:   return round(f, 2)
    return round(f, 4)

def rsi14(closes: pd.Series):
    if closes is None or len(closes) < 20: return None
    delta = closes.diff()
    gain = delta.clip(lower=0.0)
    loss = (-delta).clip(lower=0.0)
    avg_g = gain.ewm(alpha=1/14, min_periods=14, adjust=False).mean()
    avg_l = loss.ewm(alpha=1/14, min_periods=14, adjust=False).mean()
    last_g, last_l = avg_g.iloc[-1], avg_l.iloc[-1]
    if pd.isna(last_g) or pd.isna(last_l): return None
    if last_l == 0: return 100.0
    rs = last_g / last_l
    return r2(100 - 100 / (1 + rs), 1)

def atr_pct(df: pd.DataFrame, price):
    if df is None or len(df) < 16 or not price: return None
    h, l, c = df["High"], df["Low"], df["Close"]
    pc = c.shift(1)
    tr = pd.concat([(h - l), (h - pc).abs(), (l - pc).abs()], axis=1).max(axis=1)
    atr = tr.rolling(14).mean().iloc[-1]
    if pd.isna(atr): return None
    return r2(atr / price * 100, 2)

def ret_n(closes: pd.Series, n: int):
    if closes is None or len(closes) <= n: return None
    base = closes.iloc[-1 - n]
    if not base or pd.isna(base) or base <= 0: return None
    return r2((closes.iloc[-1] / base - 1) * 100, 2)

def bars_from(df: pd.DataFrame):
    """[t, o, h, l, c] listesi (t = unix saniye)."""
    out = []
    if df is None or df.empty: return out
    for ts, row in df.iterrows():
        o, h, l, c = row.get("Open"), row.get("High"), row.get("Low"), row.get("Close")
        if pd.isna(o) or pd.isna(h) or pd.isna(l) or pd.isna(c): continue
        t = int(ts.timestamp()) if hasattr(ts, "timestamp") else int(ts)
        out.append([t, px_round(o), px_round(h), px_round(l), px_round(c)])
    return out

def sub_df(batch: pd.DataFrame, sym: str):
    """yf.download group_by='ticker' çıktısından tek sembolün DataFrame'i."""
    try:
        if isinstance(batch.columns, pd.MultiIndex):
            df = batch[sym].dropna(how="all")
        else:
            df = batch.dropna(how="all")
        return df if not df.empty else None
    except Exception:
        return None

def safe_info(tk):
    try:
        info = tk.info or {}
        return info if isinstance(info, dict) else {}
    except Exception:
        return {}

# =====================================================================
#  1) toplu indirme — günlük 5y + gün içi 15m/5g
# =====================================================================
ALL = [s for lst in SYMBOLS.values() for s in lst]
print(f"{len(ALL)} sembol · günlük 5y indiriliyor…")
daily_batch = yf.download(ALL, period="5y", interval="1d",
                          group_by="ticker", auto_adjust=True,
                          threads=True, progress=False)

print("gün içi 15m/5g indiriliyor…")
try:
    intra_batch = yf.download(ALL, period="5d", interval="15m",
                              group_by="ticker", auto_adjust=True,
                              threads=True, progress=False)
except Exception as e:
    print("gün içi indirilemedi:", e)
    intra_batch = None

print("kurlar ve endeksler…")
fx = yf.download(["EURTRY=X", "USDTRY=X"], period="5d", interval="1d",
                 group_by="ticker", progress=False)
bench_batch = yf.download(list(BENCH.values()), period="3mo", interval="1d",
                          group_by="ticker", progress=False)

def last_close(batch, sym):
    df = sub_df(batch, sym)
    if df is None or "Close" not in df: return None
    s = df["Close"].dropna()
    return float(s.iloc[-1]) if len(s) else None

rates = {"EURTRY": r2(last_close(fx, "EURTRY=X"), 4),
         "USDTRY": r2(last_close(fx, "USDTRY=X"), 4)}

benchmarks = {}
for mkt, idx in BENCH.items():
    df = sub_df(bench_batch, idx)
    c = df["Close"].dropna() if df is not None and "Close" in df else None
    benchmarks[mkt] = ret_n(c, 21) if c is not None else None

# =====================================================================
#  2) sembol döngüsü
# =====================================================================
stocks, history, market_times = [], {}, {}

for market, syms in SYMBOLS.items():
    for sym in syms:
        try:
            d = sub_df(daily_batch, sym)
            if d is None or "Close" not in d or len(d["Close"].dropna()) < 5:
                print(f"  atlandı (günlük veri yok): {sym}")
                continue
            d = d.dropna(subset=["Close"])
            closes = d["Close"]

            tk = yf.Ticker(sym)
            info = safe_info(tk)

            # --- fiyat / önceki kapanış / hacim (info -> fallback geçmiş) ---
            price = info.get("currentPrice") or info.get("regularMarketPrice")
            if not price: price = float(closes.iloc[-1])
            prev = info.get("regularMarketPreviousClose") or info.get("previousClose")
            if not prev and len(closes) >= 2: prev = float(closes.iloc[-2])
            volume = info.get("regularMarketVolume") or info.get("volume")
            if not volume and "Volume" in d:
                v = d["Volume"].dropna()
                volume = int(v.iloc[-1]) if len(v) else None
            change = r2((price / prev - 1) * 100, 2) if (price and prev) else None

            # --- teknikler (günlük 5y serisinin kuyruğundan) ---
            ma50  = r2(closes.tail(50).mean(), 4)  if len(closes) >= 50  else None
            ma200 = r2(closes.tail(200).mean(), 4) if len(closes) >= 200 else None
            rel_vol = None
            if "Volume" in d:
                v = d["Volume"].dropna()
                if len(v) >= 21:
                    base = v.iloc[-21:-1].mean()
                    if base and base > 0:
                        rel_vol = r2(float(v.iloc[-1]) / base, 2)
            high52 = closes.tail(252).max() if len(closes) else None
            pct_from_high = r2((price / high52 - 1) * 100, 2) if (price and high52) else None

            rec = {
                "symbol": sym, "market": market,
                "name": info.get("shortName") or info.get("longName") or sym,
                "sector": info.get("sector"),
                "currency": info.get("currency") or ("TRY" if market == "BIST" else "USD" if market == "NASDAQ" else "EUR"),
                "price": r2(price, 4), "prevClose": r2(prev, 4),
                "changePct": change, "volume": volume,
                "marketCap": info.get("marketCap"),
                # temeller
                "pe": r2(info.get("trailingPE")),
                "pb": r2(info.get("priceToBook")),
                "roe": r2((info.get("returnOnEquity") or 0) * 100) if info.get("returnOnEquity") is not None else None,
                "debtToEquity": r2(info.get("debtToEquity")),
                "netMargin": r2((info.get("profitMargins") or 0) * 100) if info.get("profitMargins") is not None else None,
                "netIncome": info.get("netIncomeToCommon"),
                "earningsGrowth": r2((info.get("earningsGrowth") or 0) * 100) if info.get("earningsGrowth") is not None else None,
                "revenueGrowth": r2((info.get("revenueGrowth") or 0) * 100) if info.get("revenueGrowth") is not None else None,
                # teknikler
                "ma50": ma50, "ma200": ma200,
                "atrPct": atr_pct(d, price), "relVol": rel_vol,
                "rsi14": rsi14(closes), "pctFromHigh": pct_from_high,
                # dönem getirileri
                "ret1w": ret_n(closes, 5),
                "ret1m": ret_n(closes, 21),
                "ret3m": ret_n(closes, 63),
                "ret6m": ret_n(closes, 126),
                "ret1y": ret_n(closes, 252),
                "ret5y": ret_n(closes, len(closes) - 1) if len(closes) >= 750 else None,
            }
            stocks.append(rec)

            # --- grafik serileri ---
            entry = {}
            entry["d"] = bars_from(d.tail(260))                       # günlük ~1 yıl
            w = d.resample("W-FRI").agg({"Open": "first", "High": "max",
                                         "Low": "min", "Close": "last"}).dropna()
            entry["w"] = bars_from(w)                                 # haftalık 5 yıl
            if intra_batch is not None:
                di = sub_df(intra_batch, sym)
                entry["i"] = bars_from(di) if di is not None else []  # 15m / 5 gün
            else:
                entry["i"] = []
            history[sym] = entry

            if entry["i"]:
                t = entry["i"][-1][0]
                market_times[market] = max(market_times.get(market, 0), t)
        except Exception as e:
            print(f"  hata {sym}: {e}")
        time.sleep(0.05)  # nazik ol

# marketTimes yedek: gün içi yoksa günlük son bar
for market, syms in SYMBOLS.items():
    if market not in market_times:
        for sym in syms:
            if sym in history and history[sym]["d"]:
                market_times[market] = history[sym]["d"][-1][0]
                break

# =====================================================================
#  3) çıktılar
# =====================================================================
data = {
    "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "rates": rates,
    "benchmarks": benchmarks,
    "marketTimes": market_times,
    "stocks": stocks,
}
with open(OUT_DATA, "w", encoding="utf-8") as f:
    f.write("window.STOCK_DATA=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";")

with open(OUT_HISTORY, "w", encoding="utf-8") as f:
    f.write("window.STOCK_HISTORY=" + json.dumps(history, ensure_ascii=False, separators=(",", ":")) + ";")

import os
print(f"tamam: {len(stocks)} hisse · data.js {os.path.getsize(OUT_DATA)//1024} KB · history.js {os.path.getsize(OUT_HISTORY)//1024} KB")
