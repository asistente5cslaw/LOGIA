-- Las tenidas se dirigen por rol institucional, no por grado masónico.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS role_required TEXT;

UPDATE public.events
SET role_required = CASE degree_required
  WHEN 'companero' THEN 'comp'
  WHEN 'maestro' THEN 'mae'
  ELSE 'apr'
END
WHERE role_required IS NULL;

CREATE INDEX IF NOT EXISTS idx_events_role_required ON public.events(role_required);
