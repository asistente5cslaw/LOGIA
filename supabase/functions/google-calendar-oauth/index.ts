import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const appOrigin = Deno.env.get('APP_ORIGIN') || 'https://logia-xi.vercel.app';
const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID') || 'primary';
const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-oauth?action=callback`;

const admin = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin === appOrigin ? appOrigin : 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

const response = (body: unknown, status = 200, headers = corsHeaders(null)) => new Response(
  JSON.stringify(body),
  { status, headers: { ...headers, 'Content-Type': 'application/json' } },
);

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function getUser(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data: { user } } = await admin.auth.getUser(token);
  return user;
}

async function isAuthorized(userId: string): Promise<boolean> {
  const { data } = await admin
    .from('profiles')
    .select('technical_role, role_id, access_disabled')
    .eq('id', userId)
    .maybeSingle();
  return Boolean(data && !data.access_disabled && (
    ['admin', 'secretary'].includes(data.technical_role) ||
    ['vm', 'sec'].includes(data.role_id)
  ));
}

function requireGoogleConfig() {
  if (!googleClientId || !googleClientSecret) {
    throw new Error('Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Supabase.');
  }
}

async function getAccessToken(refreshToken: string): Promise<string> {
  requireGoogleConfig();
  const body = new URLSearchParams({
    client_id: googleClientId!,
    client_secret: googleClientSecret!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error('Google rechazó la renovación del acceso al calendario. Vuelve a conectar la cuenta.');
  }
  return tokenData.access_token;
}

function googleEventPayload(event: Record<string, unknown>) {
  const startDate = String(event.startDate || '');
  const rawEndDate = String(event.endDate || startDate);
  const startTime = String(event.startTime || '');
  const endTime = String(event.endTime || startTime || '23:59');
  const allDay = Boolean(event.isAllDay || !startTime);
  const endDate = allDay && rawEndDate === startDate
    ? (() => {
      const next = new Date(`${startDate}T12:00:00-05:00`);
      next.setDate(next.getDate() + 1);
      return next.toISOString().slice(0, 10);
    })()
    : rawEndDate;
  const start = allDay
    ? { date: startDate }
    : { dateTime: `${startDate}T${startTime}:00`, timeZone: 'America/Panama' };
  const end = allDay
    ? { date: endDate }
    : { dateTime: `${endDate}T${endTime}:00`, timeZone: 'America/Panama' };

  return {
    summary: String(event.title || 'Actividad de la Logia').slice(0, 250),
    description: String(event.notes || '').slice(0, 8000),
    location: String(event.location || '').slice(0, 500),
    start,
    end,
    extendedProperties: { private: { logiaEventId: String(event.id || '') } },
  };
}

async function googleRequest(accessToken: string, path: string, init: RequestInit = {}) {
  const result = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const data = result.status === 204 ? null : await result.json();
  if (!result.ok) {
    throw new Error(String(data?.error?.message || 'Google Calendar rechazó la operación.'));
  }
  return data;
}

async function handleStart(userId: string, headers: HeadersInit) {
  requireGoogleConfig();
  const state = randomState();
  const { error } = await admin.from('google_calendar_oauth_states').insert({
    state,
    user_id: userId,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (error) throw error;
  const params = new URLSearchParams({
    client_id: googleClientId!,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    state,
  });
  return response({ authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` }, 200, headers);
}

async function handleCallback(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return Response.redirect(`${appOrigin}/app/ajustes?google_calendar=cancelled`, 302);

  const { data: oauthState } = await admin
    .from('google_calendar_oauth_states')
    .select('state, user_id, expires_at, used_at')
    .eq('state', state)
    .maybeSingle();
  if (!oauthState || oauthState.used_at || new Date(oauthState.expires_at).getTime() < Date.now()) {
    return Response.redirect(`${appOrigin}/app/ajustes?google_calendar=invalid_state`, 302);
  }
  await admin.from('google_calendar_oauth_states').update({ used_at: new Date().toISOString() }).eq('state', state);

  requireGoogleConfig();
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: googleClientId!,
      client_secret: googleClientSecret!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || !tokens.refresh_token) throw new Error('Google no devolvió un token de actualización.');

  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileResponse.json();
  const { error } = await admin.from('google_calendar_integrations').upsert({
    provider: 'google',
    calendar_id: calendarId,
    account_email: profile.email || 'Cuenta de Google conectada',
    refresh_token: tokens.refresh_token,
    scopes: String(tokens.scope || '').split(' ').filter(Boolean),
    connected_by: oauthState.user_id,
    connected_at: new Date().toISOString(),
    last_error: null,
  }, { onConflict: 'provider' });
  if (error) throw error;
  return Response.redirect(`${appOrigin}/app/ajustes?google_calendar=connected`, 302);
}

async function handleSync(userId: string, payload: { operation: 'create' | 'update' | 'cancel' | 'delete'; event: Record<string, unknown> }) {
  const { data: integration } = await admin.from('google_calendar_integrations').select('*').eq('provider', 'google').maybeSingle();
  if (!integration) return { connected: false };
  const accessToken = await getAccessToken(integration.refresh_token);
  const eventId = String(payload.event.id || '');
  const { data: storedEvent } = await admin
    .from('events')
    .select('google_calendar_event_id')
    .eq('id', eventId)
    .maybeSingle();
  const existingGoogleId = String(payload.event.googleCalendarEventId || storedEvent?.google_calendar_event_id || '');
  let googleEventId = existingGoogleId;
  let htmlLink = String(payload.event.googleCalendarHtmlLink || '');

  if (payload.operation === 'delete') {
    if (googleEventId) {
      await googleRequest(accessToken, `/calendars/${encodeURIComponent(integration.calendar_id)}/events/${encodeURIComponent(googleEventId)}`, { method: 'DELETE' });
    }
  } else if (payload.operation === 'create' || !googleEventId) {
    const created = await googleRequest(accessToken, `/calendars/${encodeURIComponent(integration.calendar_id)}/events?sendUpdates=none`, {
      method: 'POST',
      body: JSON.stringify(googleEventPayload(payload.event)),
    });
    googleEventId = created.id;
    htmlLink = created.htmlLink || '';
  } else {
    const updated = await googleRequest(accessToken, `/calendars/${encodeURIComponent(integration.calendar_id)}/events/${encodeURIComponent(googleEventId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...googleEventPayload(payload.event), ...(payload.operation === 'cancel' ? { status: 'cancelled' } : {}) }),
    });
    htmlLink = updated.htmlLink || htmlLink;
  }

  await admin.from('events').update({
    google_calendar_event_id: payload.operation === 'delete' ? null : googleEventId,
    google_calendar_html_link: payload.operation === 'delete' ? null : htmlLink,
    google_calendar_sync_status: 'synced',
    google_calendar_sync_error: null,
    google_calendar_synced_at: new Date().toISOString(),
  }).eq('id', eventId);
  await admin.from('google_calendar_integrations').update({ last_sync_at: new Date().toISOString(), last_error: null }).eq('provider', 'google');
  return { connected: true, googleEventId, htmlLink };
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get('Origin'));
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'status';
  if (action === 'callback') {
    try { return await handleCallback(request); } catch { return Response.redirect(`${appOrigin}/app/ajustes?google_calendar=error`, 302); }
  }
  if (request.method !== 'POST') return response({ error: 'Método no permitido' }, 405, headers);
  try {
    const user = await getUser(request);
    if (!user || !(await isAuthorized(user.id))) return response({ error: 'No autorizado' }, 403, headers);
    const payload = await request.json().catch(() => ({}));
    if (action === 'start') return await handleStart(user.id, headers);
    if (action === 'status') {
      const { data } = await admin.from('google_calendar_integrations').select('account_email, calendar_id, connected_at, last_sync_at, last_error').eq('provider', 'google').maybeSingle();
      return response({ connected: Boolean(data), integration: data || null }, 200, headers);
    }
    if (action === 'disconnect') {
      await admin.from('google_calendar_integrations').delete().eq('provider', 'google');
      return response({ connected: false }, 200, headers);
    }
    if (action === 'sync') return response(await handleSync(user.id, payload), 200, headers);
    return response({ error: 'Acción no reconocida' }, 400, headers);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Error de integración con Google Calendar.' }, 500, headers);
  }
});
