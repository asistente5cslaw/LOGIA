-- Solo la cuenta con el cargo Administrador puede modificar la configuración
-- institucional, incluido el correo del cargo de Secretaría.
CREATE OR REPLACE FUNCTION public.is_system_administrator()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role_id = 'adm'
      AND technical_role = 'admin'
      AND COALESCE(access_disabled, false) = false
  );
$$;

REVOKE ALL ON FUNCTION public.is_system_administrator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_system_administrator() TO authenticated;

DROP POLICY IF EXISTS "Administrator can update lodge settings" ON public.lodge_settings;
CREATE POLICY "Administrator can update lodge settings"
  ON public.lodge_settings
  FOR UPDATE TO authenticated
  USING (public.is_system_administrator())
  WITH CHECK (public.is_system_administrator());

GRANT UPDATE ON public.lodge_settings TO authenticated;
