import { memberService } from './memberService';
import { eventService } from './eventService';
import { minuteService } from './minuteService';
import { officialVisitService } from './officialVisitService';
import { auditService } from './auditService';
import type { Member, LodgeEvent, Minute, LodgeSettings, OfficialVisitChecklistItem } from '@/types';

export interface BackupData {
  version: string;
  exportedAt: string;
  lodgeSettings: LodgeSettings;
  members: Member[];
  events: LodgeEvent[];
  minutes: Minute[];
  checklist: OfficialVisitChecklistItem[];
}

export interface ImportPreview {
  valid: boolean;
  errors: string[];
  membersCount: number;
  eventsCount: number;
  minutesCount: number;
  newMembers: number;
  duplicateMembers: number;
  parsedData?: BackupData;
}

export const backupService = {
  async generateFullJsonBackup(user: { id?: string; email?: string }): Promise<string> {
    const [members, events, minutes, lodgeSettings, checklist] = await Promise.all([
      memberService.getAllMembers(true),
      eventService.getAllEvents(),
      minuteService.getAllMinutes(),
      officialVisitService.getLodgeSettings(),
      officialVisitService.getChecklist(),
    ]);

    const backup: BackupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      lodgeSettings,
      members,
      events,
      minutes,
      checklist,
    };

    await auditService.log('EXPORTACION_RESPALDO_COMPLETO_JSON', 'system', undefined, user, {
      membersCount: members.length,
      eventsCount: events.length,
      minutesCount: minutes.length,
    });

    return JSON.stringify(backup, null, 2);
  },

  async exportMinutesCSV(): Promise<string> {
    const minutes = await minuteService.getAllMinutes();
    const headers = [
      'Numero',
      'Ano',
      'Formato',
      'Titulo',
      'Fecha Tenida',
      'Grado',
      'Estado',
      'Tomo',
      'Folio',
      'Descripcion',
    ];

    const rows = minutes.map((m) => [
      m.number,
      m.year,
      `"${m.formatNumber}"`,
      `"${m.title.replace(/"/g, '""')}"`,
      m.meetingDate,
      m.degree,
      m.status,
      `"${m.volume || ''}"`,
      `"${m.folio || ''}"`,
      `"${m.description.replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  },

  async previewImportJson(jsonText: string): Promise<ImportPreview> {
    try {
      const data = JSON.parse(jsonText);
      const errors: string[] = [];

      if (!data.version) {
        errors.push('El archivo no posee atributo de versión de esquema.');
      }
      if (!Array.isArray(data.members)) {
        errors.push('El archivo no contiene un arreglo válido de miembros.');
      }
      if (!Array.isArray(data.events)) {
        errors.push('El archivo no contiene un arreglo válido de eventos.');
      }
      if (!Array.isArray(data.minutes)) {
        errors.push('El archivo no contiene un arreglo válido de actas.');
      }

      if (errors.length > 0) {
        return {
          valid: false,
          errors,
          membersCount: 0,
          eventsCount: 0,
          minutesCount: 0,
          newMembers: 0,
          duplicateMembers: 0,
        };
      }

      // Comparar duplicados de miembros con los actuales
      const currentMembers = await memberService.getAllMembers(true);
      const currentEmails = new Set(currentMembers.map((m) => m.email.toLowerCase()));

      let duplicateMembers = 0;
      let newMembers = 0;

      for (const m of data.members as Member[]) {
        if (m.email && currentEmails.has(m.email.toLowerCase())) {
          duplicateMembers++;
        } else {
          newMembers++;
        }
      }

      return {
        valid: true,
        errors: [],
        membersCount: (data.members as Member[]).length,
        eventsCount: (data.events as LodgeEvent[]).length,
        minutesCount: (data.minutes as Minute[]).length,
        newMembers,
        duplicateMembers,
        parsedData: data as BackupData,
      };
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      return {
        valid: false,
        errors: [`Error de sintaxis JSON: ${errorMsg}`],
        membersCount: 0,
        eventsCount: 0,
        minutesCount: 0,
        newMembers: 0,
        duplicateMembers: 0,
      };
    }
  },

  async applyImportBackup(
    backup: BackupData,
    overwriteDuplicates: boolean,
    user: { id?: string; email?: string }
  ): Promise<{ importedMembers: number; importedEvents: number; importedMinutes: number }> {
    const currentMembers = await memberService.getAllMembers(true);
    const existingEmails = new Set(currentMembers.map((m) => m.email.toLowerCase()));

    let importedMembers = 0;
    for (const m of backup.members) {
      const exists = existingEmails.has(m.email.toLowerCase());
      if (!exists || overwriteDuplicates) {
        await memberService.saveMember(m, user);
        importedMembers++;
      }
    }

    let importedEvents = 0;
    for (const ev of backup.events) {
      await eventService.saveEvent(ev, user);
      importedEvents++;
    }

    let importedMinutes = 0;
    for (const min of backup.minutes) {
      await minuteService.saveMinute(min, user);
      importedMinutes++;
    }

    if (backup.lodgeSettings) {
      await officialVisitService.updateLodgeSettings(backup.lodgeSettings, user);
    }

    await auditService.log('RESTAURACION_RESPALDO_JSON', 'system', undefined, user, {
      importedMembers,
      importedEvents,
      importedMinutes,
      overwriteDuplicates,
    });

    return { importedMembers, importedEvents, importedMinutes };
  },
};
