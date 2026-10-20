-- Solo los usuarios cuyo cargo institucional es Administrador pueden ver
-- o asignar el rol adm a nivel de base de datos.
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role_id = 'adm'
      AND coalesce(access_disabled, false) = false
  );
$$;

REVOKE ALL ON FUNCTION public.is_system_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;

DROP POLICY IF EXISTS "Admins can manage profile roles" ON public.profiles;
CREATE POLICY "Admins can manage profile roles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_venerable_or_admin_secretary()
    AND (role_id <> 'adm' OR public.is_system_admin())
  )
  WITH CHECK (
    public.is_venerable_or_admin_secretary()
    AND (role_id <> 'adm' OR public.is_system_admin())
  );

DROP POLICY IF EXISTS "Admins can manage members" ON public.members;
CREATE POLICY "Admins can manage members" ON public.members
  FOR ALL TO authenticated
  USING (
    public.is_venerable_or_admin_secretary()
    AND (role_id <> 'adm' OR public.is_system_admin())
  )
  WITH CHECK (
    public.is_venerable_or_admin_secretary()
    AND (role_id <> 'adm' OR public.is_system_admin())
  );
