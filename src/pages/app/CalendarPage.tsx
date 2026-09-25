import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { eventService } from '@/services/eventService';
import { memberService } from '@/services/memberService';
import { convocationService } from '@/services/convocationService';
import { masonicBodies, getBodyById } from '@/data/bodiesData';
import { PageHeader } from '@/components/shared/PageHeader';
import type { LodgeEvent, MasonicBodyId, MasonicDegree, EventStatus, Member } from '@/types';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  AlertTriangle,
  Send,
  Copy,
  Check,
  Share2,
  Mail,
  X,
  FileEdit,
  Filter,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { AppleEmoji } from '@/components/shared/AppleEmoji';
import { AppleSelect, type AppleSelectOption } from '@/components/shared/AppleSelect';
import { AppleDatePicker } from '@/components/shared/AppleDatePicker';
import { AppleTimePicker } from '@/components/shared/AppleTimePicker';
import { AppleInput, AppleTextarea } from '@/components/shared/AppleInput';
import { GoogleMapsLocationPicker } from '@/components/shared/GoogleMapsLocationPicker';
import { pushNotificationService } from '@/services/pushNotificationService';
import { useAppleDialog } from '@/components/shared/AppleDialog';
import { Modal } from '@/components/shared/Modal';
import { cn } from '@/lib/utils';
import { formatDateSpanish, formatTime12, formatTimeRange12 } from '@/lib/dateUtils';
import { toast } from 'sonner';

export function CalendarPage() {
  const { user, hasPermission } = useAuth();
  const { showConfirm } = useAppleDialog();
  const [events, setEvents] = useState<LodgeEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedBodyFilter, setSelectedBodyFilter] = useState<MasonicBodyId | 'all'>('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const bodyEventCounts = useMemo(() => {
    const counts: Record<string, number> = { all: events.length };
    masonicBodies.forEach((b) => {
      counts[b.id] = events.filter((e) => e.bodyId === b.id).length;
    });
    return counts;
  }, [events]);

  const selectedBody = useMemo(() => {
    if (selectedBodyFilter === 'all') return null;
    return getBodyById(selectedBodyFilter);
  }, [selectedBodyFilter]);

  // Modales
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<LodgeEvent | null>(null);
  const [showMobileDayModal, setShowMobileDayModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [pendingCandidate, setPendingCandidate] = useState<LodgeEvent | null>(null);
  const [detectedClashes, setDetectedClashes] = useState<LodgeEvent[]>([]);
  const [alternativeDates, setAlternativeDates] = useState<{ startDate: string; endDate?: string; label: string }[]>([]);
  const [conflictJustification, setConflictJustification] = useState('');

  // Modal de Convocatoria
  const [showConvocationModal, setShowConvocationModal] = useState(false);
  const [convocationEvent, setConvocationEvent] = useState<LodgeEvent | null>(null);
  const [convocationText, setConvocationText] = useState('');
  const [copied, setCopied] = useState(false);

  // Formulario nuevo evento
  const [formTitle, setFormTitle] = useState('');
  const [formBodyId, setFormBodyId] = useState<MasonicBodyId>('uf21');
  const [formDegree, setFormDegree] = useState<MasonicDegree>('aprendiz');
  const [formStartDate, setFormStartDate] = useState(selectedDateStr);
  const [formEndDate, setFormEndDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('19:30');
  const [formEndTime, setFormEndTime] = useState('21:30');
  const [formIsAllDay, setFormIsAllDay] = useState(false);
  const [formIsMeeting, setFormIsMeeting] = useState(true);
  const [formLocation, setFormLocation] = useState('Gran Templo Masónico, Calle 43 Bella Vista');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<EventStatus>('programada');

  const canManageEvents = hasPermission('manage_events');

  const loadData = async () => {
    try {
      const [evList, memList] = await Promise.all([
        eventService.getAllEvents(),
        memberService.getAllMembers(true),
      ]);
      setEvents(evList);
      setMembers(memList);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar calendario');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtrado de eventos
  const filteredEvents = useMemo(() => {
    if (selectedBodyFilter === 'all') return events;
    return events.filter((e) => e.bodyId === selectedBodyFilter);
  }, [events, selectedBodyFilter]);

  // Navegación mensual
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  // Construcción de la matriz mensual
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Domingo

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  // Eventos del día seleccionado
  const selectedDayEvents = useMemo(() => {
    return filteredEvents.filter((ev) => {
      if (ev.startDate === selectedDateStr) return true;
      if (ev.endDate && selectedDateStr >= ev.startDate && selectedDateStr <= ev.endDate) return true;
      return false;
    });
  }, [filteredEvents, selectedDateStr]);

  const openNewEventModal = () => {
    setEditingEvent(null);
    setFormTitle('');
    setFormBodyId('uf21');
    setFormDegree('aprendiz');
    setFormStartDate(selectedDateStr);
    setFormEndDate('');
    setFormStartTime('19:30');
    setFormEndTime('21:30');
    setFormIsAllDay(false);
    setFormIsMeeting(true);
    setFormLocation('Gran Templo Masónico, Calle 43 Bella Vista');
    setFormNotes('');
    setFormStatus('programada');
    setShowEventModal(true);
  };

  const openEditEventModal = (ev: LodgeEvent) => {
    setEditingEvent(ev);
    setFormTitle(ev.title);
    setFormBodyId(ev.bodyId);
    setFormDegree(ev.degreeRequired);
    setFormStartDate(ev.startDate);
    setFormEndDate(ev.endDate || '');
    setFormStartTime(ev.startTime || '19:30');
    setFormEndTime(ev.endTime || '21:30');
    setFormIsAllDay(ev.isAllDay);
    setFormIsMeeting(ev.isMeeting);
    setFormLocation(ev.location);
    setFormNotes(ev.notes || '');
    setFormStatus(ev.status);
    setShowEventModal(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    const candidate: LodgeEvent = {
      id: editingEvent ? editingEvent.id : `ev-${Date.now()}`,
      title: formTitle.trim(),
      bodyId: formBodyId,
      degreeRequired: formDegree,
      startDate: formStartDate,
      endDate: formEndDate ? formEndDate : undefined,
      startTime: formIsAllDay ? undefined : formStartTime,
      endTime: formIsAllDay ? undefined : formEndTime,
      isAllDay: formIsAllDay,
      isMeeting: formIsMeeting,
      location: formLocation.trim(),
      notes: formNotes.trim(),
      status: formStatus,
      createdBy: editingEvent ? editingEvent.createdBy : (user?.id || 'admin'),
      createdAt: editingEvent ? editingEvent.createdAt : new Date().toISOString(),
    };

    // Validar conflictos de horario
    const clashes = eventService.detectConflicts(candidate, events);

    if (clashes.length > 0) {
      setPendingCandidate(candidate);
      setDetectedClashes(clashes);
      const suggestions = eventService.suggestAlternativeDates(candidate, events);
      setAlternativeDates(suggestions);
      setConflictJustification('');
      setShowEventModal(false);
      setShowConflictModal(true);
      return;
    }

    try {
      await eventService.saveEvent(candidate, { id: user?.id, email: user?.email, name: user?.displayName });
      toast.success(editingEvent ? 'Evento actualizado exitosamente' : 'Tenida agendada exitosamente');
      setShowEventModal(false);
      loadData();
    } catch {
      toast.error('Error al guardar el evento');
    }
  };

  const handleForceSaveConflict = async () => {
    if (!pendingCandidate) return;
    if (!conflictJustification.trim()) {
      toast.error('Ingresa una justificación protocolar para guardar con conflicto.');
      return;
    }

    try {
      await eventService.saveEvent(
        pendingCandidate,
        { id: user?.id, email: user?.email, name: user?.displayName },
        conflictJustification.trim()
      );
      toast.warning('Evento guardado con conflicto registrado en auditoría.');
      setShowConflictModal(false);
      setPendingCandidate(null);
      loadData();
    } catch {
      toast.error('Error al procesar el conflicto');
    }
  };

  const handleApplyAlternativeDate = (alt: { startDate: string; endDate?: string }) => {
    if (!pendingCandidate) return;
    setFormStartDate(alt.startDate);
    setFormEndDate(alt.endDate || '');
    setShowConflictModal(false);
    setShowEventModal(true);
    toast.info(`Fecha alternativa seleccionada: ${alt.startDate}`);
  };

  const handleDeleteEvent = async (eventId: string, title: string) => {
    const confirmed = await showConfirm({
      title: 'Eliminar Tenida / Actividad',
      message: `¿Confirmas que deseas eliminar la tenida "${title}"? Esta acción cancelará la actividad en el calendario.`,
      confirmText: 'Eliminar Tenida',
      cancelText: 'Cancelar',
      type: 'warning',
    });
    if (!confirmed) return;

    try {
      await eventService.deleteEvent(eventId, { id: user?.id, email: user?.email });
      toast.success('Tenida eliminada exitosamente');
      setShowEventModal(false);
      setShowMobileDayModal(false);
      loadData();
    } catch {
      toast.error('Error al eliminar la tenida');
    }
  };

  const openConvocation = (ev: LodgeEvent) => {
    setConvocationEvent(ev);
    const text = convocationService.generateOfficialText(ev);
    setConvocationText(text);
    setCopied(false);
    setShowConvocationModal(true);
  };

  const handleCopyConvocation = () => {
    navigator.clipboard.writeText(convocationText);
    setCopied(true);
    toast.success('Texto protocolar copiado al portapapeles');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendConvocation = async () => {
    if (!convocationEvent) return;
    try {
      await eventService.updateEventStatus(convocationEvent.id, 'convocada', {
        id: user?.id,
        email: user?.email,
      });

      // Enviar notificación push con el escudo oficial
      pushNotificationService.notifyConvocation(
        convocationEvent.title,
        convocationEvent.startDate,
        convocationEvent.startTime || '',
        convocationEvent.location
      ).catch(() => {});

      toast.success("Estado de la tenida actualizado a 'Convocada'");
      setShowConvocationModal(false);
      loadData();
    } catch {
      toast.error('Error al actualizar estado');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 pt-2.5 pb-6 sm:py-6 md:px-8 max-w-7xl mx-auto">
      {/* Cabecera y Barra de Control Simplificada (Estilo Apple) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <PageHeader
          title="Calendario Masónico"
          subtitle="Tenidas y actividades de los cuerpos fraternales"
        />

        <div className="flex w-full sm:w-auto items-center gap-2">
          {/* Selector y Filtro de Cuerpos estilo Apple (Compacto) */}
          <div className="relative flex-1 min-w-0 sm:flex-initial">
            <button
              type="button"
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className={cn(
                "w-full sm:w-auto flex min-h-[40px] items-center justify-between sm:justify-start gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-xs transition-all cursor-pointer",
                selectedBody
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-surface text-ink hover:bg-surface-container"
              )}
            >
              <div className="flex items-center gap-2 min-w-0 truncate">
                <AppleEmoji name={selectedBody ? selectedBody.appleEmoji : 'globe'} size={18} />
                <span className="font-serif text-xs font-bold text-ink truncate">
                  {selectedBody ? selectedBody.shortName : 'Todos los Cuerpos'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[10px] font-mono text-ink-muted">
                  {selectedBody ? (bodyEventCounts[selectedBody.id] || 0) : events.length}
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-ink-muted transition-transform shrink-0", isFilterDropdownOpen && "rotate-180")} />
              </div>
            </button>

            {/* Menú flotante estilo Apple con todos los cuerpos masónicos */}
            {isFilterDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsFilterDropdownOpen(false)}
                />
                <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 z-40 w-72 sm:w-80 rounded-2xl border border-border bg-surface p-2 shadow-2xl animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted flex items-center justify-between">
                    <span>Jurisdicción</span>
                    <span className="text-[10px] lowercase font-normal">mostrar en calendario</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBodyFilter('all');
                      setIsFilterDropdownOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs transition-colors cursor-pointer text-left mt-1",
                      selectedBodyFilter === 'all'
                        ? "bg-primary/10 text-primary font-bold"
                        : "text-ink hover:bg-surface-container"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <AppleEmoji name="globe" size={20} />
                      <div>
                        <div className="font-semibold">Todos los Cuerpos</div>
                        <div className="text-[10px] text-ink-muted">Vista combinada de actividades</div>
                      </div>
                    </div>
                    <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-mono text-ink-muted">
                      {events.length}
                    </span>
                  </button>

                  <div className="my-1.5 border-t border-border" />

                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {masonicBodies.map((body) => {
                      const count = bodyEventCounts[body.id] || 0;
                      const isSelected = selectedBodyFilter === body.id;
                      return (
                        <button
                          key={body.id}
                          type="button"
                          onClick={() => {
                            setSelectedBodyFilter(body.id);
                            setIsFilterDropdownOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs transition-colors cursor-pointer text-left",
                            isSelected
                              ? "bg-primary/10 text-primary font-bold"
                              : "text-ink hover:bg-surface-container"
                          )}
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <AppleEmoji name={body.appleEmoji} size={20} />
                            <div className="truncate">
                              <div className="font-semibold truncate flex items-center gap-1.5">
                                <span
                                  className="inline-block h-2 w-2 rounded-full shrink-0"
                                  style={{ backgroundColor: body.color }}
                                />
                                {body.shortName}
                              </div>
                              <div className="text-[10px] text-ink-muted truncate max-w-[180px]">
                                {body.description}
                              </div>
                            </div>
                          </div>
                          <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-mono text-ink-muted shrink-0">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Botón rápido para remover filtro si no es 'all' */}
          {selectedBody && (
            <button
              type="button"
              onClick={() => setSelectedBodyFilter('all')}
              className="flex h-10 items-center justify-center gap-1 rounded-xl bg-surface-container-high px-2.5 text-xs font-medium text-ink-secondary hover:bg-surface-container-highest transition-colors cursor-pointer shrink-0"
              title="Mostrar todos los cuerpos"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Quitar</span>
            </button>
          )}

          {canManageEvents && (
            <button
              onClick={openNewEventModal}
              className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-primary px-3 sm:px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-pressed transition-colors shrink-0 whitespace-nowrap cursor-pointer active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Agendar</span>
              <span className="hidden xs:inline">Tenida</span>
            </button>
          )}
        </div>
      </div>

      {/* Contenedor Cuadrícula de Calendario y Detalle Diario */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Vista Mensual Responsive */}
        <div className="rounded-xl border border-border bg-surface p-4 sm:p-6 shadow-card lg:col-span-2">
          {/* Cabecera del mes y controles */}
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              {monthNames[month]} {year}
            </h2>

            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                aria-label="Mes anterior"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border hover:bg-surface-container text-ink transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={nextMonth}
                aria-label="Mes siguiente"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border hover:bg-surface-container text-ink transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Días de la semana */}
          <div className="mt-4 grid grid-cols-7 text-center text-xs font-semibold text-ink-muted">
            <span>Dom</span>
            <span>Lun</span>
            <span>Mar</span>
            <span>Mié</span>
            <span>Jue</span>
            <span>Vie</span>
            <span>Sáb</span>
          </div>

          {/* Celdas del mes */}
          <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
            {/* Espacios vacíos antes del primer día */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[64px] sm:min-h-[88px] rounded-lg bg-surface-container-low/40 border border-transparent" />
            ))}

            {/* Días del mes */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isSelected = dateStr === selectedDateStr;
              const dayEvents = filteredEvents.filter((ev) => {
                if (ev.startDate === dateStr) return true;
                if (ev.endDate && dateStr >= ev.startDate && dateStr <= ev.endDate) return true;
                return false;
              });
              const hasEvents = dayEvents.length > 0;

              return (
                <div
                  key={dateStr}
                  onClick={() => {
                    setSelectedDateStr(dateStr);
                    if (window.innerWidth < 1024) {
                      setShowMobileDayModal(true);
                    }
                  }}
                  className={cn(
                    'min-h-[58px] sm:min-h-[84px] rounded-xl p-1.5 sm:p-2 cursor-pointer border transition-all flex flex-col justify-between select-none active:scale-[0.98]',
                    hasEvents
                      ? 'bg-primary/10 border-primary/40 shadow-2xs hover:bg-primary/15'
                      : 'border-border/70 bg-white hover:bg-surface-container-low',
                    isSelected && (hasEvents ? 'ring-2 ring-primary ring-offset-2 border-primary' : 'ring-2 ring-border ring-offset-1')
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'text-xs rounded-full h-6 w-6 sm:h-7 sm:w-7 flex items-center justify-center transition-colors',
                        hasEvents
                          ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                          : isSelected
                          ? 'bg-surface-container-high text-ink font-semibold'
                          : 'text-ink-secondary'
                      )}
                    >
                      {dayNum}
                    </span>
                  </div>

                  {/* Punto elegante de evento estilo Apple (móvil y escritorio) */}
                  {hasEvents && (
                    <div className="flex justify-center py-1 sm:py-2">
                      <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-primary" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Detalle Diario en escritorio */}
        <div className="hidden lg:flex rounded-xl border border-border bg-surface p-5 shadow-card flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-ink">Trabajos del Día</h3>
                <p className="text-xs text-ink-secondary">{formatDateSpanish(selectedDateStr)}</p>
              </div>
              <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-xs font-semibold text-primary">
                {selectedDayEvents.length} actividad(es)
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {selectedDayEvents.length === 0 ? (
                <div className="py-12 text-center text-ink-muted text-xs">
                  No hay tenidas agendadas para esta fecha.
                  {canManageEvents && (
                    <button
                      onClick={openNewEventModal}
                      className="mt-3 block mx-auto text-xs text-primary font-medium hover:underline"
                    >
                      + Agendar una actividad aquí
                    </button>
                  )}
                </div>
              ) : (
                selectedDayEvents.map((ev) => {
                  const body = getBodyById(ev.bodyId);
                  return (
                    <div
                      key={ev.id}
                      className="rounded-lg border border-border p-4 bg-surface-container-low/50 space-y-2 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AppleEmoji name={body.appleEmoji} size={22} className="shrink-0" />
                          <span className="text-xs font-bold text-ink-secondary uppercase tracking-wider">
                            {body.shortName}
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            ev.status === 'convocada'
                              ? 'bg-primary text-primary-foreground'
                              : ev.status === 'celebrada'
                              ? 'bg-success text-white'
                              : ev.status === 'cancelada'
                              ? 'bg-destructive/15 text-destructive'
                              : 'bg-surface-container text-ink'
                          }`}
                        >
                          {ev.status}
                        </span>
                      </div>

                      <h4 className="font-serif text-sm font-bold text-ink leading-snug">{ev.title}</h4>

                      <div className="text-xs text-ink-secondary space-y-1">
                        <p className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-gold" />
                          {ev.isAllDay ? 'Día completo' : formatTimeRange12(ev.startTime, ev.endTime)}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          {ev.location}
                        </p>
                        {ev.notes && <p className="italic text-ink-muted text-[11px]">«{ev.notes}»</p>}
                      </div>

                      {/* Botones de acción del evento */}
                      <div className="mt-3 pt-2 border-t border-border flex flex-wrap gap-2">
                        {canManageEvents && (
                          <button
                            onClick={() => openConvocation(ev)}
                            className="flex items-center gap-1 rounded bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                          >
                            <Send className="h-3.5 w-3.5" /> Convocatoria
                          </button>
                        )}
                        {canManageEvents && (
                          <button
                            onClick={() => openEditEventModal(ev)}
                            className="flex items-center gap-1 rounded border border-border px-2.5 py-1 text-xs font-medium text-ink-secondary hover:bg-surface-container transition-colors"
                          >
                            <FileEdit className="h-3.5 w-3.5" /> Editar
                          </button>
                        )}
                        {canManageEvents && (
                          <button
                            onClick={() => handleDeleteEvent(ev.id, ev.title)}
                            className="flex items-center gap-1 rounded border border-border px-2.5 py-1 text-xs font-medium text-ink-muted hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Eliminar tenida"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Móvil de Trabajos del Día */}
      <Modal
        isOpen={showMobileDayModal}
        onClose={() => setShowMobileDayModal(false)}
        title="Trabajos del Día"
        subtitle={formatDateSpanish(selectedDateStr)}
        maxWidth="md"
      >
        <div className="space-y-3 py-1">
          {selectedDayEvents.length === 0 ? (
            <div className="py-8 text-center text-ink-muted text-xs space-y-3">
              <AppleEmoji name="temple" size={32} className="mx-auto" />
              <p className="font-medium text-ink">No hay tenidas agendadas para esta fecha.</p>
              <p className="text-[11px] text-ink-muted">El taller se encuentra a cubierto en este día.</p>
              {canManageEvents && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileDayModal(false);
                    openNewEventModal();
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-pressed transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Agendar actividad aquí</span>
                </button>
              )}
            </div>
          ) : (
            selectedDayEvents.map((ev) => {
              const body = getBodyById(ev.bodyId);
              return (
                <div
                  key={ev.id}
                  className="rounded-2xl border border-border p-4 bg-surface-container-low/40 space-y-2.5 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AppleEmoji name={body.appleEmoji} size={22} className="shrink-0" />
                      <span className="text-xs font-bold text-ink-secondary uppercase tracking-wider">
                        {body.shortName}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase',
                        ev.status === 'convocada'
                          ? 'bg-primary text-primary-foreground'
                          : ev.status === 'celebrada'
                          ? 'bg-success text-white'
                          : ev.status === 'cancelada'
                          ? 'bg-destructive/15 text-destructive'
                          : 'bg-surface-container text-ink'
                      )}
                    >
                      {ev.status}
                    </span>
                  </div>

                  <h4 className="font-serif text-base font-bold text-ink leading-snug">{ev.title}</h4>

                  <div className="text-xs text-ink-secondary space-y-1.5 pt-1">
                    <p className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{ev.isAllDay ? 'Día completo' : formatTimeRange12(ev.startTime, ev.endTime)}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">{ev.location}</span>
                    </p>
                    {ev.notes && <p className="italic text-ink-muted text-xs pl-5">«{ev.notes}»</p>}
                  </div>

                  {/* Botones de acción del evento */}
                  <div className="mt-3 pt-2.5 border-t border-border flex flex-wrap gap-2">
                    {canManageEvents && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMobileDayModal(false);
                          openConvocation(ev);
                        }}
                        className="flex flex-row items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                      >
                        <Send className="h-3.5 w-3.5 shrink-0" />
                        <span>Convocatoria</span>
                      </button>
                    )}
                    {canManageEvents && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMobileDayModal(false);
                          openEditEventModal(ev);
                        }}
                        className="flex flex-row items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-surface-container transition-colors cursor-pointer"
                      >
                        <FileEdit className="h-3.5 w-3.5 shrink-0" />
                        <span>Editar</span>
                      </button>
                    )}
                    {canManageEvents && (
                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(ev.id, ev.title)}
                        className="flex flex-row items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        title="Eliminar tenida"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" />
                        <span>Eliminar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setShowMobileDayModal(false)}
              className="min-h-[38px] px-4 rounded-xl border border-border bg-white text-xs font-semibold text-ink hover:bg-surface-container transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Nuevo / Editar Evento */}
      <Modal
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
        title={editingEvent ? 'Modificar Tenida' : 'Agendar Nueva Tenida'}
        subtitle="Completa los datos de la actividad masónica en el templo"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveEvent} noValidate className="space-y-4">
          <AppleInput
            label="Título de la Actividad Masónica *"
            required
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Ej. Tenida Ordinaria de Primer Grado y Recepción"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <AppleSelect<MasonicBodyId>
              label="Cuerpo Masónico *"
              value={formBodyId}
              onChange={setFormBodyId}
              options={masonicBodies.map((b) => ({
                value: b.id,
                label: b.shortName,
                description: b.name,
                color: b.color,
                icon: <AppleEmoji name={b.appleEmoji} size={18} />,
              }))}
            />

            <AppleSelect<MasonicDegree>
              label="Grado Requerido *"
              value={formDegree}
              onChange={setFormDegree}
              options={[
                { value: 'aprendiz', label: 'Primer Grado (Aprendiz)', icon: <AppleEmoji name="ruler" size={16} /> },
                { value: 'companero', label: 'Segundo Grado (Compañero)', icon: <AppleEmoji name="cross" size={16} /> },
                { value: 'maestro', label: 'Tercer Grado (Maestro)', icon: <AppleEmoji name="temple" size={16} /> },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <AppleDatePicker
              label="Fecha de Inicio"
              required
              value={formStartDate}
              onChange={(val) => setFormStartDate(val)}
            />

            <AppleDatePicker
              label="Fecha de Finalización (opcional)"
              value={formEndDate}
              onChange={(val) => setFormEndDate(val)}
            />
          </div>

          <div className="flex items-center gap-6 py-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-ink select-none">
              <input
                type="checkbox"
                checked={formIsAllDay}
                onChange={(e) => setFormIsAllDay(e.target.checked)}
                className="h-4 w-4 rounded-md border-border text-primary focus:ring-primary/20 cursor-pointer"
              />
              Día completo
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-ink select-none">
              <input
                type="checkbox"
                checked={formIsMeeting}
                onChange={(e) => setFormIsMeeting(e.target.checked)}
                className="h-4 w-4 rounded-md border-border text-primary focus:ring-primary/20 cursor-pointer"
              />
              Es Tenida Ritual
            </label>
          </div>

          {!formIsAllDay && (
            <div className="grid grid-cols-2 gap-3.5">
              <AppleTimePicker
                label="Hora de Inicio"
                value={formStartTime}
                onChange={setFormStartTime}
              />
              <AppleTimePicker
                label="Hora de Finalización"
                value={formEndTime}
                onChange={setFormEndTime}
              />
            </div>
          )}

          <GoogleMapsLocationPicker
            label="Lugar del Templo / Encuentro"
            required
            value={formLocation}
            onChange={(val) => setFormLocation(val)}
            placeholder="Buscar templo masónico, dirección o lugar en Panamá..."
          />

          <AppleTextarea
            label="Notas o Instrucciones Protocolares"
            rows={2}
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            placeholder="Traje formal reglamentario oscuro, arreos completos..."
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-border">
            {editingEvent && canManageEvents ? (
              <button
                type="button"
                onClick={() => handleDeleteEvent(editingEvent.id, editingEvent.title)}
                className="w-full sm:w-auto min-h-[44px] px-4 rounded-xl border border-destructive/30 bg-destructive/5 text-xs font-semibold text-destructive hover:bg-destructive/15 transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Trash2 className="h-4 w-4" />
                <span>Eliminar Tenida</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="flex-1 sm:flex-initial min-h-[44px] px-5 rounded-xl border border-border text-xs font-semibold text-ink-secondary hover:bg-surface-container transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 sm:flex-initial min-h-[44px] px-6 rounded-xl bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary-pressed shadow-sm transition-all cursor-pointer"
              >
                Guardar Tenida
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal de Resolución de Conflictos */}
      <Modal
        isOpen={Boolean(showConflictModal && pendingCandidate)}
        onClose={() => setShowConflictModal(false)}
        title="Conflicto de Horario Detectado"
        subtitle="La tenida colisiona con otros eventos en la misma fecha y hora"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-destructive/10 p-3 border border-destructive/20">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-ink-secondary">
              Se detectaron coincidencias en el templo. Revisa los eventos que chocan o selecciona una fecha alternativa sin conflicto.
            </p>
          </div>

          {/* Eventos en conflicto */}
          <div className="rounded-lg bg-surface-container-low border border-border p-3 space-y-2">
            <p className="text-xs font-semibold text-destructive">Eventos en colisión:</p>
            {detectedClashes.map((c) => {
              const b = getBodyById(c.bodyId);
              return (
                <div key={c.id} className="text-xs text-ink flex items-center gap-1.5">
                  <AppleEmoji name={b.appleEmoji} size={14} className="shrink-0" />
                  <span>
                    <strong>{c.title}</strong> ({formatDateSpanish(c.startDate)} a las {formatTime12(c.startTime)}) en {c.location}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Fechas alternativas sugeridas en los próximos 60 días */}
          {alternativeDates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-ink">Fechas alternativas disponibles:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {alternativeDates.map((alt) => (
                  <button
                    key={alt.startDate}
                    type="button"
                    onClick={() => handleApplyAlternativeDate(alt)}
                    className="rounded-lg border border-border bg-surface p-2.5 text-left text-xs font-medium hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-between"
                  >
                    <span>{alt.label}</span>
                    <span className="text-primary text-[10px] font-semibold">Elegir →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Justificación obligatoria para forzar guardado */}
          <div className="border-t border-border pt-3">
            <label className="text-xs font-semibold text-ink block mb-1">
              ¿Guardar de todos modos? Justificación protocolar obligatoria:
            </label>
            <textarea
              rows={2}
              value={conflictJustification}
              onChange={(e) => setConflictJustification(e.target.value)}
              placeholder="Indica el motivo o acuerdo de taller que autoriza la coincidencia horaria..."
              className="w-full rounded-lg border border-border bg-surface p-2.5 text-xs text-ink outline-none focus:border-destructive"
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowConflictModal(false);
                setShowEventModal(true);
              }}
              className="min-h-[44px] px-4 rounded-lg border border-border text-xs font-medium text-ink-secondary hover:bg-surface-container"
            >
              Volver y reprogramar
            </button>
            <button
              type="button"
              onClick={handleForceSaveConflict}
              className="min-h-[44px] px-4 rounded-lg bg-destructive text-xs font-medium text-white hover:bg-destructive/90 shadow-sm"
            >
              Guardar con Conflicto
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Convocatoria Oficial */}
      <Modal
        isOpen={Boolean(showConvocationModal && convocationEvent)}
        onClose={() => setShowConvocationModal(false)}
        title="Convocatoria Protocolar"
        subtitle="Edita el texto solemne antes de la difusión fraternal"
        maxWidth="xl"
      >
        {convocationEvent && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink">Destinatarios por grado:</span>
              <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-gold-dark text-amber-800 font-semibold uppercase">
                {convocationEvent.degreeRequired}
              </span>
            </div>

            <textarea
              rows={9}
              value={convocationText}
              onChange={(e) => setConvocationText(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-container-low p-3 font-mono text-xs text-ink outline-none focus:border-primary leading-relaxed"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyConvocation}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-ink hover:bg-surface-container transition-colors"
                >
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copiado' : 'Copiar texto'}
                </button>

                <a
                  href={convocationService.generateWhatsAppUrl(undefined, convocationText)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                >
                  <Share2 className="h-4 w-4" />
                  WhatsApp
                </a>

                <a
                  href={convocationService.generateMailtoUrl(
                    `Convocatoria: ${convocationEvent.title}`,
                    convocationText,
                    members.filter((m) => m.isActive).map((m) => m.email)
                  )}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-info/30 bg-info/10 px-3 text-xs font-semibold text-info hover:bg-info/20 transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  Correo
                </a>
              </div>

              <button
                type="button"
                onClick={handleSendConvocation}
                className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary-pressed shadow-sm"
              >
                <Send className="h-4 w-4" />
                Marcar Convocada
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
