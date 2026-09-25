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

const LOCAL_CHECKLIST_KEY = 'logia_official_visit_checklist';
const LOCAL_SETTINGS_KEY = 'logia_settings_data';

const defaultChecklist: OfficialVisitChecklistItem[] = [
  {
    id: 1,
    title: 'Lista de Asistencia',
    description: 'Registro formal y actualizado de asistencia a todas las tenidas celebradas del año masónico.',
    completed: false,
    notes: undefined,
  },
  {
    id: 2,
    title: 'Libro de Actas',
    description: 'Libro de actas foliado, firmado y al día con actas debidamente aprobadas en los tres grados.',
    completed: false,
    notes: undefined,
  },
  {
    id: 3,
    title: 'Libro de Tesorería',
    description: 'Control de cuentas, cuotas mensuales e ingresos/egresos del taller auditados.',
    completed: false,
    notes: undefined,
  },
  {
    id: 4,
    title: 'Carta Constitutiva',
    description: 'Carta Patente original expedida por la Gran Logia en exhibición y resguardo en el oriente.',
    completed: false,
    notes: undefined,
  },
  {
    id: 5,
    title: 'Código Masónico Reformado',
    description: 'Ejemplar vigente del Código Masónico Reformado de la Gran Logia de Panamá en el ara.',
    completed: false,
    notes: undefined,
  },
  {
    id: 6,
    title: 'Estatutos del Taller',
    description: 'Reglamento interno aprobado y concordante con los estatutos generales.',
    completed: false,
    notes: undefined,
  },
  {
    id: 7,
    title: 'Libros de Registro',
    description: 'Libro de oro de firmas, registros de afiliaciones, iniciaciones y pasaportes.',
    completed: false,
    notes: undefined,
  },
  {
    id: 8,
    title: 'Cuestionario de Visitas Oficiales',
    description: 'Formulario oficial de Gran Logia diligenciado previo a la llegada de la comisión inspectora.',
    completed: false,
    notes: undefined,
  },
];

function loadLocalChecklist(): OfficialVisitChecklistItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_CHECKLIST_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return defaultChecklist;
}

function saveLocalChecklist(list: OfficialVisitChecklistItem[]) {
  try {
    localStorage.setItem(LOCAL_CHECKLIST_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

const defaultSettings: LodgeSettings = {
  id: 'lodge-uf21',
  lodgeName: 'Resp.·. Log.·. Unión Fraternal No. 21',
  lodgeNumber: 21,
  orient: 'Oriente de Panamá',
  rite: 'Rito Escocés Antiguo y Aceptado',
  charterDate: '1921-06-24',
  regularMeetingDays: 'Todos los 2do y 4to miércoles de cada mes a las 7:30 p.m.',
  templeAddress: 'Gran Templo Masónico, Calle 43 Bella Vista, Ciudad de Panamá',
  contactEmail: 'secretaria@unionfraternal21.org',
  currentVenerableMaster: 'Denzel Coronado',
  currentSecretary: '',
  privacyPolicyUrl: 'https://unionfraternal21.org/privacidad-ley81',
  updatedAt: new Date().toISOString(),
};

function loadLocalSettings(): LodgeSettings {
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return defaultSettings;
}

function saveLocalSettings(settings: LodgeSettings) {
  try {
    localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export const officialVisitService = {
  async getChecklist(): Promise<OfficialVisitChecklistItem[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('official_visit_checklist')
          .select('*')
          .order('id', { ascending: true });
        if (!error && data && data.length > 0) {
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
      } catch (e) {
        console.warn('Error al consultar checklist en Supabase:', e);
      }
    }
    return loadLocalChecklist();
  },

  async updateChecklistItem(
    id: number,
    completed: boolean,
    notes: string | undefined,
    user: { id?: string; email?: string }
  ): Promise<void> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('official_visit_checklist')
          .update({
            completed,
            notes,
            verified_by: completed ? user.id : null,
            verified_at: completed ? now : null,
          })
          .eq('id', id);
      } catch (e) {
        console.warn('Error en updateChecklistItem Supabase:', e);
      }
    }

    const local = loadLocalChecklist();
    const item = local.find((i) => i.id === id);
    if (item) {
      item.completed = completed;
      item.notes = notes;
      item.verifiedBy = completed ? user.id : undefined;
      item.verifiedAt = completed ? now : undefined;
      saveLocalChecklist(local);
      await auditService.log('CHECKLIST_VISITA_ACTUALIZADO', 'official_visit_checklist', String(id), user, {
        title: item.title,
        completed,
      });
    }
  },

  async getLodgeSettings(): Promise<LodgeSettings> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.from('lodge_settings').select('*').limit(1).single();
        if (!error && data) {
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
            currentVenerableMaster: data.current_venerable_master,
            currentSecretary: data.current_secretary,
            privacyPolicyUrl: data.privacy_policy_url,
            updatedAt: data.updated_at,
          };
        }
      } catch (e) {
        console.warn('Error en Supabase getLodgeSettings:', e);
      }
    }
    return loadLocalSettings();
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

    if (isSupabaseConfigured()) {
      try {
        await supabase
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
            current_venerable_master: updated.currentVenerableMaster,
            current_secretary: updated.currentSecretary,
            privacy_policy_url: updated.privacyPolicyUrl,
          })
          .eq('id', updated.id);
      } catch (e) {
        console.warn('Error actualizando lodge_settings Supabase:', e);
      }
    }

    saveLocalSettings(updated);
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
