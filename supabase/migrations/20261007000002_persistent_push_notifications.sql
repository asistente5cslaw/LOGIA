CREATE TABLE IF NOT EXISTS public.push_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  tag TEXT,
  type TEXT NOT NULL DEFAULT 'aviso',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_push_notifications_user_created
  ON public.push_notifications(user_id, created_at DESC);

ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own push notifications" ON public.push_notifications;
CREATE POLICY "Users read own push notifications" ON public.push_notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own push notifications" ON public.push_notifications;
CREATE POLICY "Users delete own push notifications" ON public.push_notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());
