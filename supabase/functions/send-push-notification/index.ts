import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) throw new Error('No autenticado');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return response({ error: 'No autenticado' }, 401);

    const { data: profile } = await admin.from('profiles').select('technical_role, role_id, access_disabled').eq('id', user.id).maybeSingle();
    if (profile?.access_disabled) return response({ error: 'Cuenta deshabilitada' }, 403);
    const requestPayload = await request.json() as {
      recipientRoles?: string[];
      type?: string;
      [key: string]: unknown;
    };
    const isNewRegistrationNotice = requestPayload.type === 'nuevo_registro';
    const allowed = profile && ['admin', 'secretary'].includes(profile.technical_role) || profile?.role_id === 'vm' || profile?.role_id === 'sec';
    if (!allowed && !isNewRegistrationNotice) return response({ error: 'No autorizado' }, 403);

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') || 'mailto:secretaria@unionfraternal21.org',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    );
    const { recipientRoles, ...notificationPayload } = requestPayload;
    const payload = JSON.stringify(notificationPayload);
    let subscriptionsQuery = admin.from('push_subscriptions').select('id, endpoint, expiration_time, p256dh, auth, user_id');
    if (isNewRegistrationNotice) {
      const { data: recipients, error: recipientsError } = await admin
        .from('profiles')
        .select('id')
        .in('role_id', ['vm', 'sec', 'adm'])
        .or('access_disabled.eq.false,access_disabled.is.null');
      if (recipientsError) throw recipientsError;
      const recipientIds = (recipients || []).map((recipient) => recipient.id);
      if (recipientIds.length === 0) return response({ sent: 0, removed: 0 });
      subscriptionsQuery = subscriptionsQuery.in('user_id', recipientIds);
    } else if (recipientRoles && recipientRoles.length > 0) {
      const { data: recipients, error: recipientsError } = await admin
        .from('profiles')
        .select('id')
        .in('role_id', recipientRoles)
        .or('access_disabled.eq.false,access_disabled.is.null');
      if (recipientsError) throw recipientsError;
      const recipientIds = (recipients || []).map((recipient) => recipient.id);
      if (recipientIds.length === 0) return response({ sent: 0, removed: 0 });
      subscriptionsQuery = subscriptionsQuery.in('user_id', recipientIds);
    }
    const { data: subscriptions, error } = await subscriptionsQuery;
    if (error) throw error;
    let sent = 0;
    let removed = 0;
    for (const subscription of subscriptions || []) {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, expirationTime: subscription.expiration_time, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload);
        sent++;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('id', subscription.id);
          removed++;
        }
      }
    }
    return response({ sent, removed });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Error enviando push' }, 500);
  }
});

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
