-- Vinculación segura de cuentas nuevas con fichas del padrón sin invitación.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS public.member_link_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  candidate_member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_email TEXT NOT NULL,
  source_display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (source_member_id, candidate_member_id, status)
);

ALTER TABLE public.member_link_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.request_member_link(target_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  source_member public.members%ROWTYPE;
  candidate public.members%ROWTYPE;
  current_profile public.profiles%ROWTYPE;
  request_id UUID;
  source_key TEXT;
BEGIN
  SELECT * INTO current_profile FROM public.profiles WHERE id = auth.uid();
  IF current_profile IS NULL OR current_profile.member_id IS DISTINCT FROM target_member_id THEN
    RAISE EXCEPTION 'La cuenta no corresponde a la ficha indicada.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO source_member FROM public.members WHERE id = target_member_id AND deleted_at IS NULL;
  IF source_member IS NULL THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  source_key := regexp_replace(lower(public.unaccent(trim(source_member.first_name || ' ' || source_member.last_name))), '[^a-z0-9]', '', 'g');
  SELECT m.* INTO candidate
  FROM public.members m
  WHERE m.deleted_at IS NULL
    AND m.is_active = TRUE
    AND m.email IS NULL
    AND regexp_replace(lower(public.unaccent(trim(m.first_name || ' ' || m.last_name))), '[^a-z0-9]', '', 'g') = source_key
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.member_id = m.id)
  LIMIT 1;

  IF candidate IS NULL THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  INSERT INTO public.member_link_requests (source_member_id, candidate_member_id, user_id, source_email, source_display_name)
  VALUES (source_member.id, candidate.id, auth.uid(), source_member.email, source_member.first_name || ' ' || source_member.last_name)
  ON CONFLICT (source_member_id, candidate_member_id, status) DO UPDATE SET created_at = now()
  RETURNING id INTO request_id;

  RETURN jsonb_build_object(
    'matched', true,
    'request_id', request_id,
    'candidate_member_id', candidate.id,
    'candidate_name', candidate.first_name || ' ' || candidate.last_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pending_member_link_requests()
RETURNS TABLE (
  id UUID,
  source_member_id UUID,
  candidate_member_id UUID,
  source_email TEXT,
  source_display_name TEXT,
  candidate_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.source_member_id, r.candidate_member_id, r.source_email,
         r.source_display_name,
         c.first_name || ' ' || c.last_name,
         r.created_at
  FROM public.member_link_requests r
  JOIN public.members c ON c.id = r.candidate_member_id
  WHERE r.status = 'pending'
    AND public.is_venerable_or_admin_secretary()
  ORDER BY r.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.review_member_link_request(
  target_request_id UUID,
  approve_request BOOLEAN,
  review_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_row public.member_link_requests%ROWTYPE;
BEGIN
  IF NOT public.is_venerable_or_admin_secretary() THEN
    RAISE EXCEPTION 'No tienes autorización para vincular cuentas.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO request_row
  FROM public.member_link_requests
  WHERE id = target_request_id AND status = 'pending'
  FOR UPDATE;
  IF request_row IS NULL THEN
    RAISE EXCEPTION 'La solicitud ya fue atendida o no existe.' USING ERRCODE = 'P0002';
  END IF;

  IF approve_request THEN
    UPDATE public.members target
    SET email = source.email,
        phone = COALESCE(target.phone, source.phone),
        identity_verified = source.identity_verified,
        identity_status = source.identity_status,
        selfie_url = source.selfie_url,
        identity_validated_at = source.identity_validated_at,
        identity_validated_by = source.identity_validated_by,
        identity_notes = source.identity_notes,
        updated_at = now()
    FROM public.members source
    WHERE target.id = request_row.candidate_member_id
      AND source.id = request_row.source_member_id;

    INSERT INTO public.attendance (event_id, segment_id, member_id, status, excuse_reason, excuse_submitted_at, updated_by, updated_at)
    SELECT event_id, segment_id, request_row.candidate_member_id, status, excuse_reason, excuse_submitted_at, updated_by, updated_at
    FROM public.attendance
    WHERE member_id = request_row.source_member_id
    ON CONFLICT (event_id, segment_id, member_id) DO UPDATE SET
      status = EXCLUDED.status,
      excuse_reason = EXCLUDED.excuse_reason,
      excuse_submitted_at = EXCLUDED.excuse_submitted_at,
      updated_at = EXCLUDED.updated_at;

    DELETE FROM public.attendance WHERE member_id = request_row.source_member_id;
    UPDATE public.profiles SET member_id = request_row.candidate_member_id, updated_at = now() WHERE id = request_row.user_id;
    UPDATE public.members
    SET email = NULL, is_active = FALSE, deleted_at = now(), updated_at = now()
    WHERE id = request_row.source_member_id;
  END IF;

  UPDATE public.member_link_requests
  SET status = CASE WHEN approve_request THEN 'approved' ELSE 'rejected' END,
      reviewed_by = auth.uid(), reviewed_at = now(), notes = review_notes
  WHERE id = request_row.id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_member_link(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_member_link(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.get_pending_member_link_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_member_link_requests() TO authenticated;
REVOKE ALL ON FUNCTION public.review_member_link_request(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_member_link_request(UUID, BOOLEAN, TEXT) TO authenticated;
