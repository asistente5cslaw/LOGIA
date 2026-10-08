-- Una tenida puede tener varios tramos rituales, uno por grado, sin duplicar
-- el evento del calendario. Cada acta puede enlazarse a uno de estos tramos.

CREATE TABLE IF NOT EXISTS public.event_degree_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  degree TEXT NOT NULL CHECK (degree IN ('aprendiz', 'companero', 'maestro')),
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  start_time TIME WITHOUT TIME ZONE,
  end_time TIME WITHOUT TIME ZONE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (event_id, degree),
  UNIQUE (event_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_event_degree_segments_event
  ON public.event_degree_segments(event_id, sequence);

ALTER TABLE public.event_degree_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read event degree segments" ON public.event_degree_segments;
CREATE POLICY "Authenticated users read event degree segments"
  ON public.event_degree_segments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id AND e.deleted_at IS NULL
  ));

DROP POLICY IF EXISTS "Authorized users manage event degree segments" ON public.event_degree_segments;
CREATE POLICY "Authorized users manage event degree segments"
  ON public.event_degree_segments FOR ALL TO authenticated
  USING (public.is_venerable_or_admin_secretary())
  WITH CHECK (public.is_venerable_or_admin_secretary());

ALTER TABLE public.minutes
  ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES public.event_degree_segments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_minutes_segment_id ON public.minutes(segment_id);

-- Las tenidas existentes conservan su comportamiento anterior: se convierten
-- en un único tramo con el grado que ya tenían.
INSERT INTO public.event_degree_segments (event_id, degree, sequence)
SELECT e.id, e.degree_required, 1
FROM public.events e
WHERE NOT EXISTS (
    SELECT 1 FROM public.event_degree_segments s WHERE s.event_id = e.id
  )
ON CONFLICT (event_id, degree) DO NOTHING;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES public.event_degree_segments(id) ON DELETE CASCADE;

-- Vincula los registros históricos al único tramo que tenían antes de esta
-- migración y permite registrar al mismo hermano en distintos tramos de una
-- misma tenida.
UPDATE public.attendance a
SET segment_id = s.id
FROM public.event_degree_segments s
WHERE a.segment_id IS NULL
  AND s.event_id = a.event_id
  AND s.sequence = 1;

ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_event_id_member_id_key;

ALTER TABLE public.attendance
  ALTER COLUMN segment_id SET NOT NULL;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_event_segment_member_key UNIQUE (event_id, segment_id, member_id);

CREATE INDEX IF NOT EXISTS idx_attendance_segment_id ON public.attendance(segment_id);

CREATE OR REPLACE FUNCTION public.ensure_event_degree_segment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.event_degree_segments (event_id, degree, sequence)
  VALUES (NEW.id, NEW.degree_required, 1)
  ON CONFLICT (event_id, degree) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_event_degree_segment ON public.events;
CREATE TRIGGER trg_ensure_event_degree_segment
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.ensure_event_degree_segment();

REVOKE ALL ON FUNCTION public.ensure_event_degree_segment() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.validate_minute_degree_segment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  segment_event_id UUID;
  segment_degree TEXT;
BEGIN
  IF NEW.segment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT event_id, degree INTO segment_event_id, segment_degree
  FROM public.event_degree_segments
  WHERE id = NEW.segment_id;

  IF segment_event_id IS NULL OR NEW.event_id IS NULL OR segment_event_id <> NEW.event_id THEN
    RAISE EXCEPTION 'El tramo del acta no pertenece a la tenida indicada.';
  END IF;
  IF segment_degree <> NEW.degree THEN
    RAISE EXCEPTION 'El grado del acta no coincide con el tramo seleccionado.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_minute_degree_segment ON public.minutes;
CREATE TRIGGER trg_validate_minute_degree_segment
  BEFORE INSERT OR UPDATE OF event_id, degree, segment_id ON public.minutes
  FOR EACH ROW EXECUTE FUNCTION public.validate_minute_degree_segment();

REVOKE ALL ON FUNCTION public.validate_minute_degree_segment() FROM PUBLIC;

