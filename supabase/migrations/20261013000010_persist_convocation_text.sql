ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS convocation_text TEXT;
