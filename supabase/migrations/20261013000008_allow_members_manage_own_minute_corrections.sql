-- Cada miembro puede corregir o retirar únicamente sus propias observaciones.
DROP POLICY IF EXISTS "Members update own corrections" ON public.minute_corrections;
CREATE POLICY "Members update own corrections"
  ON public.minute_corrections FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Members delete own corrections" ON public.minute_corrections;
CREATE POLICY "Members delete own corrections"
  ON public.minute_corrections FOR DELETE TO authenticated
  USING (author_id = auth.uid());
