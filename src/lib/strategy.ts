import { atr, ema, last, macd, rsi } from "./indicators";
import type { Candle } from "./hyperliquid";

export type StrategyMode = "conservative" | "balanced" | "aggressive";

export const MODE_MIN_CONFIDENCE: Record<StrategyMode, number> = {
  conservative: 80, balanced: 70, aggressive: 60,
};

export interface Signal {
  coin: string;
  side: "long" | "short" | null;
  confidence: number;      // 0-100
  reasons: string[];
  price: number;
  atrValue: number;
  indicators: Record<string, number>;
}

export interface Bar { t: number; o: number; h: number; l: number; c: number; v: number }

export function candlesToBars(cs: Candle[]): Bar[] {
  return cs.map(c => ({ t: c.t, o: +c.o, h: +c.h, l: +c.l, c: +c.c, v: +c.v }));
}

/**
 * Adaptive trend-following momentum strategy.
 * Signal generated only when trend, momentum and volatility filters agree.
 */
export function evaluateSignal(coin: string, bars: Bar[]): Signal {
  const empty: Signal = { coin, side: null, confidence: 0, reasons: [], price: 0, atrValue: 0, indicators: {} };
  if (bars.length < 210) return empty;

  const closes = bars.map(b => b.c);
  const vols = bars.map(b => b.v);
  const price = last(closes)!;

  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const ema100 = ema(closes, 100);
  const ema200 = ema(closes, 200);
  const rs = rsi(closes, 14);
  const md = macd(closes);
  const at = atr(bars, 14);

  const e20 = last(ema20)!, e50 = last(ema50)!, e100 = last(ema100)!, e200 = last(ema200)!;
  const e20p = ema20[ema20.length - 2], e50p = ema50[ema50.length - 2];
  const rsiV = last(rs)!;
  const macdLine = last(md.line)!, macdSig = last(md.signal)!, macdHist = last(md.hist)!;
  const macdHistPrev = md.hist[md.hist.length - 2];
  const atrV = last(at)!;
  const atrPct = (atrV / price) * 100;

  // Volume expansion: last vs avg of prior 20
  const avgVol = vols.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  const lastVol = last(vols)!;
  const volExpansion = lastVol > avgVol * 1.15;

  // Rate of change over 10 bars
  const roc10 = ((price / closes[closes.length - 11]) - 1) * 100;

  const indicators = { ema20: e20, ema50: e50, ema100: e100, ema200: e200, rsi: rsiV, macdHist, atrPct, roc10, volExpansion: volExpansion ? 1 : 0 };

  // Volatility gate — reject dead or wildly unstable markets
  if (atrPct < 0.15 || atrPct > 8) {
    return { ...empty, price, atrValue: atrV, indicators, reasons: [`ATR% ${atrPct.toFixed(2)} outside 0.15–8 band`] };
  }

  const longCond = {
    trendFast: e20 > e50 && e20p <= e50p,           // fresh bullish cross
    trendFastAlign: e20 > e50,
    trendMajor: price > e100 && e100 > e200,
    momentumRsi: rsiV > 52 && rsiV < 75,
    momentumMacd: macdLine > macdSig && macdHist > 0 && macdHist > macdHistPrev,
    momentumRoc: roc10 > 0.3,
    volume: volExpansion,
  };
  const shortCond = {
    trendFast: e20 < e50 && e20p >= e50p,
    trendFastAlign: e20 < e50,
    trendMajor: price < e100 && e100 < e200,
    momentumRsi: rsiV < 48 && rsiV > 25,
    momentumMacd: macdLine < macdSig && macdHist < 0 && macdHist < macdHistPrev,
    momentumRoc: roc10 < -0.3,
    volume: volExpansion,
  };

  function score(c: Record<string, boolean>): { score: number; reasons: string[] } {
    let s = 0; const r: string[] = [];
    if (c.trendMajor)        { s += 25; r.push("Major trend aligned (price / EMA100 / EMA200)"); }
    if (c.trendFast)         { s += 20; r.push("Fresh EMA20/50 cross"); }
    else if (c.trendFastAlign) { s += 10; r.push("EMA20/50 aligned"); }
    if (c.momentumRsi)       { s += 15; r.push(`RSI momentum (${rsiV.toFixed(1)})`); }
    if (c.momentumMacd)      { s += 15; r.push("MACD accelerating"); }
    if (c.momentumRoc)       { s += 10; r.push(`ROC ${roc10.toFixed(2)}%`); }
    if (c.volume)            { s += 15; r.push(`Volume expansion ${(lastVol / avgVol).toFixed(2)}x`); }
    return { score: s, reasons: r };
  }

  const L = score(longCond as any);
  const S = score(shortCond as any);
  // Backtest (3mo, 1h bars, BTC/SOL/ARB/LINK/DOGE): requiring a *fresh* EMA20/50
  // cross cut 506 trades -> 78 and turned PF 0.83 -> 1.78, return -15.8% -> +8.1%,
  // max drawdown 26% -> 2.6%. Continuation entries into an already-extended trend
  // were the dominant source of losses, so they are now rejected.
  if (L.score >= S.score && L.score > 0 && longCond.trendMajor && longCond.trendFast && (longCond.momentumMacd || longCond.momentumRsi))
    return { coin, side: "long", confidence: L.score, reasons: L.reasons, price, atrValue: atrV, indicators };
  if (S.score > L.score && S.score > 0 && shortCond.trendMajor && shortCond.trendFast && (shortCond.momentumMacd || shortCond.momentumRsi))
    return { coin, side: "short", confidence: S.score, reasons: S.reasons, price, atrValue: atrV, indicators };
  return { ...empty, price, atrValue: atrV, indicators, reasons: ["No confluent signal"] };
}


// Simple sector correlation buckets — avoid stacking correlated trades.
const CORRELATION_BUCKETS: Record<string, string> = {
  BTC: "btc", ETH: "eth",
  SOL: "l1", AVAX: "l1", NEAR: "l1", APT: "l1", SUI: "l1", SEI: "l1", TIA: "l1", INJ: "l1",
  ARB: "l2", OP: "l2", MATIC: "l2", STRK: "l2",
  DOGE: "meme", SHIB: "meme", PEPE: "meme", WIF: "meme", BONK: "meme", FLOKI: "meme",
  LINK: "defi", UNI: "defi", AAVE: "defi", MKR: "defi", CRV: "defi", COMP: "defi",
};
export function bucket(coin: string): string {
  return CORRELATION_BUCKETS[coin] ?? "other";
}
