-- La identidad y el acceso deben compartir siempre el mismo estado.
CREATE OR REPLACE FUNCTION public.sync_member_identity_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET identity_status = NEW.identity_status,
      identity_verified = NEW.identity_verified,
      updated_at = now()
  WHERE member_id = NEW.id OR id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_member_identity_status ON public.members;
CREATE TRIGGER trg_sync_member_identity_status
AFTER INSERT OR UPDATE OF identity_status, identity_verified ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.sync_member_identity_status();

REVOKE ALL ON FUNCTION public.sync_member_identity_status() FROM PUBLIC;

-- Corrige perfiles que quedaron desincronizados antes de instalar el trigger.
UPDATE public.profiles p
SET identity_status = m.identity_status,
    identity_verified = m.identity_verified,
    updated_at = now()
FROM public.members m
WHERE m.id = p.member_id OR m.id = p.id;
