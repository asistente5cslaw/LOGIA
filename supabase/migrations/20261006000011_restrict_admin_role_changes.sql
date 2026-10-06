-- Restricciones jerárquicas para cambios de cargos.
-- Secretario: no puede modificar Secretario/Venerable.
-- Venerable: no puede modificar Venerable.

CREATE OR REPLACE FUNCTION public.enforce_role_change_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor_role TEXT;
BEGIN
  IF OLD.role_id IS DISTINCT FROM NEW.role_id THEN
    SELECT role_id INTO actor_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF actor_role = 'sec' AND OLD.role_id IN ('sec', 'vm') THEN
      RAISE EXCEPTION 'Un Secretario no puede cambiar el cargo de otro Secretario o Venerable.'
        USING ERRCODE = '42501';
    END IF;

    IF actor_role = 'vm' AND OLD.role_id = 'vm' THEN
      RAISE EXCEPTION 'Un Venerable no puede cambiar el cargo de otro Venerable.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_member_role_changes ON public.members;
CREATE TRIGGER trg_restrict_member_role_changes
BEFORE UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.enforce_role_change_hierarchy();

DROP TRIGGER IF EXISTS trg_restrict_profile_role_changes ON public.profiles;
CREATE TRIGGER trg_restrict_profile_role_changes
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_role_change_hierarchy();
