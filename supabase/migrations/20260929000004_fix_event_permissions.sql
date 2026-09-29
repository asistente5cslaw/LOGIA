-- Alinea RLS con los permisos de la aplicación: VM y Secretario pueden
-- administrar tenidas, aunque su technical_role sea distinto de secretary.
CREATE OR REPLACE FUNCTION public.is_admin_or_secretary()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND (technical_role IN ('admin', 'secretary') OR role_id IN ('vm', 'sec'))
  );
$$;
