CREATE OR REPLACE FUNCTION public.is_designated_push_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND lower(trim(email)) = 'asistente4@castillosucre.com'
      AND role_id = 'adm'
      AND coalesce(access_disabled, false) = false
  );
$$;

REVOKE ALL ON FUNCTION public.is_designated_push_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_designated_push_admin() TO authenticated;

DROP POLICY IF EXISTS "Admins can view push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Admins can view push subscriptions" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_designated_push_admin());
