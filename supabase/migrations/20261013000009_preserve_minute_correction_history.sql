-- Las observaciones no se borran físicamente: se conserva su historial.
ALTER TABLE public.minute_corrections
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "Members update own corrections" ON public.minute_corrections;
CREATE POLICY "Members update own corrections"
  ON public.minute_corrections FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Members delete own corrections" ON public.minute_corrections;
-- La eliminación se realiza como UPDATE lógico desde el servicio.
