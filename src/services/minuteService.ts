import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Minute, MinuteCorrection, MasonicDegree } from '@/types';
import { auditService } from './auditService';

export const minuteService = {
  async getAllMinutes(): Promise<Minute[]> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    {
        const { data, error } = await supabase
          .from('minutes')
          .select('*, minute_corrections(*)')
          .is('deleted_at', null)
          .order('year', { ascending: false })
          .order('number', { ascending: false });

        if (error) throw error;
        if (data) {
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
      }
    return [];
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
      id: minute.id || crypto.randomUUID(),
      number: num,
      formatNumber: fmt,
      createdBy: minute.createdBy || user.id || 'sec',
      createdByName: minute.createdByName || user.name || user.email || 'Secretario',
      createdAt: now,
      updatedAt: now,
      readBy: minute.readBy || [],
      allowedMemberIds: minute.allowedMemberIds || [],
    };

    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    {
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
          const { error } = await supabase.from('minutes').insert(payload);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('minutes').update(payload).eq('id', fullMinute.id);
          if (error) throw error;
        }
      }

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

    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    {
        const { error } = await supabase.from('minute_corrections').insert({
          id: correction.id,
          minute_id: minuteId,
          author_id: user.id,
          author_name: correction.authorName,
          comment,
        });
        if (error) throw error;
    }

    await auditService.log('OBSERVACION_ACTA', 'minutes', minuteId, user, { comment });
    return correction;
  },

  async markAsRead(minuteId: string, memberId: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    const { error } = await supabase.from('minute_reads').upsert({
      minute_id: minuteId,
      user_id: memberId,
      read_at: new Date().toISOString(),
    }, { onConflict: 'minute_id,user_id' });
    if (error) throw error;
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

  async uploadPdf(minuteId: string, file: File): Promise<{ path: string; fileName: string; fileSize: number }> {
    const validation = this.validatePdfFile(file);
    if (!validation.valid) throw new Error(validation.error || 'PDF no válido.');
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');

    const path = `${minuteId}/${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('minutes-pdfs')
      .upload(path, file, { contentType: 'application/pdf', upsert: false });
    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase
      .from('minutes')
      .update({ pdf_url: path, pdf_file_name: file.name, pdf_file_size: file.size })
      .eq('id', minuteId);
    if (updateError) throw updateError;
    return { path, fileName: file.name, fileSize: file.size };
  },

  async getPdfViewerUrl(pdfPath: string): Promise<string> {
    if (/^https?:\/\//i.test(pdfPath)) return pdfPath;
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    const { data, error } = await supabase.storage
      .from('minutes-pdfs')
      .createSignedUrl(pdfPath, 60 * 60);
    if (error) throw error;
    return data.signedUrl;
  },

  async deleteMinute(id: string, user: { id?: string; email?: string }): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    {
        const { error } = await supabase
          .from('minutes')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
    }
    await auditService.log('ELIMINAR_ACTA', 'minutes', id, user, {});
  },
};
