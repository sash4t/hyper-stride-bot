ALTER TABLE public.bot_settings ALTER COLUMN tp_rr SET DEFAULT 3;
UPDATE public.bot_settings SET tp_rr = 3 WHERE tp_rr = 2;