import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const HL_INFO = "https://api.hyperliquid.xyz/info";
const DEFAULT_PAPER_EQUITY = 10000;

export const resetPaperAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ closed: number; newEquity: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: openPos, error: fetchErr } = await supabaseAdmin
      .from("paper_positions")
      .select("*")
      .eq("user_id", context.userId)
      .eq("status", "open");

    if (fetchErr) throw new Error(fetchErr.message);

    const res = await fetch(HL_INFO, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "allMids" }),
    });
    const mids = (await res.json()) as Record<string, string>;

    let closed = 0;
    for (const p of openPos ?? []) {
      const mark = mids[p.coin] ? +mids[p.coin] : p.entry_price;
      void mark;
      closed++;
    }

    // Wipe all paper history so stats/equity curve start clean
    await supabaseAdmin.from("paper_positions").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("equity_snapshots").delete().eq("user_id", context.userId);

    await supabaseAdmin
      .from("bot_settings")
      .update({ paper_equity: DEFAULT_PAPER_EQUITY })
      .eq("user_id", context.userId);

    await supabaseAdmin.from("equity_snapshots").insert({
      user_id: context.userId,
      equity: DEFAULT_PAPER_EQUITY,
    });

    await supabaseAdmin.from("bot_events").insert({
      user_id: context.userId,
      level: "info",
      message: `Paper account reset. ${closed} position(s) cleared, equity reset to ${DEFAULT_PAPER_EQUITY} USDC.`,
      meta: { closed, newEquity: DEFAULT_PAPER_EQUITY },
    });

    return { closed, newEquity: DEFAULT_PAPER_EQUITY };
  });
