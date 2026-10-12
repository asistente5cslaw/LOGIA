-- event_category es la única fuente de verdad para clasificar actividades.
-- is_meeting se conserva temporalmente por compatibilidad con el esquema
-- original, pero queda derivado automáticamente de event_category.

UPDATE public.events
SET event_category = CASE WHEN is_meeting THEN 'tenida' ELSE 'otro' END
WHERE event_category IS NULL;

CREATE OR REPLACE FUNCTION public.sync_event_legacy_meeting_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.is_meeting := (NEW.event_category = 'tenida');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_event_legacy_meeting_flag ON public.events;
CREATE TRIGGER trg_sync_event_legacy_meeting_flag
  BEFORE INSERT OR UPDATE OF event_category ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_event_legacy_meeting_flag();

CREATE INDEX IF NOT EXISTS idx_events_event_category ON public.events(event_category);
