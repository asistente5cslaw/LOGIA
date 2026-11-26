-- El padrón puede contener hermanos sin grado informado. No se debe inventar
-- un grado para permitir registrar su asistencia.
ALTER TABLE public.members
  ALTER COLUMN degree DROP NOT NULL;

UPDATE public.members
SET role_id = 'her',
    degree = NULL,
    updated_at = now()
WHERE email IS NULL
  AND identity_status = 'not_started'
  AND role_id = 'comp';
