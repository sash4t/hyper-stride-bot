ALTER TABLE public.bot_settings
  ALTER COLUMN scalp_tp_pct SET DEFAULT 3,
  ALTER COLUMN scalp_sl_pct SET DEFAULT 2,
  ALTER COLUMN trail_activate_pct SET DEFAULT 0.5,
  ALTER COLUMN trail_dist_pct SET DEFAULT 0.3,
  ALTER COLUMN sl_type SET DEFAULT 'fixed',
  ALTER COLUMN sl_fixed_pct SET DEFAULT 2,
  ALTER COLUMN tp_rr SET DEFAULT 1.5;