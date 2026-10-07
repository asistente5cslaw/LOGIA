-- El Secretario debe tener en Supabase el mismo conjunto de permisos que el Administrador.
UPDATE public.roles
SET technical_role = 'admin', updated_at = now()
WHERE id = 'sec';

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'sec', id
FROM public.permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;
