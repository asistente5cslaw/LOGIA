-- Solo Administración y Secretaría pueden consultar el listado de dispositivos push.
DROP POLICY IF EXISTS "Admins can view push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Admins can view push subscriptions" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_admin_or_secretary());
