-- Integración institucional de LOGIA con el calendario de Google del Secretario.
-- Los tokens OAuth solo son accesibles por Edge Functions mediante service role.

CREATE TABLE IF NOT EXISTS public.google_calendar_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'google' CHECK (provider = 'google'),
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  account_email TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT one_google_calendar_integration UNIQUE (provider)
);

CREATE TABLE IF NOT EXISTS public.google_calendar_oauth_states (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

ALTER TABLE public.google_calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_oauth_states ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.google_calendar_integrations FROM anon, authenticated;
REVOKE ALL ON public.google_calendar_oauth_states FROM anon, authenticated;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_html_link TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_sync_status TEXT NOT NULL DEFAULT 'not_connected'
    CHECK (google_calendar_sync_status IN ('not_connected', 'synced', 'pending', 'error')),
  ADD COLUMN IF NOT EXISTS google_calendar_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_events_google_calendar_event_id
  ON public.events(google_calendar_event_id);
