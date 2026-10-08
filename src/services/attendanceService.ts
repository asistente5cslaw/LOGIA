import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AttendanceRecord, VisitorAttendance, AttendanceStatus, LodgeEvent } from '@/types';
import { auditService } from './auditService';

export const attendanceService = {
  async getAttendanceForEvent(
    eventId: string,
    viewer?: { canViewExcuseReasons?: boolean; memberId?: string }
  ): Promise<AttendanceRecord[]> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    {
        const { data, error } = await supabase.from('attendance').select('*').eq('event_id', eventId);
        if (error) throw error;
        if (data) {
          return data.map((d) => ({
            id: d.id,
            eventId: d.event_id,
            memberId: d.member_id,
            status: d.status,
            updatedBy: d.updated_by,
            updatedAt: d.updated_at,
            excuseReason:
              viewer?.canViewExcuseReasons || d.member_id === viewer?.memberId
                ? (d.excuse_reason || undefined)
                : undefined,
            excuseSubmittedAt: d.excuse_submitted_at || undefined,
          }));
        }
      }
    return [];
  },

  async getPendingExcusesForMember(memberId: string): Promise<{ eventId: string }[]> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');

    const { data, error } = await supabase
      .from('attendance')
      .select('event_id, excuse_reason')
      .eq('member_id', memberId)
      .eq('status', 'excusa');
    if (error) throw error;

    return (data || [])
      .filter((record) => !record.excuse_reason?.trim())
      .map((record) => ({ eventId: record.event_id }));
  },

  async getVisitorsForEvent(eventId: string): Promise<VisitorAttendance[]> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    {
        const { data, error } = await supabase.from('attendance_visitors').select('*').eq('event_id', eventId);
        if (error) throw error;
        if (data) {
          return data.map((d) => ({
            id: d.id,
            eventId: d.event_id,
            fullName: d.full_name,
            lodge: d.lodge,
            degree: d.degree,
            notes: d.notes,
            createdAt: d.created_at,
          }));
        }
      }
    return [];
  },

  async saveAttendanceBatch(
    eventId: string,
    records: { memberId: string; status: AttendanceStatus; excuseReason?: string }[],
    user: { id?: string; email?: string }
  ): Promise<void> {
    const now = new Date().toISOString();
    const updatedRecords: AttendanceRecord[] = records.map((r) => ({
      id: `att-${eventId}-${r.memberId}`,
      eventId,
      memberId: r.memberId,
      status: r.status,
      updatedBy: user.id || 'sistema',
      updatedAt: now,
    }));

    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    {
        const upsertPayload = updatedRecords.map((r) => ({
          event_id: r.eventId,
          member_id: r.memberId,
          status: r.status,
          ...(r.status === 'excusa' && r.excuseReason?.trim()
            ? { excuse_reason: r.excuseReason.trim() }
            : r.status !== 'excusa'
              ? { excuse_reason: null }
              : {}),
          updated_by: r.updatedBy,
          updated_at: r.updatedAt,
        }));
        const { error } = await supabase.from('attendance').upsert(upsertPayload, { onConflict: 'event_id,member_id' });
        if (error) throw error;
    }

    await auditService.log('REGISTRO_ASISTENCIA', 'attendance', eventId, user, {
      total: records.length,
      presentes: records.filter((r) => r.status === 'presente').length,
    });
  },

  async saveMemberExcuse(
    eventId: string,
    memberId: string,
    reason: string,
    user: { id?: string; email?: string }
  ): Promise<void> {
    const cleanReason = reason.trim();
    if (!cleanReason) throw new Error('La explicación de la excusa es obligatoria.');
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');

    const { data: current, error: currentError } = await supabase
      .from('attendance')
      .select('excuse_submitted_at')
      .eq('event_id', eventId)
      .eq('member_id', memberId)
      .maybeSingle();
    if (currentError) throw currentError;

    const submittedAt = current?.excuse_submitted_at as string | null | undefined;
    if (submittedAt && Date.now() >= new Date(submittedAt).getTime() + 24 * 60 * 60 * 1000) {
      throw new Error('El plazo de 24 horas para editar esta excusa ya venció.');
    }

    const { error } = await supabase.from('attendance').upsert({
      event_id: eventId,
      member_id: memberId,
      status: 'excusa',
      excuse_reason: cleanReason,
      excuse_submitted_at: submittedAt || new Date().toISOString(),
      updated_by: user.id || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id,member_id' });
    if (error) throw error;

    await auditService.log('REGISTRO_EXCUSA', 'attendance', eventId, user, {
      memberId,
      reason: cleanReason,
    });
  },

  async clearMemberAttendance(
    eventId: string,
    memberId: string,
    user: { id?: string; email?: string }
  ): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('event_id', eventId)
      .eq('member_id', memberId);
    if (error) throw error;

    await auditService.log('RETIRAR_RESPUESTA_ASISTENCIA', 'attendance', eventId, user, { memberId });
  },

  async addVisitor(
    visitor: Omit<VisitorAttendance, 'id' | 'createdAt'>,
    user: { id?: string; email?: string }
  ): Promise<VisitorAttendance> {
    const fullVisitor: VisitorAttendance = {
      ...visitor,
      id: `vis-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    {
        const { error } = await supabase.from('attendance_visitors').insert({
          id: fullVisitor.id,
          event_id: fullVisitor.eventId,
          full_name: fullVisitor.fullName,
          lodge: fullVisitor.lodge,
          degree: fullVisitor.degree,
          notes: fullVisitor.notes,
        });
        if (error) throw error;
    }

    await auditService.log('VISITANTE_REGISTRADO', 'attendance_visitors', fullVisitor.id, user, {
      fullName: fullVisitor.fullName,
      lodge: fullVisitor.lodge,
    });

    return fullVisitor;
  },

  /**
   * Calcula estadísticas históricas excluyendo eventos que no sean tenidas.
   */
  calculateStatistics(
    events: LodgeEvent[],
    attendanceList: AttendanceRecord[],
    activeMembersCount: number
  ): {
    totalMeetings: number;
    averageAttendanceRate: number;
    averagePresentCount: number;
  } {
    // REGLA: Excluir eventos que no sean tenidas rituales o que estén cancelados
    const meetings = events.filter((e) => e.isMeeting && e.status !== 'cancelada');

    if (meetings.length === 0 || activeMembersCount === 0) {
      return { totalMeetings: 0, averageAttendanceRate: 0, averagePresentCount: 0 };
    }

    let totalPresentsAcrossMeetings = 0;
    let meetingsWithAttendanceRecorded = 0;

    for (const m of meetings) {
      const records = attendanceList.filter((a) => a.eventId === m.id);
      if (records.length > 0) {
        meetingsWithAttendanceRecorded++;
        const presentCount = records.filter((r) => r.status === 'presente').length;
        totalPresentsAcrossMeetings += presentCount;
      }
    }

    if (meetingsWithAttendanceRecorded === 0) {
      return {
        totalMeetings: meetings.length,
        averageAttendanceRate: 0,
        averagePresentCount: 0,
      };
    }

    const averagePresentCount = Math.round((totalPresentsAcrossMeetings / meetingsWithAttendanceRecorded) * 10) / 10;
    const averageAttendanceRate = Math.min(100, Math.round((averagePresentCount / activeMembersCount) * 100));

    return {
      totalMeetings: meetings.length,
      averageAttendanceRate,
      averagePresentCount,
    };
  },
};
