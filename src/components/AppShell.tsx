import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Activity, BarChart3, History, LayoutDashboard, Radar, Settings, LogOut, Power } from "lucide-react";
import { useBot } from "@/lib/botContext";
import { supabase } from "@/integrations/supabase/client";
import { KillSwitch } from "./KillSwitch";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/positions", label: "Positions", icon: BarChart3 },
  { to: "/scanner", label: "Scanner", icon: Radar },
  { to: "/trades", label: "Trades", icon: History },
  { to: "/strategy", label: "Strategy", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  const { settings, saveSettings } = useBot();

  const signOut = async () => { await supabase.auth.signOut(); nav({ to: "/auth" }); };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-60 flex-col border-r border-panel-border bg-panel">
        <div className="flex items-center gap-2 border-b border-panel-border px-5 py-4">
          <div className="h-6 w-6 rounded bg-primary" />
          <div>
            <div className="mono text-sm font-semibold">ALETHEIA</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Hyperliquid</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = loc.pathname === to;
            return (
              <Link key={to} to={to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
                <Icon className="h-4 w-4" />{label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-panel-border p-3 space-y-2">
          <div className="flex items-center justify-between rounded-md bg-background px-3 py-2">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Bot</div>
              <div className={`text-xs font-semibold ${settings?.bot_enabled ? "text-bull" : "text-muted-foreground"}`}>
                {settings?.kill_switch_engaged ? "KILL SWITCH" : settings?.bot_enabled ? "RUNNING" : "STOPPED"}
              </div>
            </div>
            <button
              disabled={!settings || settings.kill_switch_engaged}
              onClick={() => saveSettings({ bot_enabled: !settings?.bot_enabled })}
              className={`rounded-md p-2 transition ${settings?.bot_enabled ? "bg-bull/20 text-bull" : "bg-muted text-muted-foreground hover:bg-accent"} disabled:opacity-50`}
              title={settings?.bot_enabled ? "Stop bot" : "Start bot"}
            >
              <Power className="h-4 w-4" />
            </button>
          </div>
          <KillSwitch />
          <button onClick={signOut} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
          <div className="text-center text-[10px] text-muted-foreground">Paper trading mode</div>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
