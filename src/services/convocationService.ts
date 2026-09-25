import type { LodgeEvent, Member, MasonicDegree } from '@/types';
import { getBodyById } from '@/data/bodiesData';
import { formatDateSpanish, formatTime12 } from '@/lib/dateUtils';

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
    const degreeLabel =
      event.degreeRequired === 'aprendiz'
        ? 'Primer Grado (Aprendiz)'
        : event.degreeRequired === 'companero'
        ? 'Segundo Grado (Compañero)'
        : 'Tercer Grado (Maestro)';

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
• CÁMARA DE TRABAJO: ${degreeLabel}

${event.notes ? `OBSERVACIONES: ${event.notes}\n` : ''}
Se recuerda a todos los QQ.·. HH.·. la estricta puntualidad, el uso del mandil, arreos correspondientes y vestimenta formal oscura reglamentaria.

Dado en el Valle de Panamá, a las puertas de nuestro templo.

Fraternalmente,
La Secretaría del Taller`;
  },

  filterRecipientsByDegree(members: Member[], degreeRequired: MasonicDegree): Member[] {
    const active = members.filter((m) => m.isActive);
    if (degreeRequired === 'aprendiz') {
      return active; // Todos los grados asisten
    }
    if (degreeRequired === 'companero') {
      return active.filter((m) => m.degree === 'companero' || m.degree === 'maestro');
    }
    return active.filter((m) => m.degree === 'maestro');
  },

  generateWhatsAppUrl(phone: string | undefined, message: string): string {
    const encoded = encodeURIComponent(message);
    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      return `https://wa.me/${cleanPhone}?text=${encoded}`;
    }
    return `https://wa.me/?text=${encoded}`;
  },

  /**
   * Prepara el enlace mailto usando CCO (BCC) obligatorio para nunca exponer la lista de correos
   */
  generateMailtoUrl(subject: string, bodyText: string, recipientEmails: string[]): string {
    const bccList = recipientEmails.join(',');
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(bodyText);
    return `mailto:?bcc=${encodeURIComponent(bccList)}&subject=${encodedSubject}&body=${encodedBody}`;
  },
};
