-- Mantiene el historial de asistencia de las fichas rápidas mediante baja lógica.
DROP POLICY IF EXISTS "Attendance managers update quick members" ON public.members;
CREATE POLICY "Attendance managers update quick members"
  ON public.members FOR UPDATE TO authenticated
  USING (
    public.can_manage_attendance_people()
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.member_id = members.id)
  )
  WITH CHECK (
    public.can_manage_attendance_people()
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.member_id = members.id)
  );

DROP POLICY IF EXISTS "Attendance managers update visitors" ON public.attendance_visitors;
CREATE POLICY "Attendance managers update visitors"
  ON public.attendance_visitors FOR UPDATE TO authenticated
  USING (public.can_manage_attendance_people())
  WITH CHECK (public.can_manage_attendance_people());

DROP POLICY IF EXISTS "Attendance managers delete visitors" ON public.attendance_visitors;
CREATE POLICY "Attendance managers delete visitors"
  ON public.attendance_visitors FOR DELETE TO authenticated
  USING (public.can_manage_attendance_people());
