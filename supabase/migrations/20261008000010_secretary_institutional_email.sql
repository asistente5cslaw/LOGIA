-- Correo institucional del cargo de Secretaría, separado del correo personal
-- de la persona que tenga actualmente asignado ese rol.
ALTER TABLE public.lodge_settings
  ADD COLUMN IF NOT EXISTS secretary_email TEXT;

UPDATE public.lodge_settings
SET secretary_email = COALESCE(NULLIF(secretary_email, ''), contact_email)
WHERE secretary_email IS NULL OR secretary_email = '';

ALTER TABLE public.lodge_settings
  ALTER COLUMN secretary_email SET DEFAULT 'secretaria@unionfraternal21.org';

ALTER TABLE public.lodge_settings
  ALTER COLUMN secretary_email SET NOT NULL;
