
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Bot settings
CREATE TABLE public.bot_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'paper' CHECK (mode IN ('paper','live')),
  strategy_mode TEXT NOT NULL DEFAULT 'balanced' CHECK (strategy_mode IN ('conservative','balanced','aggressive')),
  paper_equity NUMERIC NOT NULL DEFAULT 10000,
  max_leverage NUMERIC NOT NULL DEFAULT 5,
  position_size_pct NUMERIC NOT NULL DEFAULT 5,
  max_exposure_pct NUMERIC NOT NULL DEFAULT 25,
  daily_loss_pct NUMERIC NOT NULL DEFAULT 5,
  max_positions INT NOT NULL DEFAULT 4,
  min_confidence NUMERIC NOT NULL DEFAULT 70,
  sl_type TEXT NOT NULL DEFAULT 'atr' CHECK (sl_type IN ('atr','fixed')),
  sl_atr_mult NUMERIC NOT NULL DEFAULT 1.5,
  sl_fixed_pct NUMERIC NOT NULL DEFAULT 2,
  tp_rr NUMERIC NOT NULL DEFAULT 2,
  trailing_enabled BOOLEAN NOT NULL DEFAULT true,
  bot_enabled BOOLEAN NOT NULL DEFAULT false,
  kill_switch_engaged BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_settings TO authenticated;
GRANT ALL ON public.bot_settings TO service_role;
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.bot_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Paper positions
CREATE TABLE public.paper_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coin TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long','short')),
  size NUMERIC NOT NULL,
  notional NUMERIC NOT NULL,
  leverage NUMERIC NOT NULL,
  entry_price NUMERIC NOT NULL,
  stop_loss NUMERIC NOT NULL,
  take_profit NUMERIC NOT NULL,
  trail_high NUMERIC,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  exit_price NUMERIC,
  exit_reason TEXT,
  pnl NUMERIC,
  confidence NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  indicators JSONB,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);
CREATE INDEX ON public.paper_positions (user_id, status);
CREATE INDEX ON public.paper_positions (user_id, opened_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paper_positions TO authenticated;
GRANT ALL ON public.paper_positions TO service_role;
ALTER TABLE public.paper_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own positions" ON public.paper_positions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Equity snapshots
CREATE TABLE public.equity_snapshots (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  equity NUMERIC NOT NULL,
  realized_pnl NUMERIC NOT NULL DEFAULT 0,
  unrealized_pnl NUMERIC NOT NULL DEFAULT 0
);
CREATE INDEX ON public.equity_snapshots (user_id, ts DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equity_snapshots TO authenticated;
GRANT ALL ON public.equity_snapshots TO service_role;
ALTER TABLE public.equity_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own snapshots" ON public.equity_snapshots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Bot events / log
CREATE TABLE public.bot_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info','warn','error','trade')),
  message TEXT NOT NULL,
  meta JSONB
);
CREATE INDEX ON public.bot_events (user_id, ts DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_events TO authenticated;
GRANT ALL ON public.bot_events TO service_role;
ALTER TABLE public.bot_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own events" ON public.bot_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-create profile + settings on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.bot_settings (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
