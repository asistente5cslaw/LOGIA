-- Permiso exclusivo para operaciones de asistencia y altas rápidas.
CREATE OR REPLACE FUNCTION public.can_manage_attendance_people()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND (technical_role IN ('admin', 'secretary') OR role_id IN ('adm', 'vm', 'sec'))
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_attendance_people() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_attendance_people() TO authenticated;

DROP POLICY IF EXISTS "Attendance managers create quick members" ON public.members;
CREATE POLICY "Attendance managers create quick members"
  ON public.members FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_attendance_people());

DROP POLICY IF EXISTS "Attendance managers view visitors" ON public.attendance_visitors;
CREATE POLICY "Attendance managers view visitors"
  ON public.attendance_visitors FOR SELECT TO authenticated
  USING (public.can_manage_attendance_people());

DROP POLICY IF EXISTS "Attendance managers create visitors" ON public.attendance_visitors;
CREATE POLICY "Attendance managers create visitors"
  ON public.attendance_visitors FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_attendance_people());

-- Los visitantes externos no necesariamente tienen grado masónico informado.
ALTER TABLE public.attendance_visitors
  ALTER COLUMN degree DROP NOT NULL;
