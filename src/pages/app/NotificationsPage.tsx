import { useEffect, useState } from 'react';
import { Bell, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { memberService } from '@/services/memberService';
import { pushNotificationService } from '@/services/pushNotificationService';
import type { Member } from '@/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { toast } from 'sonner';

const MAX_TITLE_LENGTH = 80;
const MAX_BODY_LENGTH = 130;

function getPushFingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function NotificationsPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [title, setTitle] = useState('Aviso de la Logia');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'todos' | 'seleccionados'>('todos');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const canSend = user?.profile?.roleId === 'sec' || user?.profile?.technicalRole === 'secretary';

  useEffect(() => {
    if (!canSend) return;
    void memberService.getAllMembers(true, false, true)
      .then((list) => setMembers(list.filter((member) => member.isActive && !member.deletedAt && member.email.trim())))
      .catch(() => toast.error('No se pudo cargar el directorio de miembros.'))
      .finally(() => setIsLoading(false));
  }, [canSend]);

  const toggleRecipient = (memberId: string) => {
    setRecipients((current) => current.includes(memberId)
      ? current.filter((id) => id !== memberId)
      : [...current, memberId]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) {
      toast.error('Escribe un título y un mensaje para la notificación.');
      return;
    }
    if (audience === 'seleccionados' && recipients.length === 0) {
      toast.error('Selecciona al menos un destinatario.');
      return;
    }

    setIsSending(true);
    try {
      const recipientEmails = audience === 'seleccionados'
        ? members.filter((member) => recipients.includes(member.id)).map((member) => member.email.trim().toLowerCase())
        : undefined;
      const fingerprint = getPushFingerprint([
        cleanTitle,
        cleanBody,
        audience,
        ...(recipientEmails || []),
      ].join('|'));
      const result = await pushNotificationService.sendPushToAll({
        title: cleanTitle,
        body: cleanBody,
        url: '/app',
        tag: `aviso-manual-${fingerprint}`,
        type: 'aviso',
        ...(recipientEmails?.length ? { recipientEmails } : {}),
      });
      if (result.duplicate) toast.info('Este mismo aviso ya fue enviado recientemente.');
      else if (result.sent > 0) toast.success(`Notificación enviada a ${result.sent} dispositivo${result.sent === 1 ? '' : 's'}.`);
      else toast.warning('No hay dispositivos push activos para esos destinatarios.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo enviar la notificación.');
    } finally {
      setIsSending(false);
    }
  };

  if (!canSend) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 pb-6 pt-2.5 sm:space-y-6 sm:py-6 md:px-8">
      <PageHeader title="Notificaciones" subtitle="Envía avisos personalizados a los miembros de la Logia" />
      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-7">
        <div className="flex items-start gap-3 border-b border-border pb-4">
          <div className="rounded-xl bg-primary/10 p-2 text-primary"><Bell className="h-5 w-5" /></div>
          <div>
            <h2 className="font-serif text-xl font-bold text-ink">Enviar notificación personalizada</h2>
            <p className="mt-1 text-xs text-ink-secondary">Elige si el aviso será para todos o solo para miembros seleccionados.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-1.5 text-xs font-semibold text-ink">
            Título
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={MAX_TITLE_LENGTH} placeholder="Ej. Cambio de horario" className="min-h-[42px] rounded-lg border border-border bg-surface-container-low px-3 text-sm font-normal text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-ink">
            Mensaje
            <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={MAX_BODY_LENGTH} rows={4} placeholder="Escribe el mensaje que recibirán en su dispositivo..." className="resize-y rounded-lg border border-border bg-surface-container-low px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
            <span className="text-right text-[11px] font-normal text-ink-muted">{body.length}/{MAX_BODY_LENGTH}</span>
          </label>

          <div className="grid gap-2">
            <p className="text-xs font-semibold text-ink">Destinatarios</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setAudience('todos')} className={`min-h-[38px] rounded-lg px-3 text-xs font-semibold ${audience === 'todos' ? 'bg-primary text-primary-foreground' : 'border border-border text-ink-secondary hover:bg-surface-container'}`}>Todos los dispositivos activos</button>
              <button type="button" onClick={() => setAudience('seleccionados')} className={`min-h-[38px] rounded-lg px-3 text-xs font-semibold ${audience === 'seleccionados' ? 'bg-primary text-primary-foreground' : 'border border-border text-ink-secondary hover:bg-surface-container'}`}>Seleccionar miembros ({recipients.length})</button>
            </div>
          </div>

          {audience === 'seleccionados' && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border/60">
              {isLoading ? <p className="p-4 text-xs text-ink-muted">Cargando miembros…</p> : members.length === 0 ? <p className="p-4 text-xs text-ink-muted">No hay miembros activos disponibles.</p> : members.map((member) => (
                <label key={member.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface-container-low">
                  <input type="checkbox" checked={recipients.includes(member.id)} onChange={() => toggleRecipient(member.id)} className="h-4 w-4 accent-primary" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{member.firstName} {member.lastName}</span><span className="block truncate text-[11px] text-ink-muted">{member.email}</span></span>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end border-t border-border pt-4">
            <button type="submit" disabled={isSending || !body.trim() || (audience === 'seleccionados' && recipients.length === 0)} className="flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary-pressed disabled:cursor-not-allowed disabled:opacity-60"><Send className="h-3.5 w-3.5" />{isSending ? 'Enviando…' : 'Enviar notificación'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
