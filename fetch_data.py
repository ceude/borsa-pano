#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
borsa-pano veri cekici
-----------------------
yfinance ile BIST + DAX hisselerinin fiyat, hacim ve temel oranlarini ceker,
seffaf bir "parlaklik skoru" hesaplar ve panonun okudugu data.js dosyasini yazar.

KULLANIM:
    pip install yfinance
    python fetch_data.py

Gunde 1 kere elle calistir, sonra index.html'i tarayicida yenile.

NOT: Skor bir DEGER/KALITE skorudur. "Ucuz ve saglam mi" sorusunu cevaplar,
"yarin yukselir mi" sorusunu DEGIL. Kisa vadeli fiyat tahmini yapmaz.
"""

import json
import time
import sys
import os
from datetime import datetime, timezone

try:
    import yfinance as yf
except ImportError:
    print("HATA: yfinance kurulu degil. Kur: pip install yfinance")
    sys.exit(1)

HERE = os.path.dirname(os.path.abspath(__file__))

# ---- Skor agirliklari (toplami onemli degil, oransal kullanilir) ----
# Her metrik 0-1 arasi yuzdeliğe cevrilir (evren icinde siralama),
# sonra agirlikli ortalama alinir -> 0-100 skor.
WEIGHTS = {
    "pe":     1.0,   # F/K  - dusuk daha iyi
    "pb":     1.0,   # P/D  - dusuk daha iyi
    "roe":    1.5,   # ozsermaye karliligi - yuksek daha iyi
    "de":     1.0,   # borc/ozsermaye - dusuk daha iyi
    "margin": 1.0,   # net kar marji - yuksek daha iyi
}

REQUEST_SLEEP = 0.4  # tickerlar arasi bekleme (saniye) - rate limit dostu


def read_tickers(path, market):
    out = []
    if not os.path.exists(path):
        print(f"UYARI: {path} bulunamadi, atlaniyor.")
        return out
    with open(path, encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            out.append((s, market))
    return out


def safe(d, *keys):
    """info sozlugunden ilk dolu degeri dondur."""
    for k in keys:
        v = d.get(k)
        if v is not None and v != 0 and not (isinstance(v, float) and v != v):
            return v
    return None


def compute_technicals(h):
    """Gunluk geçmişten (1y) kisa-orta vade teknik gostergeleri hesapla."""
    out = {"ma50": None, "ma200": None, "rsi14": None, "atrPct": None,
           "ret1m": None, "ret3m": None, "pctFromHigh": None, "relVol": None}
    try:
        closes = [float(x) for x in h["Close"].dropna().tolist()]
        highs = [float(x) for x in h["High"].dropna().tolist()]
        lows = [float(x) for x in h["Low"].dropna().tolist()]
        vols = [float(x) for x in h["Volume"].dropna().tolist()]
    except Exception:
        return out
    n = len(closes)
    if n < 2:
        return out
    price = closes[-1]
    if n >= 50:
        out["ma50"] = round(sum(closes[-50:]) / 50, 4)
    if n >= 200:
        out["ma200"] = round(sum(closes[-200:]) / 200, 4)
    if n >= 22:
        out["ret1m"] = round((price / closes[-22] - 1) * 100, 2)
    if n >= 64:
        out["ret3m"] = round((price / closes[-64] - 1) * 100, 2)
    window = closes[-252:] if n >= 252 else closes
    hi = max(window)
    if hi > 0:
        out["pctFromHigh"] = round((price / hi - 1) * 100, 2)
    # RSI(14)
    if n >= 15:
        gains = losses = 0.0
        for i in range(n - 14, n):
            ch = closes[i] - closes[i - 1]
            if ch >= 0:
                gains += ch
            else:
                losses -= ch
        ag, al = gains / 14, losses / 14
        out["rsi14"] = 100.0 if al == 0 else round(100 - 100 / (1 + ag / al), 1)
    # ATR(14) yuzde
    if n >= 15 and len(highs) == n and len(lows) == n:
        trs = []
        for i in range(n - 14, n):
            trs.append(max(highs[i] - lows[i],
                           abs(highs[i] - closes[i - 1]),
                           abs(lows[i] - closes[i - 1])))
        atr = sum(trs) / len(trs)
        if price > 0:
            out["atrPct"] = round(atr / price * 100, 2)
    # Bagil hacim (son gun / 20 gun ort)
    if len(vols) >= 21:
        avg20 = sum(vols[-21:-1]) / 20
        if avg20 > 0:
            out["relVol"] = round(vols[-1] / avg20, 2)
    return out


def fetch_index_ret1m(sym):
    """Endeksin 1 aylik (~22 gun) getirisi - bagil guc icin."""
    try:
        h = yf.Ticker(sym).history(period="3mo", interval="1d")
        c = [float(x) for x in h["Close"].dropna().tolist()]
        if len(c) >= 22:
            return round((c[-1] / c[-22] - 1) * 100, 2)
    except Exception as e:
        print(f"  ! {sym} endeks hatasi: {e}")
    return None


def fetch_one(symbol, market):
    t = yf.Ticker(symbol)
    info = {}
    try:
        info = t.info or {}
    except Exception as e:
        print(f"  ! {symbol} info hatasi: {e}")

    # Fiyat / onceki kapanis / hacim
    price = safe(info, "currentPrice", "regularMarketPrice", "regularMarketPreviousClose")
    prev = safe(info, "regularMarketPreviousClose", "previousClose")
    volume = safe(info, "regularMarketVolume", "volume", "averageVolume")

    # fast_info yedek
    if price is None or prev is None or volume is None:
        try:
            fi = t.fast_info
            price = price or getattr(fi, "last_price", None)
            prev = prev or getattr(fi, "previous_close", None)
            volume = volume or getattr(fi, "last_volume", None)
        except Exception:
            pass

    # history yedek (degisim icin)
    if price is None or prev is None:
        try:
            h = t.history(period="5d")
            if len(h) >= 1:
                price = price or float(h["Close"].iloc[-1])
            if len(h) >= 2:
                prev = prev or float(h["Close"].iloc[-2])
        except Exception:
            pass

    # 1 yillik gecmis -> teknik gostergeler (ayni veriyle fiyat/hacim yedegi)
    tech = {"ma50": None, "ma200": None, "rsi14": None, "atrPct": None,
            "ret1m": None, "ret3m": None, "pctFromHigh": None, "relVol": None}
    try:
        h1 = t.history(period="1y", interval="1d")
        if len(h1) > 0:
            tech = compute_technicals(h1)
            if price is None:
                price = float(h1["Close"].iloc[-1])
            if prev is None and len(h1) >= 2:
                prev = float(h1["Close"].iloc[-2])
            if volume is None:
                volume = float(h1["Volume"].iloc[-1])
    except Exception as e:
        print(f"  ! {symbol} teknik hatasi: {e}")

    change_pct = None
    if price is not None and prev:
        change_pct = (price - prev) / prev * 100.0

    # Temel oranlar
    pe = safe(info, "trailingPE", "forwardPE")
    pb = safe(info, "priceToBook")
    roe = safe(info, "returnOnEquity")          # 0.18 = %18
    de = safe(info, "debtToEquity")             # 50 = %50
    margin = safe(info, "profitMargins")        # 0.12 = %12
    net_income = safe(info, "netIncomeToCommon")
    mcap = safe(info, "marketCap")
    name = info.get("shortName") or info.get("longName") or symbol
    sector = info.get("sector") or info.get("industry") or "-"
    currency = info.get("currency") or ("TRY" if market == "BIST" else "USD" if market == "NASDAQ" else "EUR")
    mkt_time = info.get("regularMarketTime")  # son fiyat zamani (epoch saniye) veya None

    return {
        "symbol": symbol,
        "market": market,
        "name": name,
        "sector": sector,
        "currency": currency,
        "priceTime": int(mkt_time) if mkt_time else None,
        "price": round(price, 4) if price is not None else None,
        "prevClose": round(prev, 4) if prev is not None else None,
        "changePct": round(change_pct, 2) if change_pct is not None else None,
        "volume": int(volume) if volume is not None else None,
        "marketCap": int(mcap) if mcap is not None else None,
        "pe": round(pe, 2) if pe is not None else None,
        "pb": round(pb, 2) if pb is not None else None,
        "roe": round(roe * 100, 2) if roe is not None else None,      # yuzde
        "debtToEquity": round(de, 2) if de is not None else None,
        "netMargin": round(margin * 100, 2) if margin is not None else None,  # yuzde
        "netIncome": int(net_income) if net_income is not None else None,
        # --- teknik (kisa-orta vade) ---
        "ma50": tech["ma50"], "ma200": tech["ma200"],
        "rsi14": tech["rsi14"], "atrPct": tech["atrPct"],
        "ret1m": tech["ret1m"], "ret3m": tech["ret3m"],
        "pctFromHigh": tech["pctFromHigh"], "relVol": tech["relVol"],
    }


def percentile_rank(values):
    """Liste icindeki her degerin yuzdelik sirasini dondur (0-1).
    None degerler None kalir. Ayni degerler ortalama sira alir."""
    idx = [i for i, v in enumerate(values) if v is not None]
    if not idx:
        return [None] * len(values)
    ordered = sorted(idx, key=lambda i: values[i])
    ranks = [None] * len(values)
    n = len(ordered)
    # yuzdelik: en kucuk -> 0, en buyuk -> 1
    for pos, i in enumerate(ordered):
        ranks[i] = pos / (n - 1) if n > 1 else 0.5
    return ranks


def compute_scores(rows):
    # Skoru HER PIYASA KENDI ICINDE yuzdelik sirala (BIST ve DAX farkli
    # valuasyon rejimleri; birlikte siralarsak BIST hep "ucuz" cikar).
    groups = {}
    for r in rows:
        groups.setdefault(r.get("market"), []).append(r)
    for grp in groups.values():
        _score_group(grp)


def _score_group(rows):
    pe = [r["pe"] if (r["pe"] is not None and r["pe"] > 0) else None for r in rows]
    pb = [r["pb"] if (r["pb"] is not None and r["pb"] > 0) else None for r in rows]
    roe = [r["roe"] for r in rows]
    de = [r["debtToEquity"] if (r["debtToEquity"] is not None and r["debtToEquity"] >= 0) else None for r in rows]
    margin = [r["netMargin"] for r in rows]

    # yuzdelikler
    pe_r = percentile_rank(pe)      # dusuk iyi -> sonra ters cevir
    pb_r = percentile_rank(pb)      # dusuk iyi -> ters
    roe_r = percentile_rank(roe)    # yuksek iyi
    de_r = percentile_rank(de)      # dusuk iyi -> ters
    margin_r = percentile_rank(margin)  # yuksek iyi

    for i, r in enumerate(rows):
        components = {
            "pe": (1 - pe_r[i]) if pe_r[i] is not None else None,
            "pb": (1 - pb_r[i]) if pb_r[i] is not None else None,
            "roe": roe_r[i],
            "de": (1 - de_r[i]) if de_r[i] is not None else None,
            "margin": margin_r[i],
        }
        wsum, vsum = 0.0, 0.0
        for k, v in components.items():
            if v is not None:
                wsum += WEIGHTS[k]
                vsum += WEIGHTS[k] * v
        score = round((vsum / wsum) * 100, 1) if wsum > 0 else None
        r["score"] = score
        # kac metrikten hesaplandi (guvenilirlik gostergesi)
        r["scoreCoverage"] = sum(1 for v in components.values() if v is not None)


def fetch_rate(pair):
    """pair orn 'EURTRY=X' -> guncel kur (float) veya None."""
    try:
        t = yf.Ticker(pair)
        try:
            v = t.fast_info.last_price
            if v: return round(float(v), 4)
        except Exception:
            pass
        info = t.info or {}
        v = safe(info, "regularMarketPrice", "previousClose")
        if v: return round(float(v), 4)
        h = t.history(period="5d")
        if len(h):
            return round(float(h["Close"].iloc[-1]), 4)
    except Exception as e:
        print(f"  ! {pair} kur hatasi: {e}")
    return None


def main():
    tickers = []
    tickers += read_tickers(os.path.join(HERE, "bist_tickers.txt"), "BIST")
    tickers += read_tickers(os.path.join(HERE, "dax_tickers.txt"), "DAX")
    tickers += read_tickers(os.path.join(HERE, "nasdaq_tickers.txt"), "NASDAQ")

    if not tickers:
        print("HATA: hic ticker bulunamadi.")
        sys.exit(1)

    print(f"{len(tickers)} hisse cekilecek...\n")
    rows = []
    for n, (sym, market) in enumerate(tickers, 1):
        print(f"[{n}/{len(tickers)}] {sym} ({market})")
        try:
            rows.append(fetch_one(sym, market))
        except Exception as e:
            print(f"  ! {sym} basarisiz: {e}")
        time.sleep(REQUEST_SLEEP)

    compute_scores(rows)

    # skora gore sirala (None'lar sona)
    rows.sort(key=lambda r: (r["score"] is None, -(r["score"] or 0)))

    print("\nKurlar cekiliyor (EUR/TRY, USD/TRY)...")
    rates = {
        "EURTRY": fetch_rate("EURTRY=X"),
        "USDTRY": fetch_rate("USDTRY=X"),
    }
    print(f"  EUR/TRY={rates['EURTRY']}  USD/TRY={rates['USDTRY']}")

    print("Endeks getirileri cekiliyor (DAX, BIST)...")
    benchmarks = {
        "DAX": fetch_index_ret1m("^GDAXI"),
        "BIST": fetch_index_ret1m("XU100.IS"),
        "NASDAQ": fetch_index_ret1m("^NDX"),
    }
    print(f"  DAX 1A={benchmarks['DAX']}  BIST 1A={benchmarks['BIST']}  NASDAQ 1A={benchmarks['NASDAQ']}")

    # Piyasa basina en son veri zamani (epoch) = o piyasadaki hisselerin en yeni priceTime'i
    market_times = {}
    for r in rows:
        pt = r.get("priceTime")
        if pt:
            m = r["market"]
            if market_times.get(m) is None or pt > market_times[m]:
                market_times[m] = pt
    print(f"  Son veri zamanlari (epoch): {market_times}")

    payload = {
        "updatedAt": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "count": len(rows),
        "weights": WEIGHTS,
        "rates": rates,
        "benchmarks": benchmarks,
        "marketTimes": market_times,
        "stocks": rows,
    }

    # 1) data.js  -> index.html bunu <script> ile okur (CORS yok, cift tikla calisir)
    js_path = os.path.join(HERE, "data.js")
    with open(js_path, "w", encoding="utf-8") as f:
        f.write("window.STOCK_DATA = ")
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    # 2) data.json -> ileride lazim olursa
    with open(os.path.join(HERE, "data.json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    ok = sum(1 for r in rows if r["price"] is not None)
    print(f"\nBitti. {ok}/{len(rows)} hissede fiyat var.")
    print(f"Yazildi: {js_path}")
    print("Simdi index.html'i tarayicida yenile.")


if __name__ == "__main__":
    main()
