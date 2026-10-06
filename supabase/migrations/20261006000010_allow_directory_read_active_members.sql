-- El directorio de miembros es visible para usuarios autenticados.
-- La gestión de cargos, bajas y validaciones continúa restringida por las
-- políticas administrativas existentes.

CREATE POLICY "Authenticated users can read active members"
ON public.members
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND is_active = TRUE);
