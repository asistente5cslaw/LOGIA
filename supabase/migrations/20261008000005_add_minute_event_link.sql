-- Permite vincular cada acta con la reunión o convocatoria del calendario.
ALTER TABLE public.minutes
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_title TEXT;

CREATE INDEX IF NOT EXISTS idx_minutes_event_id ON public.minutes(event_id);
