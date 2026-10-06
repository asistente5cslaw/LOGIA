import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { LodgeEvent, EventConflict, MasonicBodyId } from '@/types';
import { auditService } from './auditService';

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
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    let query = supabase.from('events').select('*').is('deleted_at', null);
    if (filterBodyId) query = query.eq('body_id', filterBodyId);
    const { data, error } = await query.order('start_date', { ascending: true });
    if (error) throw error;
    if (data) {
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
    return [];
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
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    const existingEvents = await this.getAllEvents();
    // La UI puede enviar un ID visual provisional (ev-...). Solo es edición
    // si ese ID ya existe en la fuente actual; las altas usan UUID de Supabase.
    const isNew = !event.id || !existingEvents.some((existing) => existing.id === event.id);
    const eventId = isNew ? crypto.randomUUID() : event.id!;
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
    {
      try {
        const payload = {
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
          const { data, error } = await supabase.from('events').insert(payload).select().single();
          if (error) throw error;
          if (data?.id) fullEvent.id = data.id;
        } else {
          const { error } = await supabase.from('events').update(payload).eq('id', fullEvent.id);
          if (error) throw error;
        }

        // Registrar conflictos en event_conflicts
        for (const c of conflicts) {
          const { error } = await supabase.from('event_conflicts').insert({
            event_id_1: fullEvent.id,
            event_id_2: c.id,
            reason: `Conflicto de horario entre '${fullEvent.title}' y '${c.title}'`,
            resolved: Boolean(justification),
            resolved_by: user.id,
            justification,
          });
          if (error) throw error;
        }
      } catch (e) {
        console.error('Error guardando en Supabase events:', e);
        throw new Error(e instanceof Error ? e.message : 'No se pudo guardar la tenida en Supabase.');
      }
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
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    const { error } = await supabase.from('events').update({ status }).eq('id', id);
    if (error) throw error;
    await auditService.log('CAMBIO_ESTADO_EVENTO', 'events', id, user, { newStatus: status });
  },

  async deleteEvent(id: string, user: { id?: string; email?: string }): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    const { data, error } = await supabase
      .from('events')
      .update({ deleted_at: new Date().toISOString(), status: 'cancelada' })
      .eq('id', id)
      .select('title, start_date')
      .maybeSingle();
    if (error) throw error;
    await auditService.log('ELIMINAR_EVENTO', 'events', id, user, {
      title: data?.title,
      startDate: data?.start_date,
    });
  },

  async getUnresolvedConflicts(): Promise<EventConflict[]> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    {
        const { data, error } = await supabase
          .from('event_conflicts')
          .select('*')
          .eq('resolved', false)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data) {
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
      }
    return [];
  },
};
