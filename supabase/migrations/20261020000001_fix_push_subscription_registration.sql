-- Permite registrar nuevamente un dispositivo después de cambiar de cuenta.
-- Un endpoint push pertenece al usuario autenticado que acaba de registrarlo.
CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_endpoint TEXT,
  p_expiration_time BIGINT,
  p_p256dh TEXT,
  p_auth TEXT,
  p_user_agent TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NULLIF(trim(p_endpoint), '') IS NULL
    OR NULLIF(trim(p_p256dh), '') IS NULL
    OR NULLIF(trim(p_auth), '') IS NULL THEN
    RAISE EXCEPTION 'Suscripción push incompleta';
  END IF;

  INSERT INTO public.push_subscriptions (
    user_id,
    endpoint,
    expiration_time,
    p256dh,
    auth,
    user_agent,
    enabled,
    updated_at
  )
  VALUES (
    current_user_id,
    p_endpoint,
    p_expiration_time,
    p_p256dh,
    p_auth,
    p_user_agent,
    TRUE,
    timezone('utc'::text, now())
  )
  ON CONFLICT (endpoint) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    expiration_time = EXCLUDED.expiration_time,
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    user_agent = EXCLUDED.user_agent,
    enabled = TRUE,
    updated_at = timezone('utc'::text, now());

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_subscription(TEXT, BIGINT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(TEXT, BIGINT, TEXT, TEXT, TEXT) TO authenticated;
