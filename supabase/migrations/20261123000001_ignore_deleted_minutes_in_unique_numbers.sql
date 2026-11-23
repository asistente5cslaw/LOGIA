-- Permite reutilizar el número de documentos eliminados lógicamente.
-- Los documentos activos siguen teniendo número y formato únicos por año.

ALTER TABLE public.minutes
  DROP CONSTRAINT IF EXISTS uq_minutes_number_year;

ALTER TABLE public.minutes
  DROP CONSTRAINT IF EXISTS minutes_format_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_minutes_number_year_active
  ON public.minutes (number, year)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_minutes_format_number_active
  ON public.minutes (format_number)
  WHERE deleted_at IS NULL;
