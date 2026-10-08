INSERT INTO storage.buckets (id, name, public)
VALUES ('minutes-pdfs', 'minutes-pdfs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Authorized users can view minute PDFs" ON storage.objects;
CREATE POLICY "Authorized users can view minute PDFs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'minutes-pdfs'
  AND (
    public.is_admin_or_secretary()
    OR public.can_read_minute((storage.foldername(name))[1]::uuid)
  )
);

DROP POLICY IF EXISTS "Secretaries upload minute PDFs" ON storage.objects;
CREATE POLICY "Secretaries upload minute PDFs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'minutes-pdfs' AND public.is_admin_or_secretary());

DROP POLICY IF EXISTS "Secretaries update minute PDFs" ON storage.objects;
CREATE POLICY "Secretaries update minute PDFs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'minutes-pdfs' AND public.is_admin_or_secretary())
WITH CHECK (bucket_id = 'minutes-pdfs' AND public.is_admin_or_secretary());

DROP POLICY IF EXISTS "Secretaries delete minute PDFs" ON storage.objects;
CREATE POLICY "Secretaries delete minute PDFs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'minutes-pdfs' AND public.is_admin_or_secretary());
