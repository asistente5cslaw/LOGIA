-- Flujo definitivo de Comunicaciones:
-- borrador -> circulada -> aprobada.
-- Los documentos que ya estaban firmados pasan a aprobada para conservarlos.
UPDATE public.minutes
SET status = 'aprobada', updated_at = now()
WHERE status = 'firmada';

ALTER TABLE public.minutes
  DROP CONSTRAINT IF EXISTS minutes_status_check;

ALTER TABLE public.minutes
  ADD CONSTRAINT minutes_status_check
  CHECK (status IN ('borrador', 'circulada', 'aprobada'));

CREATE OR REPLACE FUNCTION public.update_minute_status(
  target_minute_id UUID,
  new_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new_status NOT IN ('borrador', 'circulada', 'aprobada') THEN
    RAISE EXCEPTION 'Estado de comunicación no válido.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (
        role_id IN ('sec', 'vm', 'adm')
        OR technical_role IN ('admin', 'secretary')
      )
      AND COALESCE(access_disabled, FALSE) = FALSE
  ) THEN
    RAISE EXCEPTION 'No tienes autorización para cambiar el estado de la comunicación.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.minutes
  SET status = new_status, updated_at = now()
  WHERE id = target_minute_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la comunicación.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_minute(target_minute_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.has_verified_identity() AND EXISTS (
    SELECT 1 FROM public.minutes m
    WHERE m.id = target_minute_id AND m.deleted_at IS NULL
      AND (
        public.is_venerable_or_admin_secretary()
        OR EXISTS (
          SELECT 1 FROM public.members member_record
          WHERE lower(member_record.email) = lower(auth.jwt() ->> 'email')
            AND m.status IN ('circulada', 'aprobada')
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

REVOKE ALL ON FUNCTION public.update_minute_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_minute_status(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.can_read_minute(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_minute(UUID) TO authenticated;
