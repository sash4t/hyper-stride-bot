GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paper_positions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equity_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

GRANT ALL ON public.bot_settings TO service_role;
GRANT ALL ON public.paper_positions TO service_role;
GRANT ALL ON public.equity_snapshots TO service_role;
GRANT ALL ON public.bot_events TO service_role;
GRANT ALL ON public.profiles TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.bot_events_id_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.equity_snapshots_id_seq TO authenticated, service_role;