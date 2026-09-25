import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AttendanceRecord, VisitorAttendance, AttendanceStatus, LodgeEvent } from '@/types';
import { auditService } from './auditService';

const LOCAL_ATTENDANCE_KEY = 'logia_attendance_data';
const LOCAL_VISITORS_KEY = 'logia_visitors_data';

function loadLocalAttendance(): AttendanceRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_ATTENDANCE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalAttendance(list: AttendanceRecord[]) {
  try {
    localStorage.setItem(LOCAL_ATTENDANCE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function loadLocalVisitors(): VisitorAttendance[] {
  try {
    const raw = localStorage.getItem(LOCAL_VISITORS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalVisitors(list: VisitorAttendance[]) {
  try {
    localStorage.setItem(LOCAL_VISITORS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export const attendanceService = {
  async getAttendanceForEvent(eventId: string): Promise<AttendanceRecord[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.from('attendance').select('*').eq('event_id', eventId);
        if (!error && data) {
          return data.map((d) => ({
            id: d.id,
            eventId: d.event_id,
            memberId: d.member_id,
            status: d.status,
            updatedBy: d.updated_by,
            updatedAt: d.updated_at,
          }));
        }
      } catch (e) {
        console.warn('Error en Supabase getAttendanceForEvent:', e);
      }
    }
    const local = loadLocalAttendance();
    return local.filter((a) => a.eventId === eventId);
  },

  async getVisitorsForEvent(eventId: string): Promise<VisitorAttendance[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.from('attendance_visitors').select('*').eq('event_id', eventId);
        if (!error && data) {
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
      } catch (e) {
        console.warn('Error en Supabase getVisitorsForEvent:', e);
      }
    }
    const local = loadLocalVisitors();
    return local.filter((v) => v.eventId === eventId);
  },

  async saveAttendanceBatch(
    eventId: string,
    records: { memberId: string; status: AttendanceStatus }[],
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

    if (isSupabaseConfigured()) {
      try {
        const upsertPayload = updatedRecords.map((r) => ({
          event_id: r.eventId,
          member_id: r.memberId,
          status: r.status,
          updated_by: r.updatedBy,
          updated_at: r.updatedAt,
        }));
        await supabase.from('attendance').upsert(upsertPayload, { onConflict: 'event_id,member_id' });
      } catch (e) {
        console.warn('Error en Supabase saveAttendanceBatch:', e);
      }
    }

    const local = loadLocalAttendance();
    const otherEvents = local.filter((a) => a.eventId !== eventId);
    saveLocalAttendance([...otherEvents, ...updatedRecords]);

    await auditService.log('REGISTRO_ASISTENCIA', 'attendance', eventId, user, {
      total: records.length,
      presentes: records.filter((r) => r.status === 'presente').length,
    });
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

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('attendance_visitors').insert({
          id: fullVisitor.id,
          event_id: fullVisitor.eventId,
          full_name: fullVisitor.fullName,
          lodge: fullVisitor.lodge,
          degree: fullVisitor.degree,
          notes: fullVisitor.notes,
        });
      } catch (e) {
        console.warn('Error guardando visitante en Supabase:', e);
      }
    }

    const local = loadLocalVisitors();
    local.push(fullVisitor);
    saveLocalVisitors(local);

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
