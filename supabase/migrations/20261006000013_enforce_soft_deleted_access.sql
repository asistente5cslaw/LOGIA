-- Una baja lógica conserva el historial, pero revoca el acceso de la cuenta.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_disabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_access_disabled
  ON public.profiles(access_disabled);

CREATE OR REPLACE FUNCTION public.sync_member_access_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET access_disabled = (NEW.deleted_at IS NOT NULL OR NEW.is_active = FALSE),
      updated_at = now()
  WHERE member_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_member_access_status ON public.members;
CREATE TRIGGER trg_sync_member_access_status
AFTER INSERT OR UPDATE OF is_active, deleted_at ON public.members
FOR EACH ROW EXECUTE FUNCTION public.sync_member_access_status();

UPDATE public.profiles p
SET access_disabled = (m.deleted_at IS NOT NULL OR m.is_active = FALSE),
    updated_at = now()
FROM public.members m
WHERE m.id = p.member_id;
