-- Permite que cada miembro lea y actualice su propia asistencia aunque el
-- vínculo profiles.member_id todavía no esté sincronizado con la ficha.
CREATE OR REPLACE FUNCTION public.is_member_owner(target_member_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.id = target_member_id
      AND m.deleted_at IS NULL
      AND m.is_active = TRUE
      AND (
        lower(m.email) = lower(auth.jwt() ->> 'email')
        OR m.id = (
          SELECT p.member_id
          FROM public.profiles p
          WHERE p.id = auth.uid()
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_member_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_member_owner(UUID) TO authenticated;
