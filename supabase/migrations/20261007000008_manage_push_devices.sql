ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.push_subscriptions SET enabled = TRUE WHERE enabled IS NULL;

DROP POLICY IF EXISTS "Designated admin can update push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Designated admin can update push subscriptions" ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (public.is_designated_push_admin())
  WITH CHECK (public.is_designated_push_admin());

DROP POLICY IF EXISTS "Designated admin can delete push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Designated admin can delete push subscriptions" ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (public.is_designated_push_admin());
