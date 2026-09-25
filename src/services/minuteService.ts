import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Minute, MinuteCorrection, MasonicDegree } from '@/types';
import { auditService } from './auditService';

const LOCAL_MINUTES_KEY = 'logia_minutes_data';

function seedInitialMinutes(): Minute[] {
  return [];
}

function loadLocalMinutes(): Minute[] {
  try {
    const raw = localStorage.getItem(LOCAL_MINUTES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalMinutes(list: Minute[]) {
  try {
    localStorage.setItem(LOCAL_MINUTES_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export const minuteService = {
  async getAllMinutes(): Promise<Minute[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('minutes')
          .select('*, minute_corrections(*)')
          .is('deleted_at', null)
          .order('year', { ascending: false })
          .order('number', { ascending: false });

        if (!error && data) {
          return data.map((d) => ({
            id: d.id,
            number: d.number,
            year: d.year,
            formatNumber: d.format_number,
            title: d.title,
            description: d.description,
            meetingDate: d.meeting_date,
            degree: d.degree,
            status: d.status,
            eventId: d.event_id,
            eventTitle: d.event_title,
            volume: d.volume,
            folio: d.folio,
            notes: d.notes,
            pdfUrl: d.pdf_url,
            pdfFileName: d.pdf_file_name,
            pdfFileSize: d.pdf_file_size,
            corrections: d.minute_corrections?.map((c: { id: string; minute_id: string; author_id: string; author_name: string; comment: string; created_at: string }) => ({
              id: c.id,
              minuteId: c.minute_id,
              authorId: c.author_id,
              authorName: c.author_name,
              comment: c.comment,
              createdAt: c.created_at,
            })),
            readBy: [],
            createdBy: d.created_by,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
        }
      } catch (e) {
        console.warn('Fallo consulta Supabase minutes, usando local:', e);
      }
    }

    return loadLocalMinutes();
  },

  /**
   * Genera el siguiente número consecutivo para un año específico
   */
  async getNextConsecutiveNumber(year: number): Promise<{ number: number; formatNumber: string }> {
    const minutes = await this.getAllMinutes();
    const forYear = minutes.filter((m) => m.year === year);
    const maxNum = forYear.reduce((acc, m) => Math.max(acc, m.number), 0);
    const nextNum = maxNum + 1;
    const formatNumber = `${String(nextNum).padStart(2, '0')}-${year}`;
    return { number: nextNum, formatNumber };
  },

  /**
   * Verifica si un miembro tiene permiso de lectura sobre un acta
   */
  canMemberAccessMinute(
    minute: Minute,
    member: { degree: MasonicDegree; id: string; roleId: string }
  ): boolean {
    // Secretario y Venerable Maestro siempre tienen acceso a todas las actas
    if (member.roleId === 'sec' || member.roleId === 'vm') return true;

    // Si tiene acceso individual concedido explícitamente
    if (minute.allowedMemberIds && minute.allowedMemberIds.includes(member.id)) {
      return true;
    }

    // Actas en borrador solo visibles para dignatarios administradores
    if (minute.status === 'borrador') {
      return ['sec', 'vm', 'ora'].includes(member.roleId);
    }

    // Regla de Grados Masónicos:
    // Un Aprendiz solo puede ver actas de Grado de Aprendiz.
    // Un Compañero puede ver actas de Aprendiz y Compañero.
    // Un Maestro puede ver actas de Aprendiz, Compañero y Maestro.
    if (member.degree === 'aprendiz') {
      return minute.degree === 'aprendiz';
    }
    if (member.degree === 'companero') {
      return minute.degree === 'aprendiz' || minute.degree === 'companero';
    }
    if (member.degree === 'maestro') {
      return true;
    }

    return false;
  },

  async saveMinute(
    minute: Omit<Minute, 'id' | 'number' | 'formatNumber' | 'createdAt' | 'updatedAt' | 'createdBy'> & {
      id?: string;
      number?: number;
      formatNumber?: string;
      createdBy?: string;
    },
    user: { id?: string; email?: string; name?: string }
  ): Promise<Minute> {
    const isNew = !minute.id;
    const now = new Date().toISOString();
    let num = minute.number;
    let fmt = minute.formatNumber;

    if (isNew || !num || !fmt) {
      const generated = await this.getNextConsecutiveNumber(minute.year);
      num = generated.number;
      fmt = generated.formatNumber;
    }

    const fullMinute: Minute = {
      ...minute,
      id: minute.id || `min-${Date.now()}`,
      number: num,
      formatNumber: fmt,
      createdBy: minute.createdBy || user.id || 'sec',
      createdByName: minute.createdByName || user.name || user.email || 'Secretario',
      createdAt: now,
      updatedAt: now,
      readBy: minute.readBy || [],
      allowedMemberIds: minute.allowedMemberIds || [],
    };

    if (isSupabaseConfigured()) {
      try {
        const payload = {
          id: fullMinute.id,
          number: fullMinute.number,
          year: fullMinute.year,
          format_number: fullMinute.formatNumber,
          title: fullMinute.title,
          description: fullMinute.description,
          meeting_date: fullMinute.meetingDate,
          degree: fullMinute.degree,
          status: fullMinute.status,
          event_id: fullMinute.eventId,
          event_title: fullMinute.eventTitle,
          volume: fullMinute.volume,
          folio: fullMinute.folio,
          notes: fullMinute.notes,
          pdf_url: fullMinute.pdfUrl,
          pdf_file_name: fullMinute.pdfFileName,
          pdf_file_size: fullMinute.pdfFileSize,
        };

        if (isNew) {
          await supabase.from('minutes').insert(payload);
        } else {
          await supabase.from('minutes').update(payload).eq('id', fullMinute.id);
        }
      } catch (e) {
        console.warn('Error guardando en Supabase minutes:', e);
      }
    }

    const local = loadLocalMinutes();
    const idx = local.findIndex((m) => m.id === fullMinute.id);
    if (idx >= 0) {
      local[idx] = fullMinute;
    } else {
      local.unshift(fullMinute);
    }
    saveLocalMinutes(local);

    await auditService.log(
      isNew ? 'CREAR_ACTA' : 'ACTUALIZAR_ACTA',
      'minutes',
      fullMinute.id,
      user,
      { formatNumber: fullMinute.formatNumber, title: fullMinute.title, status: fullMinute.status }
    );

    return fullMinute;
  },

  async addCorrection(
    minuteId: string,
    comment: string,
    user: { id?: string; email?: string; name?: string }
  ): Promise<MinuteCorrection> {
    const correction: MinuteCorrection = {
      id: `corr-${Date.now()}`,
      minuteId,
      authorId: user.id || 'hermano',
      authorName: user.name || user.email || 'Hermano',
      comment,
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('minute_corrections').insert({
          id: correction.id,
          minute_id: minuteId,
          author_id: user.id,
          author_name: correction.authorName,
          comment,
        });
      } catch (e) {
        console.warn('Error guardando corrección en Supabase:', e);
      }
    }

    const local = loadLocalMinutes();
    const min = local.find((m) => m.id === minuteId);
    if (min) {
      if (!min.corrections) min.corrections = [];
      min.corrections.push(correction);
      saveLocalMinutes(local);
    }

    await auditService.log('OBSERVACION_ACTA', 'minutes', minuteId, user, { comment });
    return correction;
  },

  async markAsRead(minuteId: string, memberId: string): Promise<void> {
    const local = loadLocalMinutes();
    const min = local.find((m) => m.id === minuteId);
    if (min) {
      if (!min.readBy) min.readBy = [];
      if (!min.readBy.includes(memberId)) {
        min.readBy.push(memberId);
        saveLocalMinutes(local);
      }
    }
  },

  validatePdfFile(file: File): { valid: boolean; error?: string } {
    if (file.type !== 'application/pdf') {
      return { valid: false, error: 'El archivo debe ser un documento PDF válido.' };
    }
    const MAX_SIZE_MB = 15;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return { valid: false, error: `El archivo excede el tamaño máximo permitido de ${MAX_SIZE_MB}MB.` };
    }
    return { valid: true };
  },

  async deleteMinute(id: string, user: { id?: string; email?: string }): Promise<void> {
    const local = loadLocalMinutes();
    const target = local.find((m) => m.id === id);

    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('minutes')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);
      } catch (e) {
        console.warn('Error eliminando acta en Supabase:', e);
      }
    }

    const filtered = local.filter((m) => m.id !== id);
    saveLocalMinutes(filtered);

    if (target) {
      await auditService.log('ELIMINAR_ACTA', 'minutes', id, user, {
        formatNumber: target.formatNumber,
        title: target.title,
      });
    }
  },
};
