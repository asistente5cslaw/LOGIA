-- Elimina la dirección de demostración que no representa una ubicación confirmada.
UPDATE public.lodge_settings
SET temple_address = '', updated_at = now()
WHERE lower(trim(temple_address)) IN (
  'gran templo masónico, calle 43 bella vista',
  'gran templo masónico, calle 43 bella vista, ciudad de panamá'
);
