import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBot } from "@/lib/botContext";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trades")({ component: Trades });

function csv(rows: any[]) {
  const cols = ["coin","side","size","leverage","entry_price","exit_price","pnl","exit_reason","confidence","reason","opened_at","closed_at"];
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
}

function Trades() {
  const { userId, positionsVersion } = useBot();
  const { data = [] } = useQuery({
    queryKey: ["trade-history", userId, positionsVersion],
    enabled: !!userId,
    queryFn: async () => (await supabase.from("paper_positions").select("*").eq("user_id", userId!).eq("status", "closed").order("closed_at", { ascending: false }).limit(500)).data ?? [],
    refetchInterval: 10000,
  });

  const download = () => {
    const blob = new Blob([csv(data)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `aletheia-trades-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-semibold">Trade history</h1>
        <button onClick={download} className="flex items-center gap-2 rounded-md border border-panel-border px-3 py-1.5 text-xs hover:bg-panel"><Download className="h-3.5 w-3.5" /> Export CSV</button>
      </div>
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-panel-border text-xs uppercase tracking-widest text-muted-foreground">
            <tr><th className="p-3 text-left">Closed</th><th>Coin</th><th>Side</th><th className="text-right">Entry</th><th className="text-right">Exit</th><th className="text-right">PnL</th><th>Exit</th><th className="text-left p-3">Reason</th></tr>
          </thead>
          <tbody>
            {data.length === 0 && <tr><td colSpan={8} className="py-16 text-center text-sm text-muted-foreground">No closed trades yet</td></tr>}
            {data.map((t: any) => (
              <tr key={t.id} className="border-b border-panel-border/50">
                <td className="p-3 mono text-xs text-muted-foreground">{new Date(t.closed_at).toLocaleString()}</td>
                <td className="mono">{t.coin}</td>
                <td className={`mono ${t.side === "long" ? "text-bull" : "text-bear"}`}>{t.side.toUpperCase()}</td>
                <td className="mono text-right">{(+t.entry_price).toFixed(6)}</td>
                <td className="mono text-right">{(+t.exit_price).toFixed(6)}</td>
                <td className={`mono text-right ${+t.pnl >= 0 ? "text-bull" : "text-bear"}`}>{+t.pnl >= 0 ? "+" : ""}{(+t.pnl).toFixed(2)}</td>
                <td className="text-xs text-muted-foreground">{t.exit_reason}</td>
                <td className="p-3 max-w-lg text-xs text-muted-foreground">{t.reason}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
