ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_category TEXT;

UPDATE public.events
SET event_category = CASE WHEN is_meeting THEN 'tenida' ELSE 'otro' END
WHERE event_category IS NULL;

ALTER TABLE public.events
  ALTER COLUMN event_category SET DEFAULT 'tenida',
  ALTER COLUMN event_category SET NOT NULL;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_event_category_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_event_category_check
  CHECK (event_category IN ('tenida', 'reunion_masonica', 'reunion_fraternal', 'otro'));
