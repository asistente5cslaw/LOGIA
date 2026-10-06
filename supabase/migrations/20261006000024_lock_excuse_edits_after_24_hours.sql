-- El plazo de edición comienza con el primer guardado de la explicación y
-- nunca se reinicia al editarla.

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS excuse_submitted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.enforce_attendance_excuse_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.excuse_submitted_at IS NOT NULL
     AND NEW.excuse_reason IS DISTINCT FROM OLD.excuse_reason
     AND now() >= OLD.excuse_submitted_at + interval '24 hours' THEN
    RAISE EXCEPTION 'El plazo de 24 horas para editar esta excusa ya venció.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status = 'excusa' AND NULLIF(trim(NEW.excuse_reason), '') IS NOT NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.excuse_submitted_at IS NOT NULL THEN
      NEW.excuse_submitted_at := OLD.excuse_submitted_at;
    ELSIF NEW.excuse_submitted_at IS NULL THEN
      NEW.excuse_submitted_at := now();
    END IF;
  ELSE
    NEW.excuse_submitted_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_excuse_deadline ON public.attendance;
CREATE TRIGGER trg_attendance_excuse_deadline
BEFORE INSERT OR UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.enforce_attendance_excuse_deadline();

REVOKE ALL ON FUNCTION public.enforce_attendance_excuse_deadline() FROM PUBLIC;
