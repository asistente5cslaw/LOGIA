-- Campos de identidad usados por el registro con selfie.
-- El trigger de registro crea el miembro; el frontend posteriormente actualiza
-- este mismo registro con el resultado de la validación.
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS identity_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS selfie_url TEXT,
  ADD COLUMN IF NOT EXISTS identity_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_validated_by TEXT,
  ADD COLUMN IF NOT EXISTS identity_notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'members_identity_status_check'
      AND conrelid = 'public.members'::regclass
  ) THEN
    ALTER TABLE public.members
      ADD CONSTRAINT members_identity_status_check
      CHECK (identity_status IN ('pending', 'verified', 'rejected', 'not_started'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_members_identity_status ON public.members(identity_status);
