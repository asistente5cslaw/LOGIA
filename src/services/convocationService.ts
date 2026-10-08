import type { LodgeEvent, Member, MasonicDegree } from '@/types';
import { institutionalRoles } from '@/data/rolesData';
import { getBodyById } from '@/data/bodiesData';
import { formatDateSpanish, formatTime12 } from '@/lib/dateUtils';
import { supabase } from '@/lib/supabase';

export interface ConvocationDraft {
  eventId: string;
  subject: string;
  bodyText: string;
  degreeTarget: MasonicDegree;
  recipientsCount: number;
}

export const convocationService = {
  /**
   * Genera el texto protocolar solemne para la tenida o evento
   */
  generateOfficialText(event: LodgeEvent, lodgeName = 'Resp.·. Log.·. Unión Fraternal No. 21'): string {
    const body = getBodyById(event.bodyId);
    const roleLabel = institutionalRoles.find((role) => role.id === event.roleRequired)?.name || 'Todos los miembros';

    const timeFormatted = event.startTime ? `a las ${formatTime12(event.startTime)}` : 'a la hora ritual';
    const dateFormatted = formatDateSpanish(event.startDate);

    return `A.·. L.·. G.·. D.·. G.·. A.·. D.·. U.·.
S.·. F.·. U.·.

${lodgeName.toUpperCase()}
Bajo los auspicios de la Muy Resp.·. Gran Logia de Panamá
Jurisdicción: ${body.name}

CONVOCATORIA OFICIAL

Queridos Hermanos todos:

Por disposición del Venerable Maestro y de conformidad con nuestros Antiguos Límites y Reglamentos Generales, se os convoca formalmente a los augustos trabajos de nuestra logia:

• ASUNTO: ${event.title}
• FECHA: ${dateFormatted}
• HORA: ${timeFormatted}
• LUGAR: ${event.location}
• ROL REQUERIDO: ${roleLabel}

${event.notes ? `OBSERVACIONES: ${event.notes}\n` : ''}
Se recuerda a todos los QQ.·. HH.·. la estricta puntualidad, el uso del mandil, arreos correspondientes y vestimenta formal oscura reglamentaria.

Dado en el Valle de Panamá, a las puertas de nuestro templo.

Fraternalmente,
La Secretaría del Taller`;
  },

  generateEmailBody(event: LodgeEvent, officialText?: string): string {
    const activityLabel = event.eventCategory === 'tenida' ? 'tenida' : 'reunión';

    const introduction = `Estimados Hermanos:

Por este medio les remito adjunta la convocatoria oficial para nuestra próxima ${activityLabel}.

Agradecemos revisar el documento adjunto y tomar nota de la fecha, hora, lugar y demás indicaciones allí señaladas.

Se adjunta el PDF de la convocatoria.`;

    return `${introduction}

${(officialText || convocationService.generateOfficialText(event)).trim()}`;
  },

  filterRecipientsByDegree(members: Member[], degreeRequired: MasonicDegree): Member[] {
    const active = members.filter((m) => m.isActive);
    if (degreeRequired === 'aprendiz') {
      return active; // Todos los grados asisten
    }
    if (degreeRequired === 'companero') {
      return active.filter((m) => m.roleId === 'vm' || m.degree === 'companero' || m.degree === 'maestro');
    }
    return active.filter((m) => m.roleId === 'vm' || m.degree === 'maestro');
  },

  generateWhatsAppUrl(phone: string | undefined, message: string): string {
    const encoded = encodeURIComponent(message);
    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      return `https://wa.me/${cleanPhone}?text=${encoded}`;
    }
    return `https://wa.me/?text=${encoded}`;
  },

  /** Prepara el enlace mailto usando CC para que los destinatarios sean visibles. */
  generateMailtoUrl(subject: string, bodyText: string, recipientEmails: string[]): string {
    const ccList = [...new Set(recipientEmails.map((email) => email.trim().toLowerCase()).filter(Boolean))].join(',');
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(bodyText);
    return `mailto:?cc=${encodeURIComponent(ccList)}&subject=${encodedSubject}&body=${encodedBody}`;
  },

  async sendEmailWithPdf(payload: {
    subject: string;
    bodyText: string;
    recipientEmails: string[];
    pdfPath?: string;
    pdfFileName?: string;
  }): Promise<void> {
    const { error } = await supabase.functions.invoke('send-convocation-email', { body: payload });
    if (error) throw error;
  },
};
