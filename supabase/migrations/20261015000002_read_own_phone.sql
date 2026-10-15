-- Permite que cada usuario compruebe su propio teléfono sin exponer
-- teléfonos de otros miembros a usuarios normales.
CREATE OR REPLACE FUNCTION public.get_my_member_phone()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.phone
  FROM public.members AS m
  WHERE m.id = auth.uid()
    AND m.deleted_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_member_phone() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_member_phone() TO authenticated;
