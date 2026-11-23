-- La pantalla de asistencia autoriza también al Venerable Maestro.
-- Permite altas rápidas sin concederle administración completa del padrón.
DROP POLICY IF EXISTS "Attendance managers create quick members" ON public.members;
CREATE POLICY "Attendance managers create quick members"
  ON public.members FOR INSERT TO authenticated
  WITH CHECK (public.is_venerable_or_admin_secretary());

DROP POLICY IF EXISTS "Attendance managers view visitors" ON public.attendance_visitors;
CREATE POLICY "Attendance managers view visitors"
  ON public.attendance_visitors FOR SELECT TO authenticated
  USING (public.is_venerable_or_admin_secretary());

DROP POLICY IF EXISTS "Attendance managers create visitors" ON public.attendance_visitors;
CREATE POLICY "Attendance managers create visitors"
  ON public.attendance_visitors FOR INSERT TO authenticated
  WITH CHECK (public.is_venerable_or_admin_secretary());
