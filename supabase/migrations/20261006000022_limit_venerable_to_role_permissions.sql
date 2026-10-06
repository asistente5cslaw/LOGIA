-- Venerable Maestro deja de ser un administrador técnico. Conserva sus
-- permisos protocolarios, pero Secretario y Administrador son los únicos con
-- acceso completo.

UPDATE public.roles
SET technical_role = 'dignitary', updated_at = now()
WHERE id = 'vm';

UPDATE public.profiles
SET technical_role = 'dignitary', updated_at = now()
WHERE role_id = 'vm' AND technical_role = 'admin';

CREATE OR REPLACE FUNCTION public.is_admin_or_secretary()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (technical_role IN ('admin', 'secretary') OR role_id = 'sec')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_venerable_or_admin_secretary()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_or_secretary()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role_id = 'vm'
    );
$$;

CREATE OR REPLACE FUNCTION public.can_read_minute(target_minute_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
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

DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_venerable_or_admin_secretary());

DROP POLICY IF EXISTS "Admins can manage profile roles" ON public.profiles;
CREATE POLICY "Admins can manage profile roles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_venerable_or_admin_secretary())
  WITH CHECK (public.is_venerable_or_admin_secretary());

DROP POLICY IF EXISTS "Admins can read members" ON public.members;
CREATE POLICY "Admins can read members" ON public.members
  FOR SELECT TO authenticated USING (public.is_venerable_or_admin_secretary());

DROP POLICY IF EXISTS "Admins can manage members" ON public.members;
CREATE POLICY "Admins can manage members" ON public.members
  FOR ALL TO authenticated
  USING (public.is_venerable_or_admin_secretary())
  WITH CHECK (public.is_venerable_or_admin_secretary());

DROP POLICY IF EXISTS "Admins manage identity verifications" ON public.identity_verifications;
CREATE POLICY "Admins manage identity verifications" ON public.identity_verifications
  FOR ALL TO authenticated
  USING (public.is_venerable_or_admin_secretary())
  WITH CHECK (public.is_venerable_or_admin_secretary());

DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
CREATE POLICY "Admins can manage events" ON public.events
  FOR ALL TO authenticated
  USING (public.is_venerable_or_admin_secretary())
  WITH CHECK (public.is_venerable_or_admin_secretary());

DROP POLICY IF EXISTS "Admins manage event conflicts" ON public.event_conflicts;
CREATE POLICY "Admins manage event conflicts" ON public.event_conflicts
  FOR ALL TO authenticated
  USING (public.is_venerable_or_admin_secretary())
  WITH CHECK (public.is_venerable_or_admin_secretary());

DROP POLICY IF EXISTS "Admins can manage minutes" ON public.minutes;
CREATE POLICY "Admins can manage minutes" ON public.minutes
  FOR ALL TO authenticated
  USING (public.is_venerable_or_admin_secretary())
  WITH CHECK (public.is_venerable_or_admin_secretary());

DROP POLICY IF EXISTS "Members read their minute access" ON public.minute_access;
CREATE POLICY "Members read their minute access" ON public.minute_access
  FOR SELECT TO authenticated
  USING (public.is_venerable_or_admin_secretary() OR public.is_member_owner(member_id));

DROP POLICY IF EXISTS "Admins grant minute access" ON public.minute_access;
CREATE POLICY "Admins grant minute access" ON public.minute_access
  FOR INSERT TO authenticated
  WITH CHECK (public.is_venerable_or_admin_secretary());

DROP POLICY IF EXISTS "Checklist editable by admins" ON public.official_visit_checklist;
CREATE POLICY "Checklist editable by admins" ON public.official_visit_checklist
  FOR UPDATE TO authenticated
  USING (public.is_venerable_or_admin_secretary())
  WITH CHECK (public.is_venerable_or_admin_secretary());

REVOKE ALL ON FUNCTION public.is_venerable_or_admin_secretary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_venerable_or_admin_secretary() TO authenticated;
