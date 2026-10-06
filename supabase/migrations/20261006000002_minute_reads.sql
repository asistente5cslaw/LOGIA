CREATE TABLE IF NOT EXISTS public.minute_reads (
  minute_id UUID NOT NULL REFERENCES public.minutes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (minute_id, user_id)
);

ALTER TABLE public.minute_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own minute reads" ON public.minute_reads;
CREATE POLICY "Users manage own minute reads" ON public.minute_reads
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
