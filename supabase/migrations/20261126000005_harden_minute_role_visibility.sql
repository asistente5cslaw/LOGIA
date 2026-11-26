-- Cuando un documento se configura por roles, el rol es la única regla de
-- acceso para miembros regulares. Los accesos individuales históricos no
-- deben ampliar esa visibilidad.
CREATE OR REPLACE FUNCTION public.can_read_minute(target_minute_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.has_verified_identity() AND EXISTS (
    SELECT 1
    FROM public.minutes m
    WHERE m.id = target_minute_id
      AND m.deleted_at IS NULL
      AND (
        public.is_venerable_or_admin_secretary()
        OR EXISTS (
          SELECT 1
          FROM public.members member_record
          JOIN public.profiles profile_record ON profile_record.id = auth.uid()
          WHERE lower(member_record.email) = lower(auth.jwt() ->> 'email')
            AND m.status IN ('circulada', 'aprobada')
            AND (
              CASE
                WHEN m.visibility_mode = 'roles' THEN
                  COALESCE(profile_record.role_id, 'her') IN ('her', 'apr', 'comp', 'mae', 'pm', 'tes', 'vig', 'sec', 'vm', 'pv', 'sv', 'vmi')
                  AND (
                    CASE profile_record.role_id
                      WHEN 'her' THEN 'apr'
                      WHEN 'pv' THEN 'vig'
                      WHEN 'sv' THEN 'vig'
                      WHEN 'vmi' THEN 'pm'
                      ELSE profile_record.role_id
                    END
                  ) = ANY(m.allowed_role_ids)
                WHEN member_record.degree = 'aprendiz' THEN m.degree = 'aprendiz'
                WHEN member_record.degree = 'companero' THEN m.degree IN ('aprendiz', 'companero')
                WHEN member_record.degree = 'maestro' THEN m.degree IN ('aprendiz', 'companero', 'maestro')
                ELSE FALSE
              END
              OR (
                m.visibility_mode <> 'roles'
                AND EXISTS (
                  SELECT 1
                  FROM public.minute_access access_record
                  WHERE access_record.minute_id = m.id
                    AND public.is_member_owner(access_record.member_id)
                )
              )
            )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_read_minute(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_minute(UUID) TO authenticated;
