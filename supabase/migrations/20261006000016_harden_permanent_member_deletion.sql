-- Completa la limpieza de referencias antes de eliminar definitivamente Auth.

CREATE OR REPLACE FUNCTION public.permanently_delete_member(target_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor_role TEXT;
  member_email TEXT;
  auth_user_id UUID;
BEGIN
  SELECT role_id INTO actor_role FROM public.profiles WHERE id = auth.uid();
  IF actor_role IS DISTINCT FROM 'vm' THEN
    RAISE EXCEPTION 'Solo el Venerable Maestro puede eliminar definitivamente un usuario.' USING ERRCODE = '42501';
  END IF;

  SELECT m.email, p.id INTO member_email, auth_user_id
  FROM public.members m
  LEFT JOIN public.profiles p ON p.member_id = m.id
  WHERE m.id = target_member_id;
  IF member_email IS NULL THEN
    RAISE EXCEPTION 'El miembro no existe.' USING ERRCODE = 'P0002';
  END IF;

  IF auth_user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.minutes WHERE author_id = auth_user_id)
    OR EXISTS (SELECT 1 FROM public.minute_corrections WHERE author_id = auth_user_id)
  ) THEN
    RAISE EXCEPTION 'No se puede eliminar porque existen actas o correcciones históricas asociadas a este usuario.' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.audit_logs (action, entity, entity_id, user_id, user_email, details)
  VALUES ('ELIMINAR_DEFINITIVAMENTE_MIEMBRO', 'members', target_member_id::TEXT,
    auth.uid(), auth.jwt() ->> 'email', jsonb_build_object('deletedMemberEmail', member_email));

  UPDATE public.invitations SET used_by = NULL, created_by = NULL WHERE used_by = auth_user_id OR created_by = auth_user_id;
  UPDATE public.identity_verifications SET verified_by = NULL WHERE verified_by = auth_user_id;
  UPDATE public.events SET conflict_approved_by = NULL, created_by = NULL, updated_by = NULL WHERE conflict_approved_by = auth_user_id OR created_by = auth_user_id OR updated_by = auth_user_id;
  UPDATE public.event_conflicts SET resolved_by = NULL WHERE resolved_by = auth_user_id;
  UPDATE public.attendance SET updated_by = NULL WHERE updated_by = auth_user_id;
  UPDATE public.attendance_visitors SET created_by = NULL WHERE created_by = auth_user_id;
  UPDATE public.minutes SET created_by = NULL, updated_by = NULL WHERE created_by = auth_user_id OR updated_by = auth_user_id;
  UPDATE public.minute_access SET granted_by = NULL WHERE granted_by = auth_user_id;
  UPDATE public.official_visit_checklist SET verified_by = NULL WHERE verified_by = auth_user_id;

  DELETE FROM public.members WHERE id = target_member_id;
  IF auth_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = auth_user_id;
  END IF;
END;
$$;
