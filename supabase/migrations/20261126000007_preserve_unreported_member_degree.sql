-- Un hermano del padrón sin cuenta puede tener el grado aún no informado.
-- Los miembros registrados continúan teniendo el grado coherente con su rol.
CREATE OR REPLACE FUNCTION public.enforce_degree_by_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NULL AND NEW.identity_status = 'not_started' AND NEW.role_id = 'her' THEN
    NEW.degree := NULL;
  ELSE
    NEW.degree := CASE
      WHEN NEW.role_id IN ('apr', 'her') THEN 'aprendiz'
      WHEN NEW.role_id = 'comp' THEN 'companero'
      ELSE 'maestro'
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_degree_by_role ON public.members;
CREATE TRIGGER trg_enforce_degree_by_role
BEFORE INSERT OR UPDATE OF role_id, degree ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.enforce_degree_by_role();

UPDATE public.members
SET role_id = 'her',
    degree = NULL,
    updated_at = now()
WHERE email IS NULL
  AND identity_status = 'not_started';

REVOKE ALL ON FUNCTION public.enforce_degree_by_role() FROM PUBLIC;
