import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { LodgeEvent, EventConflict, MasonicBodyId } from '@/types';
import { auditService } from './auditService';

const LOCAL_EVENTS_KEY = 'logia_events_data';
const LOCAL_CONFLICTS_KEY = 'logia_event_conflicts';

function seedInitialEvents(): LodgeEvent[] {
  return [];
}

function loadLocalEvents(): LodgeEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalEvents(events: LodgeEvent[]) {
  try {
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(events));
  } catch {
    // ignore
  }
}

function loadLocalConflicts(): EventConflict[] {
  try {
    const raw = localStorage.getItem(LOCAL_CONFLICTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalConflicts(conflicts: EventConflict[]) {
  try {
    localStorage.setItem(LOCAL_CONFLICTS_KEY, JSON.stringify(conflicts));
  } catch {
    // ignore
  }
}

/**
 * Convierte un evento en timestamps para comparar solapamiento exacto
 */
function getEventTimeRange(event: LodgeEvent): { startMs: number; endMs: number } {
  const startStr = `${event.startDate}T${event.isAllDay || !event.startTime ? '00:00:00' : event.startTime + ':00'}`;
  const startMs = new Date(startStr).getTime();

  let endMs: number;
  if (event.endDate) {
    const endStr = `${event.endDate}T${event.isAllDay || !event.endTime ? '23:59:59' : event.endTime + ':00'}`;
    endMs = new Date(endStr).getTime();
  } else if (event.isAllDay || !event.endTime) {
    endMs = new Date(`${event.startDate}T23:59:59`).getTime();
  } else {
    endMs = new Date(`${event.startDate}T${event.endTime}:00`).getTime();
  }

  return { startMs, endMs };
}

export const eventService = {
  async getAllEvents(filterBodyId?: MasonicBodyId): Promise<LodgeEvent[]> {
    if (isSupabaseConfigured()) {
      try {
        let query = supabase.from('events').select('*').is('deleted_at', null);
        if (filterBodyId) {
          query = query.eq('body_id', filterBodyId);
        }
        const { data, error } = await query.order('start_date', { ascending: true });
        if (!error && data) {
          return data.map((d) => ({
            id: d.id,
            title: d.title,
            bodyId: d.body_id,
            degreeRequired: d.degree_required,
            startDate: d.start_date,
            endDate: d.end_date,
            startTime: d.start_time,
            endTime: d.end_time,
            isAllDay: d.is_all_day,
            isMeeting: d.is_meeting,
            location: d.location,
            notes: d.notes,
            status: d.status,
            conflictJustification: d.conflict_justification,
            conflictApprovedBy: d.conflict_approved_by,
            conflictApprovedAt: d.conflict_approved_at,
            createdBy: d.created_by,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
        }
      } catch (e) {
        console.warn('Fallo consulta Supabase events, usando local:', e);
      }
    }

    const local = loadLocalEvents();
    if (!filterBodyId) return local;
    return local.filter((e) => e.bodyId === filterBodyId);
  },

  /**
   * Detecta si un evento colisiona con otros eventos existentes en fecha y hora.
   * Ignora eventos con status 'cancelada'.
   */
  detectConflicts(candidate: LodgeEvent, existingEvents: LodgeEvent[]): LodgeEvent[] {
    if (candidate.status === 'cancelada') return [];

    const candidateRange = getEventTimeRange(candidate);

    return existingEvents.filter((ev) => {
      // Ignorar el mismo evento si es una edición
      if (ev.id === candidate.id) return false;
      // Ignorar eventos cancelados
      if (ev.status === 'cancelada') return false;

      const evRange = getEventTimeRange(ev);

      // Superposición: StartA < EndB && EndA > StartB
      return candidateRange.startMs < evRange.endMs && candidateRange.endMs > evRange.startMs;
    });
  },

  /**
   * Genera fechas alternativas disponibles en los próximos 60 días,
   * priorizando el mismo día de la semana y manteniendo la duración.
   */
  suggestAlternativeDates(
    candidate: LodgeEvent,
    existingEvents: LodgeEvent[],
    maxSuggestions = 4
  ): { startDate: string; endDate?: string; label: string }[] {
    const candidateStartDate = new Date(`${candidate.startDate}T12:00:00`);
    const dayOfWeek = candidateStartDate.getDay(); // 0-6

    // Duración en días si es multi-día
    let durationDays = 0;
    if (candidate.endDate) {
      const startMs = new Date(candidate.startDate).getTime();
      const endMs = new Date(candidate.endDate).getTime();
      durationDays = Math.max(0, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
    }

    const suggestions: { startDate: string; endDate?: string; label: string }[] = [];
    const weekdaysNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    // Buscar en los próximos 60 días
    for (let offset = 1; offset <= 60; offset++) {
      const probeDate = new Date(candidateStartDate);
      probeDate.setDate(probeDate.getDate() + offset);

      // Priorizar el mismo día de la semana
      if (probeDate.getDay() !== dayOfWeek && suggestions.length < 2) {
        // En los primeros intentos buscar exclusivamente el mismo día de la semana
        continue;
      }

      const y = probeDate.getFullYear();
      const m = String(probeDate.getMonth() + 1).padStart(2, '0');
      const d = String(probeDate.getDate()).padStart(2, '0');
      const startStr = `${y}-${m}-${d}`;

      let endStr: string | undefined = undefined;
      if (durationDays > 0) {
        const probeEndDate = new Date(probeDate);
        probeEndDate.setDate(probeEndDate.getDate() + durationDays);
        const ey = probeEndDate.getFullYear();
        const em = String(probeEndDate.getMonth() + 1).padStart(2, '0');
        const ed = String(probeEndDate.getDate()).padStart(2, '0');
        endStr = `${ey}-${em}-${ed}`;
      }

      const hypothetical: LodgeEvent = {
        ...candidate,
        id: 'hypothetical',
        startDate: startStr,
        endDate: endStr,
      };

      const clashes = this.detectConflicts(hypothetical, existingEvents);
      if (clashes.length === 0) {
        const dayName = weekdaysNames[probeDate.getDay()];
        suggestions.push({
          startDate: startStr,
          endDate: endStr,
          label: `${dayName} ${d}/${m}/${y}`,
        });
        if (suggestions.length >= maxSuggestions) break;
      }
    }

    return suggestions;
  },

  async saveEvent(
    event: Omit<LodgeEvent, 'id' | 'createdAt'> & { id?: string },
    user: { id?: string; email?: string; name?: string },
    justification?: string
  ): Promise<{ savedEvent: LodgeEvent; conflicts: LodgeEvent[] }> {
    const existingEvents = await this.getAllEvents();
    const isNew = !event.id;
    const eventId = event.id || `ev-${Date.now()}`;
    const now = new Date().toISOString();

    const fullEvent: LodgeEvent = {
      ...event,
      id: eventId,
      createdAt: now,
      updatedAt: now,
      createdByName: event.createdByName || user.name || user.email || 'Secretaría',
      conflictJustification: justification || event.conflictJustification,
      conflictApprovedBy: justification ? user.id : event.conflictApprovedBy,
      conflictApprovedAt: justification ? now : event.conflictApprovedAt,
    };

    // Validar conflictos
    const conflicts = this.detectConflicts(fullEvent, existingEvents);

    // Si existen conflictos y no se aportó justificación, reportamos conflicto sin guardar o para decisión
    if (isSupabaseConfigured()) {
      try {
        const payload = {
          id: fullEvent.id,
          title: fullEvent.title,
          body_id: fullEvent.bodyId,
          degree_required: fullEvent.degreeRequired,
          start_date: fullEvent.startDate,
          end_date: fullEvent.endDate,
          start_time: fullEvent.startTime,
          end_time: fullEvent.endTime,
          is_all_day: fullEvent.isAllDay,
          is_meeting: fullEvent.isMeeting,
          location: fullEvent.location,
          notes: fullEvent.notes,
          status: fullEvent.status,
          conflict_justification: fullEvent.conflictJustification,
          conflict_approved_by: fullEvent.conflictApprovedBy,
          conflict_approved_at: fullEvent.conflictApprovedAt,
        };

        if (isNew) {
          await supabase.from('events').insert(payload);
        } else {
          await supabase.from('events').update(payload).eq('id', fullEvent.id);
        }

        // Registrar conflictos en event_conflicts
        for (const c of conflicts) {
          await supabase.from('event_conflicts').insert({
            event_id_1: fullEvent.id,
            event_id_2: c.id,
            reason: `Conflicto de horario entre '${fullEvent.title}' y '${c.title}'`,
            resolved: Boolean(justification),
            resolved_by: user.id,
            justification,
          });
        }
      } catch (e) {
        console.warn('Error guardando en Supabase events:', e);
      }
    }

    // Actualizar local
    const local = loadLocalEvents();
    const idx = local.findIndex((e) => e.id === fullEvent.id);
    if (idx >= 0) {
      local[idx] = fullEvent;
    } else {
      local.push(fullEvent);
    }
    saveLocalEvents(local);

    if (conflicts.length > 0) {
      const localConflicts = loadLocalConflicts();
      for (const c of conflicts) {
        localConflicts.push({
          id: `conf-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          eventId1: fullEvent.id,
          eventId2: c.id,
          reason: `Superposición horaria con '${c.title}'`,
          resolved: Boolean(justification),
          resolvedBy: user.id,
          resolvedAt: justification ? now : undefined,
          justification,
          createdAt: now,
        });
      }
      saveLocalConflicts(localConflicts);
    }

    await auditService.log(
      isNew ? 'CREAR_EVENTO' : 'ACTUALIZAR_EVENTO',
      'events',
      fullEvent.id,
      user,
      {
        title: fullEvent.title,
        startDate: fullEvent.startDate,
        hadConflicts: conflicts.length > 0,
        conflictJustification: justification,
      }
    );

    return { savedEvent: fullEvent, conflicts };
  },

  async updateEventStatus(
    id: string,
    status: LodgeEvent['status'],
    user: { id?: string; email?: string }
  ): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('events').update({ status }).eq('id', id);
      } catch (e) {
        console.warn('Error actualizando status en Supabase:', e);
      }
    }
    const local = loadLocalEvents();
    const target = local.find((e) => e.id === id);
    if (target) {
      target.status = status;
      target.updatedAt = new Date().toISOString();
      saveLocalEvents(local);
      await auditService.log('CAMBIO_ESTADO_EVENTO', 'events', id, user, { newStatus: status });
    }
  },

  async deleteEvent(id: string, user: { id?: string; email?: string }): Promise<void> {
    const local = loadLocalEvents();
    const target = local.find((e) => e.id === id);

    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString(), status: 'cancelada' })
          .eq('id', id);
      } catch (e) {
        console.warn('Error eliminando evento en Supabase:', e);
      }
    }

    const filtered = local.filter((e) => e.id !== id);
    saveLocalEvents(filtered);

    if (target) {
      await auditService.log('ELIMINAR_EVENTO', 'events', id, user, {
        title: target.title,
        startDate: target.startDate,
      });
    }
  },

  async getUnresolvedConflicts(): Promise<EventConflict[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('event_conflicts')
          .select('*')
          .eq('resolved', false)
          .order('created_at', { ascending: false });
        if (!error && data) {
          return data.map((d) => ({
            id: d.id,
            eventId1: d.event_id_1,
            eventId2: d.event_id_2,
            reason: d.reason,
            resolved: d.resolved,
            resolvedBy: d.resolved_by,
            resolvedAt: d.resolved_at,
            justification: d.justification,
            createdAt: d.created_at,
          }));
        }
      } catch (e) {
        console.warn('Error leyendo conflictos Supabase:', e);
      }
    }

    return loadLocalConflicts().filter((c) => !c.resolved);
  },
};
