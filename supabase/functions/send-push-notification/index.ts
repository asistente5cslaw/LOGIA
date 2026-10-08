import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigin = Deno.env.get('APP_ORIGIN') || 'https://logia-xi.vercel.app';
const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin === allowedOrigin ? allowedOrigin : 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get('Origin'));
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return response({ error: 'Método no permitido' }, 405, headers);
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) throw new Error('No autenticado');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return response({ error: 'No autenticado' }, 401);

    const { data: rateAllowed, error: rateError } = await admin.rpc('consume_function_rate_limit', {
      p_user_id: user.id,
      p_action: 'send_push_notification',
      p_window_seconds: 600,
      p_limit: 10,
    });
    if (rateError) throw rateError;
    if (!rateAllowed) return response({ error: 'Límite temporal alcanzado. Intenta nuevamente más tarde.' }, 429, headers);

    const { data: profile } = await admin.from('profiles').select('technical_role, role_id, access_disabled').eq('id', user.id).maybeSingle();
    if (profile?.access_disabled) return response({ error: 'Cuenta deshabilitada' }, 403);
    const rawBody = await request.text();
    if (rawBody.length > 32_000) return response({ error: 'Solicitud demasiado grande' }, 413, headers);
    const requestPayload = JSON.parse(rawBody) as {
      recipientRoles?: string[];
      recipientEmails?: string[];
      subscriptionId?: string;
      minuteDegree?: 'aprendiz' | 'companero' | 'maestro';
      type?: string;
      [key: string]: unknown;
    };
    const isNewRegistrationNotice = requestPayload.type === 'nuevo_registro';
    const isIdentityResubmission = requestPayload.type === 'identidad_reenviada';
    const isNewMinuteNotice = requestPayload.type === 'nueva_acta';
    const elevated = Boolean(profile && !profile.access_disabled && (['admin', 'secretary'].includes(profile.technical_role) || profile.role_id === 'vm' || profile.role_id === 'sec'));
    const selfServiceNotice = Boolean(profile && !profile.access_disabled && profile.technical_role === 'member' && (isNewRegistrationNotice || isIdentityResubmission));
    if (!elevated && !selfServiceNotice) return response({ error: 'No autorizado' }, 403, headers);

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') || 'mailto:secretaria@unionfraternal21.org',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    );
    const { recipientRoles, recipientEmails, subscriptionId, minuteDegree, ...notificationPayload } = requestPayload;
    const title = String(notificationPayload.title || 'Nueva notificación').slice(0, 160);
    const body = String(notificationPayload.body || '').slice(0, 2000);
    const safeUrl = typeof notificationPayload.url === 'string' && /^\/(?!\/)[^\s]{0,300}$/.test(notificationPayload.url) ? notificationPayload.url : null;
    const payload = JSON.stringify({ ...notificationPayload, title, body, url: safeUrl });
    let subscriptionsQuery = admin.from('push_subscriptions').select('id, endpoint, expiration_time, p256dh, auth, user_id').eq('enabled', true);
    let notificationRecipientIds: string[] = [];
    if (subscriptionId) {
      const { data: targetSubscription, error: targetError } = await admin
        .from('push_subscriptions')
        .select('id, user_id')
        .eq('id', subscriptionId)
        .eq('enabled', true)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!targetSubscription) return response({ sent: 0, removed: 0 });
      notificationRecipientIds = [targetSubscription.user_id];
      subscriptionsQuery = subscriptionsQuery.eq('id', subscriptionId);
    } else if (isNewMinuteNotice) {
      if (!minuteDegree || !['aprendiz', 'companero', 'maestro'].includes(minuteDegree)) {
        return response({ error: 'El grado del acta es obligatorio' }, 400, headers);
      }
      const { data: profiles, error: profilesError } = await admin
        .from('profiles')
        .select('id, member_id, role_id, technical_role, identity_verified, access_disabled')
        .eq('identity_verified', true)
        .or('access_disabled.eq.false,access_disabled.is.null');
      if (profilesError) throw profilesError;

      const memberIds = (profiles || []).map((profile) => profile.member_id).filter(Boolean);
      const { data: members, error: membersError } = memberIds.length > 0
        ? await admin.from('members').select('id, degree, is_active, deleted_at').in('id', memberIds)
        : { data: [], error: null };
      if (membersError) throw membersError;

      const memberById = new Map((members || []).map((member) => [member.id, member]));
      const allowedDegrees = minuteDegree === 'aprendiz'
        ? new Set(['aprendiz'])
        : minuteDegree === 'companero'
          ? new Set(['aprendiz', 'companero'])
          : new Set(['aprendiz', 'companero', 'maestro']);
      const elevatedRoles = new Set(['admin', 'secretary', 'dignitary']);
      const elevatedRoleIds = new Set(['adm', 'sec', 'vm', 'ora']);
      notificationRecipientIds = (profiles || [])
        .filter((profile) => {
          if (elevatedRoles.has(profile.technical_role) || elevatedRoleIds.has(profile.role_id)) return true;
          const member = profile.member_id ? memberById.get(profile.member_id) : null;
          return Boolean(member && member.is_active && !member.deleted_at && allowedDegrees.has(member.degree));
        })
        .map((profile) => profile.id);
      if (notificationRecipientIds.length === 0) return response({ sent: 0, removed: 0 });
      subscriptionsQuery = subscriptionsQuery.in('user_id', notificationRecipientIds);
    } else if (isNewRegistrationNotice) {
      const { data: recipients, error: recipientsError } = await admin
        .from('profiles')
        .select('id')
        .in('role_id', ['sec', 'adm'])
        .or('access_disabled.eq.false,access_disabled.is.null');
      if (recipientsError) throw recipientsError;
      const recipientIds = (recipients || []).map((recipient) => recipient.id);
      if (recipientIds.length === 0) return response({ sent: 0, removed: 0 });
      notificationRecipientIds = recipientIds;
      subscriptionsQuery = subscriptionsQuery.in('user_id', recipientIds);
    } else if ((recipientRoles && recipientRoles.length > 0) || (recipientEmails && recipientEmails.length > 0)) {
      const recipientIds = new Set<string>();
      if (recipientRoles && recipientRoles.length > 0) {
        const { data: recipients, error: recipientsError } = await admin
          .from('profiles')
          .select('id')
          .in('role_id', recipientRoles)
          .or('access_disabled.eq.false,access_disabled.is.null');
        if (recipientsError) throw recipientsError;
        (recipients || []).forEach((recipient) => recipientIds.add(recipient.id));
      }
      if (recipientEmails && recipientEmails.length > 0) {
        const normalizedEmails = recipientEmails.map((email) => email.trim().toLowerCase()).filter(Boolean);
        const { data: recipients, error: recipientsError } = await admin
          .from('profiles')
          .select('id')
          .in('email', normalizedEmails)
          .or('access_disabled.eq.false,access_disabled.is.null');
        if (recipientsError) throw recipientsError;
        (recipients || []).forEach((recipient) => recipientIds.add(recipient.id));
      }
      if (recipientIds.size === 0) return response({ sent: 0, removed: 0 });
      notificationRecipientIds = Array.from(recipientIds);
      subscriptionsQuery = subscriptionsQuery.in('user_id', notificationRecipientIds);
    } else {
      const { data: recipients, error: recipientsError } = await admin
        .from('profiles')
        .select('id')
        .or('access_disabled.eq.false,access_disabled.is.null');
      if (recipientsError) throw recipientsError;
      notificationRecipientIds = (recipients || []).map((recipient) => recipient.id);
    }

    if (notificationRecipientIds.length > 0) {
      const { error: notificationError } = await admin.from('push_notifications').insert(
        notificationRecipientIds.map((userId) => ({
          user_id: userId,
          title,
          body,
          url: safeUrl,
          tag: notificationPayload.tag ? String(notificationPayload.tag).slice(0, 80) : null,
          type: notificationPayload.type ? String(notificationPayload.type) : 'aviso',
        })),
      );
      if (notificationError) throw notificationError;
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
    return response({ sent, removed, recipients: notificationRecipientIds.length }, 200, headers);
  } catch {
    return response({ error: 'No se pudo procesar la notificación' }, 500, headers);
  }
});

function response(body: unknown, status = 200, headers = corsHeaders(null)) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}
