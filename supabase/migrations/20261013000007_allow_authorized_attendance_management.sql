-- El Administrador técnico y Secretaría también pueden revisar y registrar
-- la asistencia oficial, además del Venerable Maestro.
DROP POLICY IF EXISTS "VM and Secretary manage official attendance" ON public.attendance;

CREATE POLICY "Authorized officers manage official attendance"
  ON public.attendance FOR ALL TO authenticated
  USING (
    public.has_verified_identity()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role_id IN ('vm', 'sec')
          OR p.technical_role IN ('admin', 'secretary')
        )
    )
  )
  WITH CHECK (
    public.has_verified_identity()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role_id IN ('vm', 'sec')
          OR p.technical_role IN ('admin', 'secretary')
        )
    )
  );
