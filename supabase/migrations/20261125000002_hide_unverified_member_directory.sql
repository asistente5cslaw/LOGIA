-- Los miembros verificados no deben ver fichas de compañeros pendientes.
-- Secretaría, Veneratura y Administración sí necesitan verlas para revisarlas.

DROP POLICY IF EXISTS "Verified users read active member directory" ON public.members;
CREATE POLICY "Verified users read verified member directory"
  ON public.members FOR SELECT TO authenticated
  USING (
    public.has_verified_identity()
    AND deleted_at IS NULL
    AND is_active = TRUE
    AND (
      public.is_venerable_or_admin_secretary()
      OR (identity_status = 'verified' AND identity_verified = TRUE)
    )
  );
