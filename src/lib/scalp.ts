import { atr, ema, last, macd, rsi } from "./indicators";
import type { Bar } from "./strategy";

/**
 * Quick-trade ("scalp") signal set — designed for 1–3% moves on 15m bars.
 *
 * IMPORTANT (validated 2026-08): across 19 Hyperliquid perps, ~52 days of 15m
 * bars and 192 parameter combinations, none of these families were profitable
 * in all four walk-forward folds once 0.13% round-trip cost was applied.
 * Best family (mean reversion) had a 69% win rate but a 0.85 profit factor.
 * Treat these signals as candidates for paper forward-testing, not as an edge.
 */
export type ScalpSide = "long" | "short";

export interface ScalpSignal {
  coin: string;
  side: ScalpSide | null;
  family: string;
  confidence: number;
  reasons: string[];
  price: number;
  atrPct: number;
  indicators: Record<string, number>;
}

export function evaluateScalp(coin: string, bars: Bar[]): ScalpSignal {
  const empty: ScalpSignal = {
    coin, side: null, family: "none", confidence: 0, reasons: [],
    price: bars.length ? bars[bars.length - 1].c : 0, atrPct: 0, indicators: {},
  };
  if (bars.length < 210) return empty;

  const closes = bars.map((b) => b.c);
  const vols = bars.map((b) => b.v);
  const price = last(closes)!;

  const e20 = ema(closes, 20), e50 = ema(closes, 50), e200 = ema(closes, 200);
  const rs = rsi(closes, 14);
  const md = macd(closes);
  const at = atr(bars, 14);

  const f20 = last(e20)!, f50 = last(e50)!, f200 = last(e200)!;
  const rsiV = last(rs)!, rsiP = rs[rs.length - 2];
  const atrV = last(at)!;
  const atrPct = (atrV / price) * 100;
  const avgVol = vols.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  const lastVol = last(vols)!;
  const volX = lastVol / (avgVol || 1);
  const macdHist = last(md.hist)!;
  const distAtr = (price - f20) / (atrV || 1e-9);

  const indicators = { ema20: f20, ema50: f50, ema200: f200, rsi: rsiV, atrPct, volX, macdHist, distAtr };

  // Volatility gate — a 2% target is unreachable in a dead market and a
  // coin-flip in a violent one.
  if (atrPct < 0.25 || atrPct > 3) {
    return { ...empty, price, atrPct, indicators, reasons: [`ATR% ${atrPct.toFixed(2)} outside 0.25–3 band`] };
  }

  const up = f50 > f200, down = f50 < f200;
  const reasons: string[] = [];
  let side: ScalpSide | null = null;
  let family = "none";
  let confidence = 0;

  // 1. Mean reversion inside a trend — best measured family in the backtest.
  if (up && rsiV < 30 && distAtr < -1.5) {
    side = "long"; family = "revert"; confidence = 60;
    reasons.push(`Oversold pullback in uptrend (RSI ${rsiV.toFixed(1)}, ${distAtr.toFixed(1)} ATR below EMA20)`);
  } else if (down && rsiV > 70 && distAtr > 1.5) {
    side = "short"; family = "revert"; confidence = 60;
    reasons.push(`Overbought bounce in downtrend (RSI ${rsiV.toFixed(1)}, ${distAtr.toFixed(1)} ATR above EMA20)`);
  }
  // 2. RSI reclaim pullback continuation.
  else if (up && rsiP < 40 && rsiV >= 40 && price > f200) {
    side = "long"; family = "pullback"; confidence = 55;
    reasons.push(`RSI reclaimed 40 in uptrend (${rsiV.toFixed(1)})`);
  } else if (down && rsiP > 60 && rsiV <= 60 && price < f200) {
    side = "short"; family = "pullback"; confidence = 55;
    reasons.push(`RSI lost 60 in downtrend (${rsiV.toFixed(1)})`);
  }
  // 3. Volume-confirmed short-window breakout.
  else {
    const n = 24;
    let hh = -Infinity, ll = Infinity;
    for (let i = bars.length - 1 - n; i < bars.length - 1; i++) {
      hh = Math.max(hh, bars[i].h); ll = Math.min(ll, bars[i].l);
    }
    if (up && price > hh && volX > 1.2) {
      side = "long"; family = "breakout"; confidence = 55;
      reasons.push(`24-bar breakout on ${volX.toFixed(2)}x volume`);
    } else if (down && price < ll && volX > 1.2) {
      side = "short"; family = "breakout"; confidence = 55;
      reasons.push(`24-bar breakdown on ${volX.toFixed(2)}x volume`);
    }
  }

  if (!side) return { ...empty, price, atrPct, indicators, reasons: ["No quick-trade setup"] };

  // Confluence bonuses
  if (side === "long" && macdHist > 0) { confidence += 10; reasons.push("MACD histogram positive"); }
  if (side === "short" && macdHist < 0) { confidence += 10; reasons.push("MACD histogram negative"); }
  if (volX > 1.5) { confidence += 10; reasons.push(`Volume ${volX.toFixed(2)}x average`); }
  if (side === "long" && price > f50) { confidence += 5; reasons.push("Above EMA50"); }
  if (side === "short" && price < f50) { confidence += 5; reasons.push("Below EMA50"); }

  return { coin, side, family, confidence: Math.min(95, confidence), reasons, price, atrPct, indicators };
}

export interface ExitParams {
  tpPct: number;          // fixed take-profit, e.g. 2
  slPct: number;          // initial stop, e.g. 1
  trailActivatePct: number; // arm trailing once unrealised gain reaches this, e.g. 1
  trailDistPct: number;   // trail this far behind the best price, e.g. 0.5
}

export interface TrailUpdate { stopLoss: number; trailHigh: number; changed: boolean }

/** Ratchet a trailing stop. Returns the new stop and best-price watermark. */
export function updateTrail(
  side: ScalpSide, entry: number, mark: number, stopLoss: number,
  trailHigh: number | null, p: ExitParams,
): TrailUpdate {
  const best = side === "long"
    ? Math.max(trailHigh ?? entry, mark)
    : Math.min(trailHigh ?? entry, mark);
  const gainPct = side === "long" ? ((best - entry) / entry) * 100 : ((entry - best) / entry) * 100;
  let stop = stopLoss;
  if (gainPct >= p.trailActivatePct) {
    const candidate = side === "long"
      ? best * (1 - p.trailDistPct / 100)
      : best * (1 + p.trailDistPct / 100);
    stop = side === "long" ? Math.max(stopLoss, candidate) : Math.min(stopLoss, candidate);
  }
  return { stopLoss: stop, trailHigh: best, changed: stop !== stopLoss || best !== trailHigh };
}

/** Decide whether an open position must be closed at the current mark. */
export function exitReasonFor(side: ScalpSide, mark: number, stopLoss: number, takeProfit: number): string | null {
  if (side === "long") {
    if (mark <= stopLoss) return "stop_loss";
    if (mark >= takeProfit) return "take_profit";
  } else {
    if (mark >= stopLoss) return "stop_loss";
    if (mark <= takeProfit) return "take_profit";
  }
  return null;
}
