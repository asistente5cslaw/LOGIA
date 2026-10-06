-- Permite que los administradores/secretarios asignen cargos desde el directorio.
-- La función is_admin_or_secretary() es SECURITY DEFINER y evita recursión en RLS.

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage profile roles"
ON public.profiles
FOR UPDATE TO authenticated
USING (public.is_admin_or_secretary())
WITH CHECK (public.is_admin_or_secretary());

GRANT UPDATE (display_name, avatar_url, role_id, technical_role, identity_verified, identity_status)
ON public.profiles TO authenticated;
