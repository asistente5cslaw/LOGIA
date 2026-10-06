-- Rol técnico institucional de Administrador y asignación de la cuenta principal.
-- Secretario conserva acceso completo a la operación diaria; Administrador añade
-- una cuenta técnica separada para mantenimiento y configuración del sistema.

INSERT INTO public.roles (id, name, category, "order", technical_role)
VALUES ('adm', 'Administrador', 'dignatario', 0, 'admin')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  "order" = EXCLUDED."order",
  technical_role = EXCLUDED.technical_role,
  updated_at = now();

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'adm', id FROM public.permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Denzel queda como Administrador por su correo normalizado, conservando la
-- ficha, identidad, selfie y demás datos existentes.
UPDATE public.profiles
SET role_id = 'adm',
    technical_role = 'admin',
    updated_at = now()
WHERE lower(trim(email)) = 'asistente4@castillosucre.com';

UPDATE public.members
SET role_id = 'adm',
    updated_at = now()
WHERE lower(trim(email)) = 'asistente4@castillosucre.com';

-- Si la cuenta se vuelve a registrar en el futuro, se le vuelve a asignar el
-- rol de Administrador automáticamente, sin depender del frontend.
CREATE OR REPLACE FUNCTION public.assign_designated_admin_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(trim(NEW.email)) = 'asistente4@castillosucre.com' THEN
    UPDATE public.profiles
    SET role_id = 'adm', technical_role = 'admin', updated_at = now()
    WHERE id = NEW.id;

    UPDATE public.members
    SET role_id = 'adm', updated_at = now()
    WHERE lower(trim(email)) = 'asistente4@castillosucre.com';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_designated_admin_role ON public.profiles;
CREATE TRIGGER trg_assign_designated_admin_role
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_designated_admin_role();

REVOKE ALL ON FUNCTION public.assign_designated_admin_role() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.assign_designated_admin_member_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(trim(NEW.email)) = 'asistente4@castillosucre.com' THEN
    UPDATE public.members
    SET role_id = 'adm', updated_at = now()
    WHERE id = NEW.id;

    UPDATE public.profiles
    SET role_id = 'adm', technical_role = 'admin', member_id = NEW.id, updated_at = now()
    WHERE lower(trim(email)) = 'asistente4@castillosucre.com';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_designated_admin_member_role ON public.members;
CREATE TRIGGER trg_assign_designated_admin_member_role
AFTER INSERT ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.assign_designated_admin_member_role();

REVOKE ALL ON FUNCTION public.assign_designated_admin_member_role() FROM PUBLIC;
