-- Keep the masonic degree coherent with the institutional role.
UPDATE public.members
SET degree = CASE
  WHEN role_id IN ('apr', 'her') THEN 'aprendiz'
  WHEN role_id = 'comp' THEN 'companero'
  ELSE 'maestro'
END,
updated_at = now();

CREATE OR REPLACE FUNCTION public.enforce_degree_by_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.degree := CASE
    WHEN NEW.role_id IN ('apr', 'her') THEN 'aprendiz'
    WHEN NEW.role_id = 'comp' THEN 'companero'
    ELSE 'maestro'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_venerable_master_degree ON public.members;
DROP TRIGGER IF EXISTS trg_enforce_degree_by_role ON public.members;
CREATE TRIGGER trg_enforce_degree_by_role
BEFORE INSERT OR UPDATE OF role_id, degree ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.enforce_degree_by_role();

REVOKE ALL ON FUNCTION public.enforce_degree_by_role() FROM PUBLIC;
