import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AttendanceRecord, AttendanceResponse, VisitorAttendance, AttendanceStatus, LodgeEvent } from '@/types';
import { auditService } from './auditService';

const notifyAttendanceChanged = (eventId: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('logia:data-changed', {
      detail: { table: 'attendance', event: 'CHANGE', eventId },
    }));
  }
};

export const attendanceService = {
  async getAttendanceForEvent(
    eventId: string,
    segmentId: string,
    viewer?: { canViewExcuseReasons?: boolean; memberId?: string }
  ): Promise<AttendanceRecord[]> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    {
        const { data, error } = await supabase.from('attendance').select('*').eq('event_id', eventId).eq('segment_id', segmentId);
        if (error) throw error;
        if (data) {
          return data.map((d) => ({
            id: d.id,
            eventId: d.event_id,
            segmentId: d.segment_id,
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
      .from('attendance_responses')
      .select('event_id, excuse_reason')
      .eq('member_id', memberId)
      .eq('status', 'excusa');
    if (error) throw error;

    return (data || [])
      .filter((record) => !record.excuse_reason?.trim())
      .map((record) => ({ eventId: record.event_id }));
  },

  async getResponsesForEvent(eventId: string, segmentId: string, viewer?: { canViewAll?: boolean; memberId?: string }): Promise<AttendanceResponse[]> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    let query = supabase.from('attendance_responses').select('*').eq('event_id', eventId).eq('segment_id', segmentId);
    if (!viewer?.canViewAll && viewer?.memberId) query = query.eq('member_id', viewer.memberId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((d) => ({
      id: d.id,
      eventId: d.event_id,
      segmentId: d.segment_id,
      memberId: d.member_id,
      status: d.status,
      excuseReason: d.excuse_reason || undefined,
      submittedAt: d.submitted_at,
      updatedAt: d.updated_at,
    }));
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
    segmentId: string,
    records: { memberId: string; status: AttendanceStatus; excuseReason?: string }[],
    user: { id?: string; email?: string }
  ): Promise<void> {
    const now = new Date().toISOString();
    const updatedRecords: AttendanceRecord[] = records.map((r) => ({
      id: `att-${eventId}-${r.memberId}`,
      eventId,
      segmentId,
      memberId: r.memberId,
      status: r.status,
      updatedBy: user.id || 'sistema',
      updatedAt: now,
    }));

    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    {
        const upsertPayload = updatedRecords.map((r) => ({
          event_id: r.eventId,
          segment_id: r.segmentId,
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
        const { error } = await supabase.from('attendance').upsert(upsertPayload, { onConflict: 'event_id,segment_id,member_id' });
        if (error) throw error;
    }

    await auditService.log('REGISTRO_ASISTENCIA', 'attendance', eventId, user, {
      total: records.length,
      presentes: records.filter((r) => r.status === 'presente').length,
    });
    notifyAttendanceChanged(eventId);
  },

  async saveMemberExcuse(
    eventId: string,
    segmentId: string,
    memberId: string,
    reason: string,
    user: { id?: string; email?: string }
  ): Promise<void> {
    const cleanReason = reason.trim();
    if (!cleanReason) throw new Error('La explicación de la excusa es obligatoria.');
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('start_date, start_time, status')
      .eq('id', eventId)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event || event.status === 'cancelada') throw new Error('La actividad ya no está disponible para registrar excusas.');
    const eventStart = new Date(`${event.start_date}T${event.start_time || '23:59:59'}-05:00`);
    if (Number.isNaN(eventStart.getTime()) || Date.now() >= eventStart.getTime()) {
      throw new Error('El plazo para presentar o editar la excusa venció al iniciar el evento.');
    }

    const { data: current, error: currentError } = await supabase
      .from('attendance_responses')
      .select('submitted_at')
      .eq('event_id', eventId)
      .eq('segment_id', segmentId)
      .eq('member_id', memberId)
      .maybeSingle();
    if (currentError) throw currentError;

    const submittedAt = current?.submitted_at as string | null | undefined;

    const { error } = await supabase.from('attendance_responses').upsert({
      event_id: eventId,
      segment_id: segmentId,
      member_id: memberId,
      status: 'excusa',
      excuse_reason: cleanReason,
      submitted_at: submittedAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id,segment_id,member_id' });
    if (error) throw error;

    await auditService.log('REGISTRO_EXCUSA', 'attendance_responses', eventId, user, {
      memberId,
      reason: cleanReason,
    });
    notifyAttendanceChanged(eventId);
  },

  async clearMemberAttendance(
    eventId: string,
    segmentId: string,
    memberId: string,
    user: { id?: string; email?: string }
  ): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    const { error } = await supabase
      .from('attendance_responses')
      .delete()
      .eq('event_id', eventId)
      .eq('segment_id', segmentId)
      .eq('member_id', memberId);
    if (error) throw error;

    await auditService.log('RETIRAR_RESPUESTA_ASISTENCIA', 'attendance_responses', eventId, user, { memberId });
    notifyAttendanceChanged(eventId);
  },

  async saveMemberConfirmation(
    eventId: string,
    segmentId: string,
    memberId: string,
    user: { id?: string; email?: string }
  ): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    const { error } = await supabase.from('attendance_responses').upsert({
      event_id: eventId,
      segment_id: segmentId,
      member_id: memberId,
      status: 'confirmada',
      excuse_reason: null,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id,segment_id,member_id' });
    if (error) throw error;
    await auditService.log('CONFIRMACION_ASISTENCIA', 'attendance_responses', eventId, user, { memberId });
    notifyAttendanceChanged(eventId);
  },

  async saveMemberExcusePending(
    eventId: string,
    segmentId: string,
    memberId: string,
    user: { id?: string; email?: string }
  ): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    const { error } = await supabase.from('attendance_responses').upsert({
      event_id: eventId,
      segment_id: segmentId,
      member_id: memberId,
      status: 'excusa',
      excuse_reason: null,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id,segment_id,member_id' });
    if (error) throw error;
    await auditService.log('REGISTRO_EXCUSA', 'attendance_responses', eventId, user, { memberId });
    notifyAttendanceChanged(eventId);
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
