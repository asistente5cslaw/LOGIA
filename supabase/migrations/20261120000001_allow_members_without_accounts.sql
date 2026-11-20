-- Permite conservar en el padrón a hermanos que todavía no tienen cuenta.
-- La cuenta de autenticación continúa siendo opcional y separada de members.
ALTER TABLE public.members
  ALTER COLUMN email DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_members_name_search
  ON public.members (lower(first_name), lower(last_name));
