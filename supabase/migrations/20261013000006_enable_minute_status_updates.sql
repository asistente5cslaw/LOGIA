-- Permite cambiar únicamente el estado de un acta a Secretaría,
-- Administración y Venerable, sin ampliar otras operaciones.

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
  IF new_status NOT IN ('borrador', 'circulada', 'aprobada', 'firmada', 'archivada') THEN
    RAISE EXCEPTION 'Estado de acta no válido.' USING ERRCODE = '22023';
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
    RAISE EXCEPTION 'No tienes autorización para cambiar el estado del acta.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.minutes
  SET status = new_status, updated_at = now()
  WHERE id = target_minute_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el acta.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_minute_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_minute_status(UUID, TEXT) TO authenticated;
