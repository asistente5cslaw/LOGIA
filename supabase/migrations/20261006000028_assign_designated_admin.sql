-- Garantiza que la cuenta administrativa designada conserve el rol correcto.
-- La operación es idempotente para poder ejecutarse en despliegues existentes.

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

UPDATE public.profiles
SET role_id = 'adm',
    technical_role = 'admin',
    updated_at = now()
WHERE lower(trim(email)) = 'asistente4@castillosucre.com';

UPDATE public.members
SET role_id = 'adm',
    updated_at = now()
WHERE lower(trim(email)) = 'asistente4@castillosucre.com';
