import { createFileRoute } from "@tanstack/react-router";
import { useBot } from "@/lib/botContext";
import { MODE_MIN_CONFIDENCE } from "@/lib/strategy";

export const Route = createFileRoute("/_authenticated/strategy")({ component: Strategy });

function NumField({ label, value, onChange, step = 1, suffix }: { label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="flex items-center rounded-md border border-panel-border bg-background">
        <input type="number" step={step} value={value} onChange={e => onChange(+e.target.value)}
          className="w-full bg-transparent px-3 py-2 mono text-sm outline-none" />
        {suffix && <span className="pr-3 text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

function Strategy() {
  const { settings, saveSettings } = useBot();
  if (!settings) return <div className="p-8">Loading…</div>;

  const modes = [
    { key: "conservative", label: "Conservative", desc: "80%+ confidence · lower frequency · smaller size" },
    { key: "balanced", label: "Balanced", desc: "70%+ confidence · moderate risk" },
    { key: "aggressive", label: "Aggressive", desc: "60%+ confidence · more trades" },
  ] as const;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">Strategy & risk</h1>
        <p className="text-sm text-muted-foreground">All limits enforced by the paper engine on every trade evaluation.</p>
      </div>

      <div className="panel p-4 sm:p-5">
        <div className="text-sm font-semibold">Trading mode</div>
        <div className="mt-1 text-xs text-muted-foreground">Only paper trading is available in the browser. Live 24/7 execution requires the standalone executor service.</div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {modes.map(m => (
            <button key={m.key} onClick={() => saveSettings({ strategy_mode: m.key, min_confidence: MODE_MIN_CONFIDENCE[m.key] })}
              className={`rounded-md border p-4 text-left ${settings.strategy_mode === m.key ? "border-primary bg-primary/10" : "border-panel-border bg-background hover:bg-accent"}`}>
              <div className="text-sm font-semibold">{m.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="panel p-4 sm:p-5 space-y-5">
        <div className="text-sm font-semibold">Risk limits</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <NumField label="Paper equity" value={settings.paper_equity} onChange={v => saveSettings({ paper_equity: v })} step={100} suffix="USDC" />
          <NumField label="Max leverage" value={settings.max_leverage} onChange={v => saveSettings({ max_leverage: Math.min(20, Math.max(1, v)) })} step={1} suffix="x" />
          <NumField label="Position size" value={settings.position_size_pct} onChange={v => saveSettings({ position_size_pct: Math.min(10, Math.max(0.5, v)) })} step={0.5} suffix="% equity" />
          <NumField label="Max exposure" value={settings.max_exposure_pct} onChange={v => saveSettings({ max_exposure_pct: Math.min(100, Math.max(5, v)) })} step={5} suffix="% equity" />
          <NumField label="Max positions" value={settings.max_positions} onChange={v => saveSettings({ max_positions: Math.min(10, Math.max(1, Math.round(v))) })} step={1} />
          <NumField label="Daily loss limit" value={settings.daily_loss_pct} onChange={v => saveSettings({ daily_loss_pct: Math.min(20, Math.max(1, v)) })} step={0.5} suffix="%" />
          <NumField label="Min signal confidence" value={settings.min_confidence} onChange={v => saveSettings({ min_confidence: Math.min(100, Math.max(50, v)) })} step={5} suffix="%" />
        </div>
      </div>

      <div className="panel p-4 sm:p-5 space-y-5">
        <div className="text-sm font-semibold">Exit rules</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <label className="block">
            <div className="mb-1.5 text-xs uppercase tracking-widest text-muted-foreground">Stop-loss type</div>
            <select value={settings.sl_type} onChange={e => saveSettings({ sl_type: e.target.value as any })}
              className="w-full rounded-md border border-panel-border bg-background px-3 py-2 text-sm mono">
              <option value="atr">ATR-based</option><option value="fixed">Fixed %</option>
            </select>
          </label>
          <NumField label="ATR multiplier" value={settings.sl_atr_mult} onChange={v => saveSettings({ sl_atr_mult: v })} step={0.1} />
          <NumField label="Fixed SL %" value={settings.sl_fixed_pct} onChange={v => saveSettings({ sl_fixed_pct: v })} step={0.1} suffix="%" />
          <NumField label="TP / SL ratio" value={settings.tp_rr} onChange={v => saveSettings({ tp_rr: v })} step={0.25} suffix=":1" />
          <label className="flex items-center gap-3 sm:col-span-2">
            <input type="checkbox" checked={settings.trailing_enabled} onChange={e => saveSettings({ trailing_enabled: e.target.checked })} />
            <div>
              <div className="text-sm font-medium">Trailing stop</div>
              <div className="text-xs text-muted-foreground">Ratchet stop-loss up when trade moves 1R in profit</div>
            </div>
          </label>
        </div>
      </div>

      <div className="panel p-4 sm:p-5 text-xs text-muted-foreground space-y-2">
        <div className="mono uppercase tracking-widest text-warning">Strategy summary</div>
        <p>
          Trend + momentum + volatility confluence on <strong>1-hour</strong> bars. Entries require a <strong>fresh EMA20/50 cross</strong> in the direction of the major trend (price above/below EMA100 &amp; EMA200), with MACD accelerating or RSI in a momentum zone. ATR-based volatility gate rejects dead or unstable markets. Correlation guard prevents stacking more than 2 positions per sector.
        </p>
        <p className="mono text-bear">
          Validation warning — walk-forward test, 3 months, 24 Hyperliquid perps, 1h bars, with taker
          fees (0.045%), real funding and 0.035% slippage: <strong>0 of 240 parameter combinations were
          profitable in both halves of the sample.</strong> Correlation between in-sample and
          out-of-sample profit factor was −0.10. The best in-sample configs lost 14–68% out of sample
          with 40–72% drawdowns.
        </p>
        <p>
          The earlier "+8.1% return / PF 1.78" figure came from a 5-coin test with no funding or
          slippage and did not survive validation. This strategy currently has <strong>no demonstrated
          edge</strong>. Paper trading only — do not fund it with real capital.
        </p>

      </div>

    </div>
  );
}
