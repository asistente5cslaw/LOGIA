-- Permite conservar actas de tenidas y registrar resoluciones en el mismo libro.
ALTER TABLE public.minutes
  ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'tenida';

UPDATE public.minutes
SET document_type = 'tenida'
WHERE document_type IS NULL OR document_type = '';

ALTER TABLE public.minutes
  DROP CONSTRAINT IF EXISTS minutes_document_type_check;

ALTER TABLE public.minutes
  ADD CONSTRAINT minutes_document_type_check
  CHECK (document_type IN ('tenida', 'duelo', 'suspension', 'administrativa'));

CREATE INDEX IF NOT EXISTS idx_minutes_document_type
  ON public.minutes(document_type);
