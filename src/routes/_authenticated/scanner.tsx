import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { fetchCandles, fetchMetaAndCtxs, type AssetCtx, type AssetMeta } from "@/lib/hyperliquid";
import { candlesToBars, evaluateSignal } from "@/lib/strategy";
import { useBot } from "@/lib/botContext";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/scanner")({ component: Scanner });

type Row = { meta: AssetMeta; ctx: AssetCtx; signal?: { side: "long" | "short" | null; confidence: number; reasons: string[] } };

function Scanner() {
  const { mids } = useBot();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanningAll, setScanningAll] = useState(false);

  useEffect(() => {
    (async () => {
      const [m, ctxs] = await fetchMetaAndCtxs();
      const merged = m.universe.map((meta, i) => ({ meta, ctx: ctxs[i] }))
        .filter(r => r.ctx)
        .sort((a, b) => +b.ctx.dayNtlVlm - +a.ctx.dayNtlVlm);
      setRows(merged);
      setLoading(false);
    })();
  }, []);

  const runScan = async () => {
    setScanningAll(true);
    const targets = rows.slice(0, 30);
    const updated = [...rows];
    for (const r of targets) {
      const now = Date.now();
      try {
        const cs = await fetchCandles(r.meta.name, "15m", now - 220 * 15 * 60_000, now);
        const bars = candlesToBars(cs);
        if (bars.length >= 210) {
          const sig = evaluateSignal(r.meta.name, bars);
          const idx = updated.findIndex(x => x.meta.name === r.meta.name);
          updated[idx] = { ...r, signal: { side: sig.side, confidence: sig.confidence, reasons: sig.reasons } };
          setRows([...updated]);
        }
      } catch {}
    }
    setScanningAll(false);
  };

  const sorted = useMemo(() => rows, [rows]);

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Market scanner</h1>
          <p className="text-sm text-muted-foreground">All Hyperliquid USDC perpetual markets, ranked by 24h volume.</p>
        </div>
        <button onClick={runScan} disabled={scanningAll} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {scanningAll ? <><Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />Scanning top 30…</> : "Scan top 30 for signals"}
        </button>
      </div>

      {loading ? <div className="py-20 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /> Loading markets…</div> : (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-panel-border text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Coin</th><th className="text-right">Mark</th><th className="text-right">24h vol</th>
                <th className="text-right">Funding</th><th className="text-right">Open int</th><th className="text-right">Max lev</th>
                <th>Signal</th><th className="text-left p-3">Rationale</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 100).map(r => {
                const mark = +(mids[r.meta.name] ?? r.ctx.markPx);
                const fund = +r.ctx.funding * 100;
                return (
                  <tr key={r.meta.name} className="border-b border-panel-border/50">
                    <td className="p-3 mono">{r.meta.name}</td>
                    <td className="mono text-right">{mark.toFixed(6)}</td>
                    <td className="mono text-right text-muted-foreground">{(+r.ctx.dayNtlVlm / 1e6).toFixed(2)}M</td>
                    <td className={`mono text-right ${fund >= 0 ? "text-bull" : "text-bear"}`}>{fund.toFixed(4)}%</td>
                    <td className="mono text-right text-muted-foreground">{(+r.ctx.openInterest).toFixed(0)}</td>
                    <td className="mono text-right">{r.meta.maxLeverage}x</td>
                    <td className="text-center">
                      {r.signal
                        ? (r.signal.side ? <span className={`mono text-xs font-semibold ${r.signal.side === "long" ? "text-bull" : "text-bear"}`}>{r.signal.side.toUpperCase()} {r.signal.confidence}</span> : <span className="text-xs text-muted-foreground">—</span>)
                        : <span className="text-xs text-muted-foreground/50">·</span>}
                    </td>
                    <td className="p-3 max-w-md text-xs text-muted-foreground">{r.signal?.reasons.join(" · ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
