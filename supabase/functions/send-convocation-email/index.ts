import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigin = Deno.env.get('APP_ORIGIN') || 'https://logia-xi.vercel.app';
const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin === allowedOrigin ? allowedOrigin : 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

const response = (body: unknown, status = 200, headers = corsHeaders(null)) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get('Origin'));
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return response({ error: 'Método no permitido' }, 405, headers);
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return response({ error: 'No autenticado' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return response({ error: 'No autenticado' }, 401);

    const { data: rateAllowed, error: rateError } = await admin.rpc('consume_function_rate_limit', {
      p_user_id: user.id,
      p_action: 'send_convocation_email',
      p_window_seconds: 3600,
      p_limit: 5,
    });
    if (rateError) throw rateError;
    if (!rateAllowed) return response({ error: 'Límite temporal alcanzado. Intenta nuevamente más tarde.' }, 429, headers);

    const { data: profile } = await admin.from('profiles').select('technical_role, role_id, access_disabled').eq('id', user.id).maybeSingle();
    const allowed = profile && !profile.access_disabled && ['admin', 'secretary'].includes(profile.technical_role);
    if (!allowed) return response({ error: 'No autorizado' }, 403);

    const rawBody = await request.text();
    if (rawBody.length > 15_000_000) return response({ error: 'Solicitud demasiado grande' }, 413, headers);
    const payload = JSON.parse(rawBody) as {
      subject: string;
      bodyText: string;
      recipientEmails: string[];
      pdfPath?: string;
      pdfFileName?: string;
    };
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const recipients = [...new Set((payload.recipientEmails || []).map((email) => email.trim().toLowerCase()).filter((email) => emailPattern.test(email)))];
    if (!payload.subject || !payload.bodyText || recipients.length === 0 || recipients.length > 100) return response({ error: 'Datos incompletos o inválidos' }, 400, headers);
    if (payload.subject.length > 200 || payload.bodyText.length > 100_000) return response({ error: 'El correo excede el tamaño permitido' }, 413, headers);

    const attachments: Array<{ filename: string; content: string }> = [];
    if (payload.pdfPath && payload.pdfFileName) {
      if (!/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,180}\.pdf$/i.test(payload.pdfPath) || !/^[A-Za-z0-9._ -]{1,180}\.pdf$/i.test(payload.pdfFileName)) {
        return response({ error: 'Archivo adjunto inválido' }, 400, headers);
      }
      const { data: file, error: downloadError } = await admin.storage.from('convocation-pdfs').download(payload.pdfPath);
      if (downloadError) throw downloadError;
      if (file.size > 10 * 1024 * 1024) return response({ error: 'El archivo adjunto es demasiado grande' }, 413, headers);
      attachments.push({ filename: payload.pdfFileName, content: bytesToBase64(new Uint8Array(await file.arrayBuffer())) });
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('MAIL_FROM') || 'Secretaría UF21 <onboarding@resend.dev>',
        to: [recipients[0]],
        cc: recipients.slice(1),
        subject: payload.subject,
        text: payload.bodyText,
        attachments,
      }),
    });
    if (!resendResponse.ok) return response({ error: 'El proveedor de correo rechazó el envío' }, 502, headers);
    return response({ sent: recipients.length, attached: attachments.length > 0 }, 200, headers);
  } catch {
    return response({ error: 'No se pudo procesar el envío' }, 500, headers);
  }
});
