import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return response({ error: 'No autenticado' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return response({ error: 'No autenticado' }, 401);

    const { data: profile } = await admin.from('profiles').select('technical_role, role_id, access_disabled').eq('id', user.id).maybeSingle();
    const allowed = profile && !profile.access_disabled && ['admin', 'secretary'].includes(profile.technical_role);
    if (!allowed) return response({ error: 'No autorizado' }, 403);

    const payload = await request.json() as {
      subject: string;
      bodyText: string;
      recipientEmails: string[];
      pdfPath?: string;
      pdfFileName?: string;
    };
    const recipients = [...new Set((payload.recipientEmails || []).map((email) => email.trim().toLowerCase()).filter(Boolean))];
    if (!payload.subject || !payload.bodyText || recipients.length === 0) return response({ error: 'Datos incompletos' }, 400);

    const attachments: Array<{ filename: string; content: string }> = [];
    if (payload.pdfPath && payload.pdfFileName) {
      const { data: file, error: downloadError } = await admin.storage.from('convocation-pdfs').download(payload.pdfPath);
      if (downloadError) throw downloadError;
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
    if (!resendResponse.ok) return response({ error: await resendResponse.text() }, 502);
    return response({ sent: recipients.length, attached: attachments.length > 0 });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'No se pudo enviar el correo' }, 500);
  }
});
