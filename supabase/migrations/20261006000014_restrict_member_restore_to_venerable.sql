-- Solo el Venerable Maestro puede restaurar el acceso de un miembro dado de baja.

CREATE OR REPLACE FUNCTION public.enforce_member_access_restore()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor_role TEXT;
BEGIN
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    SELECT role_id INTO actor_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF actor_role IS DISTINCT FROM 'vm' THEN
      RAISE EXCEPTION 'Solo el Venerable Maestro puede restaurar el acceso de un miembro.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_member_access_restore ON public.members;
CREATE TRIGGER trg_restrict_member_access_restore
BEFORE UPDATE OF deleted_at ON public.members
FOR EACH ROW EXECUTE FUNCTION public.enforce_member_access_restore();
