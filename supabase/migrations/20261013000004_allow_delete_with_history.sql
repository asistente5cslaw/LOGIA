-- Las correcciones de actas conservan author_name, por lo que la cuenta
-- puede eliminarse sin perder el texto histórico. Se deja author_id nulo.

ALTER TABLE public.minute_corrections
  ALTER COLUMN author_id DROP NOT NULL;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  WHERE con.conrelid = 'public.minute_corrections'::regclass
    AND con.confrelid = 'auth.users'::regclass
    AND con.contype = 'f';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.minute_corrections DROP CONSTRAINT %I', constraint_name);
  END IF;
END;
$$;

ALTER TABLE public.minute_corrections
  ADD CONSTRAINT minute_corrections_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Reemplaza la versión que bloqueaba el borrado cuando existían correcciones.
CREATE OR REPLACE FUNCTION public.permanently_delete_member(target_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor_role TEXT;
  actor_technical_role TEXT;
  member_email TEXT;
  auth_user_id UUID;
BEGIN
  SELECT role_id, technical_role INTO actor_role, actor_technical_role
  FROM public.profiles WHERE id = auth.uid();

  IF actor_role NOT IN ('vm', 'sec')
     AND actor_technical_role NOT IN ('admin', 'secretary') THEN
    RAISE EXCEPTION 'Solo Administración, Secretaría o el Venerable Maestro pueden eliminar definitivamente un usuario.' USING ERRCODE = '42501';
  END IF;

  SELECT m.email, COALESCE(p_by_member.id, p_by_user.id)
  INTO member_email, auth_user_id
  FROM public.members m
  LEFT JOIN public.profiles p_by_member ON p_by_member.member_id = m.id
  LEFT JOIN public.profiles p_by_user ON p_by_user.id = m.id
  WHERE m.id = target_member_id;

  IF member_email IS NULL THEN
    RAISE EXCEPTION 'El miembro no existe.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_logs (action, entity, entity_id, user_id, user_email, details)
  VALUES ('ELIMINAR_DEFINITIVAMENTE_MIEMBRO', 'members', target_member_id::TEXT,
    auth.uid(), auth.jwt() ->> 'email', jsonb_build_object('deletedMemberEmail', member_email));

  UPDATE public.invitations SET used_by = NULL, created_by = NULL
  WHERE used_by = auth_user_id OR created_by = auth_user_id;
  UPDATE public.identity_verifications SET verified_by = NULL WHERE verified_by = auth_user_id;
  UPDATE public.events
  SET conflict_approved_by = NULL, created_by = NULL, updated_by = NULL
  WHERE conflict_approved_by = auth_user_id OR created_by = auth_user_id OR updated_by = auth_user_id;
  UPDATE public.event_conflicts SET resolved_by = NULL WHERE resolved_by = auth_user_id;
  UPDATE public.attendance SET updated_by = NULL WHERE updated_by = auth_user_id;
  UPDATE public.attendance_visitors SET created_by = NULL WHERE created_by = auth_user_id;
  UPDATE public.minutes SET created_by = NULL, updated_by = NULL
  WHERE created_by = auth_user_id OR updated_by = auth_user_id;
  UPDATE public.minute_access SET granted_by = NULL WHERE granted_by = auth_user_id;
  UPDATE public.official_visit_checklist SET verified_by = NULL WHERE verified_by = auth_user_id;
  DELETE FROM public.push_notifications WHERE user_id = auth_user_id;
  DELETE FROM public.push_subscriptions WHERE user_id = auth_user_id;
  DELETE FROM public.members WHERE id = target_member_id;

  IF auth_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = auth_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.permanently_delete_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.permanently_delete_member(UUID) TO authenticated;
