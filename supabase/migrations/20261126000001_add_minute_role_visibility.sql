-- Permite restringir actas, resoluciones y comunicaciones a roles institucionales.
ALTER TABLE public.minutes
  ADD COLUMN IF NOT EXISTS allowed_role_ids TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.minutes
  DROP CONSTRAINT IF EXISTS minutes_allowed_role_ids_check;

ALTER TABLE public.minutes
  ADD CONSTRAINT minutes_allowed_role_ids_check
  CHECK (allowed_role_ids <@ ARRAY['adm', 'vm', 'sec', 'tes', 'vig', 'pm', 'mae', 'comp', 'apr']::TEXT[]);

CREATE INDEX IF NOT EXISTS idx_minutes_allowed_role_ids
  ON public.minutes USING GIN (allowed_role_ids);

CREATE OR REPLACE FUNCTION public.can_read_minute(target_minute_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.has_verified_identity() AND EXISTS (
    SELECT 1 FROM public.minutes m
    WHERE m.id = target_minute_id AND m.deleted_at IS NULL
      AND (
        public.is_venerable_or_admin_secretary()
        OR EXISTS (
          SELECT 1
          FROM public.members member_record
          JOIN public.profiles profile_record ON profile_record.id = auth.uid()
          WHERE lower(member_record.email) = lower(auth.jwt() ->> 'email')
            AND m.status IN ('circulada', 'aprobada')
            AND (
              COALESCE(cardinality(m.allowed_role_ids), 0) = 0
              OR COALESCE(profile_record.role_id, 'her') = ANY(m.allowed_role_ids)
              OR (profile_record.role_id = 'her' AND 'apr' = ANY(m.allowed_role_ids))
            )
            AND CASE member_record.degree
              WHEN 'aprendiz' THEN m.degree = 'aprendiz'
              WHEN 'companero' THEN m.degree IN ('aprendiz', 'companero')
              WHEN 'maestro' THEN m.degree IN ('aprendiz', 'companero', 'maestro')
              ELSE FALSE
            END
        )
        OR EXISTS (
          SELECT 1 FROM public.minute_access access_record
          WHERE access_record.minute_id = m.id
            AND public.is_member_owner(access_record.member_id)
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_read_minute(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_minute(UUID) TO authenticated;
