-- Marca automáticamente como culminadas las reuniones cuyo horario ya pasó.
-- Se ejecuta al abrir/actualizar el calendario y queda persistido en events.

CREATE OR REPLACE FUNCTION public.mark_past_events_completed()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    UPDATE public.events
    SET status = 'celebrada', updated_at = now()
    WHERE deleted_at IS NULL
      AND status IN ('programada', 'convocada')
      AND (
        (
          COALESCE(end_date, start_date)
          + COALESCE(
              end_time,
              CASE WHEN is_all_day THEN time '23:59:59' ELSE time '23:59:59' END
            )
        ) AT TIME ZONE 'America/Panama'
      ) < now();

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RETURN affected_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_past_events_completed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_past_events_completed() TO authenticated;
