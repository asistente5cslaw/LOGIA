-- Permite que cada usuario lea su propia ficha para saber si debe capturar
-- o renovar la selfie. No expone fichas de otros miembros.

CREATE POLICY "Members can read own record"
ON public.members
FOR SELECT TO authenticated
USING (id = auth.uid() AND deleted_at IS NULL);
