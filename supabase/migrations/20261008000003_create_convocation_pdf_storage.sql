ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS convocation_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS convocation_pdf_file_name TEXT,
  ADD COLUMN IF NOT EXISTS convocation_pdf_file_size INTEGER;

INSERT INTO storage.buckets (id, name, public)
VALUES ('convocation-pdfs', 'convocation-pdfs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Authorized users can view convocation PDFs" ON storage.objects;
CREATE POLICY "Authorized users can view convocation PDFs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'convocation-pdfs'
  AND EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = (storage.foldername(name))[1]::uuid
      AND e.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "Secretaries upload convocation PDFs" ON storage.objects;
CREATE POLICY "Secretaries upload convocation PDFs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'convocation-pdfs' AND public.is_admin_or_secretary());

DROP POLICY IF EXISTS "Secretaries update convocation PDFs" ON storage.objects;
CREATE POLICY "Secretaries update convocation PDFs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'convocation-pdfs' AND public.is_admin_or_secretary())
WITH CHECK (bucket_id = 'convocation-pdfs' AND public.is_admin_or_secretary());

DROP POLICY IF EXISTS "Secretaries delete convocation PDFs" ON storage.objects;
CREATE POLICY "Secretaries delete convocation PDFs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'convocation-pdfs' AND public.is_admin_or_secretary());
