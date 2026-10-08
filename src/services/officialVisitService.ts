import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type {
  OfficialVisitChecklistItem,
  OfficialVisitSummary,
  Member,
  LodgeEvent,
  Minute,
  AttendanceRecord,
  LodgeSettings,
} from '@/types';
import { auditService } from './auditService';

export const officialVisitService = {
  async getChecklist(): Promise<OfficialVisitChecklistItem[]> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    {
        const { data, error } = await supabase
          .from('official_visit_checklist')
          .select('*')
          .order('id', { ascending: true });
        if (error) throw error;
        if (data) {
          return data.map((d) => ({
            id: d.id,
            title: d.title,
            description: d.description,
            completed: d.completed,
            notes: d.notes,
            verifiedBy: d.verified_by,
            verifiedAt: d.verified_at,
          }));
        }
      }
    return [];
  },

  async updateChecklistItem(
    id: number,
    completed: boolean,
    notes: string | undefined,
    user: { id?: string; email?: string }
  ): Promise<void> {
    const now = new Date().toISOString();
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    {
        const { error } = await supabase
          .from('official_visit_checklist')
          .update({
            completed,
            notes,
            verified_by: completed ? user.id : null,
            verified_at: completed ? now : null,
          })
          .eq('id', id);
        if (error) throw error;
    }
    await auditService.log('CHECKLIST_VISITA_ACTUALIZADO', 'official_visit_checklist', String(id), user, { completed });
  },

  async getLodgeSettings(): Promise<LodgeSettings> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    {
        const { data, error } = await supabase.from('lodge_settings').select('*').limit(1).single();
        if (error) throw error;
        if (data) {
          return {
            id: data.id,
            lodgeName: data.lodge_name,
            lodgeNumber: data.lodge_number,
            orient: data.orient,
            rite: data.rite,
            charterDate: data.charter_date,
            regularMeetingDays: data.regular_meeting_days,
            templeAddress: data.temple_address,
            contactEmail: data.contact_email,
            secretaryEmail: data.secretary_email || data.contact_email,
            currentVenerableMaster: data.current_venerable_master,
            currentSecretary: data.current_secretary,
            privacyPolicyUrl: data.privacy_policy_url,
            updatedAt: data.updated_at,
          };
        }
      }
    throw new Error('No se encontró la configuración de la logia.');
  },

  async updateLodgeSettings(
    settings: Partial<LodgeSettings>,
    user: { id?: string; email?: string }
  ): Promise<LodgeSettings> {
    const current = await this.getLodgeSettings();
    const updated: LodgeSettings = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString(),
    };

    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    {
        const { error } = await supabase
          .from('lodge_settings')
          .update({
            lodge_name: updated.lodgeName,
            lodge_number: updated.lodgeNumber,
            orient: updated.orient,
            rite: updated.rite,
            charter_date: updated.charterDate,
            regular_meeting_days: updated.regularMeetingDays,
            temple_address: updated.templeAddress,
            contact_email: updated.contactEmail,
            secretary_email: updated.secretaryEmail,
            current_venerable_master: updated.currentVenerableMaster,
            current_secretary: updated.currentSecretary,
            privacy_policy_url: updated.privacyPolicyUrl,
          })
          .eq('id', updated.id);
        if (error) throw error;
    }
    await auditService.log('CONFIGURACION_LOGIA_ACTUALIZADA', 'lodge_settings', updated.id, user, {
      lodgeName: updated.lodgeName,
    });
    return updated;
  },

  /**
   * Resumen automático calculado a partir de:
   * Miembros, Eventos, Actas, Asistencia y Configuración de la Logia.
   */
  computeAutomaticSummary(
    members: Member[],
    events: LodgeEvent[],
    minutes: Minute[],
    attendanceList: AttendanceRecord[],
    checklist: OfficialVisitChecklistItem[]
  ): OfficialVisitSummary {
    const activeMembers = members.filter((m) => m.isActive);
    const activeMembersCount = activeMembers.length;

    // Solo tenidas celebradas o activas
    const regularMeetingsHeld = events.filter((e) => e.isMeeting && e.status !== 'cancelada').length;

    // Cálculo de asistencia promedio
    let averageAttendancePercentage = 0;
    if (regularMeetingsHeld > 0 && activeMembersCount > 0) {
      let totalPresents = 0;
      let evaluatedMeetings = 0;

      for (const ev of events.filter((e) => e.isMeeting && e.status !== 'cancelada')) {
        const records = attendanceList.filter((a) => a.eventId === ev.id);
        if (records.length > 0) {
          evaluatedMeetings++;
          totalPresents += records.filter((r) => r.status === 'presente').length;
        }
      }

      if (evaluatedMeetings > 0) {
        const avgPresent = totalPresents / evaluatedMeetings;
        averageAttendancePercentage = Math.min(100, Math.round((avgPresent / activeMembersCount) * 100));
      }
    }

    const approvedMinutesCount = minutes.filter((m) => m.status === 'aprobada' || m.status === 'firmada').length;
    const pendingMinutesCount = minutes.filter((m) => m.status === 'borrador' || m.status === 'circulada').length;

    const checklistItemsCompleted = checklist.filter((c) => c.completed).length;
    const checklistTotalItems = checklist.length || 8;

    // Preparación global: ponderación de actas al día + checklist completado
    const checklistRatio = checklistTotalItems > 0 ? checklistItemsCompleted / checklistTotalItems : 0;
    const minutesRatio = regularMeetingsHeld > 0 ? Math.min(1, approvedMinutesCount / Math.max(1, regularMeetingsHeld)) : 0;
    const overallReadiness = Math.round((checklistRatio * 0.6 + minutesRatio * 0.4) * 100);

    return {
      activeMembersCount,
      regularMeetingsHeld,
      averageAttendancePercentage,
      approvedMinutesCount,
      pendingMinutesCount,
      checklistItemsCompleted,
      checklistTotalItems,
      charterStatus: 'valid',
      overallReadiness,
    };
  },
};
