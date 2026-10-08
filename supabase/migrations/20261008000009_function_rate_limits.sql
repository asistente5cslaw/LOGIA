CREATE TABLE IF NOT EXISTS public.function_rate_limits (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  window_started TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (user_id, action)
);

ALTER TABLE public.function_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.function_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_function_rate_limit(
  p_user_id UUID,
  p_action TEXT,
  p_window_seconds INTEGER,
  p_limit INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_limit public.function_rate_limits%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_action IS NULL OR p_window_seconds <= 0 OR p_limit <= 0 THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO current_limit
  FROM public.function_rate_limits
  WHERE user_id = p_user_id AND action = p_action
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.function_rate_limits(user_id, action, window_started, request_count)
    VALUES (p_user_id, p_action, now(), 1);
    RETURN TRUE;
  END IF;

  IF current_limit.window_started + make_interval(secs => p_window_seconds) <= now() THEN
    UPDATE public.function_rate_limits
    SET window_started = now(), request_count = 1
    WHERE user_id = p_user_id AND action = p_action;
    RETURN TRUE;
  END IF;

  IF current_limit.request_count >= p_limit THEN
    RETURN FALSE;
  END IF;

  UPDATE public.function_rate_limits
  SET request_count = request_count + 1
  WHERE user_id = p_user_id AND action = p_action;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_function_rate_limit(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_function_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO service_role;
