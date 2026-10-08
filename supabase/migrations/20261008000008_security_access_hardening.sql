-- Acceso mínimo al directorio: los miembros normales solo necesitan nombre,
-- apellido, correo, grado y estado básico para las operaciones cotidianas.
CREATE OR REPLACE VIEW public.member_directory
WITH (security_invoker = true)
AS
SELECT id, first_name, last_name, email, role_id, degree, condition,
       joined_at, is_active, deleted_at
FROM public.members;

REVOKE SELECT ON public.members FROM authenticated;
GRANT SELECT (
  id, first_name, last_name, email, role_id, degree, condition,
  joined_at, is_active, deleted_at
) ON public.members TO authenticated;

GRANT SELECT ON public.member_directory TO authenticated;

CREATE OR REPLACE FUNCTION public.get_sensitive_members(
  p_include_inactive BOOLEAN DEFAULT TRUE,
  p_include_deleted BOOLEAN DEFAULT FALSE
)
RETURNS SETOF public.members
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.*
  FROM public.members m
  WHERE public.is_venerable_or_admin_secretary()
    AND (p_include_deleted OR m.deleted_at IS NULL)
    AND (p_include_inactive OR m.is_active = TRUE)
  ORDER BY m.last_name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_sensitive_members(BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sensitive_members(BOOLEAN, BOOLEAN) TO authenticated;

-- Los usuarios pendientes pueden mantener su perfil, pero no consultar el
-- contenido operativo del sistema hasta que Secretaría valide su identidad.
CREATE OR REPLACE FUNCTION public.has_verified_identity()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.identity_status = 'verified'
        OR p.technical_role IN ('admin', 'secretary')
        OR p.role_id IN ('vm', 'sec')
      )
      AND COALESCE(p.access_disabled, FALSE) = FALSE
  );
$$;

REVOKE ALL ON FUNCTION public.has_verified_identity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_verified_identity() TO authenticated;

DROP POLICY IF EXISTS "Events visible to authenticated users" ON public.events;
CREATE POLICY "Verified users view events"
  ON public.events FOR SELECT TO authenticated
  USING (public.has_verified_identity() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Authenticated users can read active members" ON public.members;
CREATE POLICY "Verified users read active member directory"
  ON public.members FOR SELECT TO authenticated
  USING (public.has_verified_identity() AND deleted_at IS NULL AND is_active = TRUE);

DROP POLICY IF EXISTS "Users read their identity verification" ON public.identity_verifications;
CREATE POLICY "Users read their identity verification"
  ON public.identity_verifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_venerable_or_admin_secretary());

-- La identidad nunca puede aprobarse desde el navegador. El usuario solo
-- puede enviar una nueva captura; la aprobación queda reservada al personal
-- autorizado.
CREATE OR REPLACE FUNCTION public.prevent_self_identity_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() = OLD.id AND NOT public.is_venerable_or_admin_secretary() THEN
    NEW.identity_verified := FALSE;
    NEW.identity_status := CASE
      WHEN NEW.identity_status = 'rejected' THEN 'rejected'
      ELSE 'pending'
    END;
    NEW.identity_validated_at := NULL;
    NEW.identity_validated_by := NULL;
    NEW.identity_notes := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_identity_approval ON public.members;
CREATE TRIGGER trg_prevent_self_identity_approval
  BEFORE UPDATE OF identity_verified, identity_status, identity_validated_at,
    identity_validated_by, identity_notes, selfie_url ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_identity_approval();

REVOKE ALL ON FUNCTION public.prevent_self_identity_approval() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.can_read_event(target_event_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.profiles p ON p.id = auth.uid()
    JOIN public.members m ON m.id = p.member_id
    WHERE e.id = target_event_id
      AND e.deleted_at IS NULL
      AND public.has_verified_identity()
      AND (
        p.technical_role IN ('admin', 'secretary')
        OR p.role_id IN ('vm', 'sec')
        OR EXISTS (
          SELECT 1
          FROM public.event_degree_segments s
          WHERE s.event_id = e.id
            AND CASE m.degree
              WHEN 'aprendiz' THEN s.degree = 'aprendiz'
              WHEN 'companero' THEN s.degree IN ('aprendiz', 'companero')
              WHEN 'maestro' THEN TRUE
              ELSE FALSE
            END
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_read_event(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_event(UUID) TO authenticated;

DROP POLICY IF EXISTS "Authorized users can view convocation PDFs" ON storage.objects;
CREATE POLICY "Authorized users can view convocation PDFs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'convocation-pdfs'
    AND public.can_read_event((storage.foldername(name))[1]::uuid)
  );

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
          SELECT 1 FROM public.members member_record
          WHERE lower(member_record.email) = lower(auth.jwt() ->> 'email')
            AND m.status IN ('circulada', 'aprobada', 'firmada', 'archivada')
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

DROP POLICY IF EXISTS "Attendance visible to authenticated" ON public.attendance;
CREATE POLICY "Verified users view attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (public.has_verified_identity() AND (public.is_venerable_or_admin_secretary() OR public.is_member_owner(member_id)));

DROP POLICY IF EXISTS "Members add own attendance" ON public.attendance;
CREATE POLICY "Verified members add own attendance"
  ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (public.has_verified_identity() AND public.is_member_owner(member_id));

DROP POLICY IF EXISTS "Members update own attendance" ON public.attendance;
CREATE POLICY "Verified members update own attendance"
  ON public.attendance FOR UPDATE TO authenticated
  USING (public.has_verified_identity() AND public.is_member_owner(member_id))
  WITH CHECK (public.has_verified_identity() AND public.is_member_owner(member_id));

DROP POLICY IF EXISTS "Members delete own attendance" ON public.attendance;
CREATE POLICY "Verified members delete own attendance"
  ON public.attendance FOR DELETE TO authenticated
  USING (public.has_verified_identity() AND public.is_member_owner(member_id));
