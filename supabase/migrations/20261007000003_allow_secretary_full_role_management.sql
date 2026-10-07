-- El Secretario tiene acceso completo a la administración de miembros y cargos.
-- Se conserva únicamente la protección contra que un Venerable cambie a otro Venerable.

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

    IF actor_role = 'vm' AND OLD.role_id = 'vm' THEN
      RAISE EXCEPTION 'Un Venerable no puede cambiar el cargo de otro Venerable.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
