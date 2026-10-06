-- El usuario recién registrado puede guardar únicamente su propia captura
-- y el resultado de identidad. No concede permisos para cambiar cargo, grado
-- ni ningún otro dato administrativo.

CREATE POLICY "Members can save own identity capture"
ON public.members
FOR UPDATE TO authenticated
USING (id = auth.uid() AND deleted_at IS NULL)
WITH CHECK (id = auth.uid() AND deleted_at IS NULL);

GRANT UPDATE (
  identity_verified,
  identity_status,
  selfie_url,
  identity_validated_at,
  identity_validated_by,
  identity_notes,
  updated_at
)
ON public.members TO authenticated;
