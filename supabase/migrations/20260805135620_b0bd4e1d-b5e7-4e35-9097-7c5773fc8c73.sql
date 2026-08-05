ALTER TABLE public.bot_settings
  ADD COLUMN IF NOT EXISTS server_agent_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_review_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS scalp_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS scalp_tp_pct numeric NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS scalp_sl_pct numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS trail_activate_pct numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS trail_dist_pct numeric NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS last_cycle_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_cycle_note text;

CREATE INDEX IF NOT EXISTS bot_settings_agent_idx ON public.bot_settings (server_agent_enabled) WHERE server_agent_enabled;
CREATE INDEX IF NOT EXISTS paper_positions_open_idx ON public.paper_positions (user_id, status);
CREATE INDEX IF NOT EXISTS bot_events_user_ts_idx ON public.bot_events (user_id, ts DESC);