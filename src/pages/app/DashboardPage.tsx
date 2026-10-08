import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { memberService } from '@/services/memberService';
import { eventService } from '@/services/eventService';
import { minuteService } from '@/services/minuteService';
import { attendanceService } from '@/services/attendanceService';
import { getBodyById } from '@/data/bodiesData';
import type { LodgeEvent, EventConflict } from '@/types';
import {
  Users,
  CalendarDays,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { AppleEmoji } from '@/components/shared/AppleEmoji';
import { formatDateTimeSpanish } from '@/lib/dateUtils';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { toast } from 'sonner';

export function DashboardPage() {
  const { user, userRoleName } = useAuth();
  const [events, setEvents] = useState<LodgeEvent[]>([]);
  const [conflicts, setConflicts] = useState<EventConflict[]>([]);
  const [pendingExcuseEvents, setPendingExcuseEvents] = useState<LodgeEvent[]>([]);
  const [ownMemberId, setOwnMemberId] = useState<string | null>(null);
  const [excuseDrafts, setExcuseDrafts] = useState<Record<string, string>>({});
  const [savingExcuseEventId, setSavingExcuseEventId] = useState<string | null>(null);
  const [homeAttendanceStatus, setHomeAttendanceStatus] = useState<'presente' | 'excusa' | 'ausente' | null>(null);
  const [showHomeExcuse, setShowHomeExcuse] = useState(false);
  const [homeExcuseDraft, setHomeExcuseDraft] = useState('');
  const [savingHomeAttendance, setSavingHomeAttendance] = useState(false);
  const [stats, setStats] = useState({
    activeCount: 0,
    upcomingTenidasCount: 0,
    upcomingReunionsCount: 0,
    approvedMinutesCount: 0,
    attendanceRate: 0,
  });

  const loadDashboardData = async () => {
    try {
      const [memList, evList, minList, conflictList] = await Promise.all([
        memberService.getAllMembers(true),
        eventService.getAllEvents(),
        minuteService.getAllMinutes(),
        eventService.getUnresolvedConflicts(),
      ]);

      setEvents(evList);
      setConflicts(conflictList);

      const today = new Date().toISOString().split('T')[0];
      const upcomingNext = evList
        .filter((event) => event.eventCategory === 'tenida' && event.status !== 'cancelada' && event.startDate >= today)
        .sort((a, b) => `${a.startDate}T${a.startTime || ''}`.localeCompare(`${b.startDate}T${b.startTime || ''}`))
        .find((event) => event.status === 'convocada');

      const ownMemberId = user?.memberId || memList.find(
        (member) => member.email.toLowerCase() === user?.email?.toLowerCase()
      )?.id;
      setOwnMemberId(ownMemberId || null);
      if (ownMemberId) {
        if (upcomingNext?.status === 'convocada') {
          const segmentId = upcomingNext.degreeSegments?.[0]?.id;
          const records = segmentId
            ? await attendanceService.getAttendanceForEvent(upcomingNext.id, segmentId, { memberId: ownMemberId })
            : [];
          const savedStatus = records.find((record) => record.memberId === ownMemberId)?.status;
          setHomeAttendanceStatus(savedStatus === 'presente' || savedStatus === 'excusa' ? savedStatus : null);
        } else {
          setHomeAttendanceStatus(null);
        }
        const pendingExcuses = await attendanceService.getPendingExcusesForMember(ownMemberId);
        const pendingIds = new Set(pendingExcuses.map((item) => item.eventId));
        setPendingExcuseEvents(evList.filter(
          (event) => event.eventCategory === 'tenida' && event.status !== 'cancelada' && pendingIds.has(event.id)
        ));
      } else {
        setPendingExcuseEvents([]);
        setHomeAttendanceStatus(null);
      }

      const activeCount = memList.filter((m) => m.isActive).length;
      const upcomingTenidasCount = evList.filter(
        (e) => e.eventCategory === 'tenida' && e.status !== 'cancelada' && e.startDate >= today
      ).length;
      const upcomingReunionsCount = evList.filter(
        (e) => e.eventCategory !== 'tenida'
          && e.status !== 'cancelada' && e.startDate >= today
      ).length;
      const approvedMinutesCount = minList.filter(
        (m) => m.status === 'aprobada' || m.status === 'firmada'
      ).length;

      const attCalc = attendanceService.calculateStatistics(evList, [], activeCount);
      setStats({
        activeCount,
        upcomingTenidasCount,
        upcomingReunionsCount,
        approvedMinutesCount,
        attendanceRate: attCalc.averageAttendanceRate || 0,
      });
    } catch (e) {
      console.error('Error cargando dashboard:', e);
    }
  };

  useEffect(() => {
    void loadDashboardData();
  }, []);

  useRealtimeRefresh(() => {
    void loadDashboardData();
  });

  const today = new Date().toISOString().split('T')[0];
  const upcomingTenidas = events
    .filter((event) => event.eventCategory === 'tenida' && event.status !== 'cancelada' && event.startDate >= today)
    .sort((a, b) => `${a.startDate}T${a.startTime || ''}`.localeCompare(`${b.startDate}T${b.startTime || ''}`));
  const nextMeeting = upcomingTenidas.find((event) => event.status === 'convocada') || upcomingTenidas[0];
  const nextMeetingBody = nextMeeting ? getBodyById(nextMeeting.bodyId) : null;
  const upcomingActivities = events
    .filter((event) => event.status !== 'cancelada' && event.startDate >= today && event.id !== nextMeeting?.id)
    .sort((a, b) => `${a.startDate}T${a.startTime || ''}`.localeCompare(`${b.startDate}T${b.startTime || ''}`))
    .slice(0, 3);

  const handleSaveDashboardExcuse = async (eventId: string) => {
    const reason = excuseDrafts[eventId]?.trim();
    if (!ownMemberId || !reason) return;

    setSavingExcuseEventId(eventId);
    try {
      const event = events.find((candidate) => candidate.id === eventId);
      const segmentId = event?.degreeSegments?.[0]?.id;
      if (!segmentId) throw new Error('La tenida todavía no tiene un tramo de grado configurado.');
      await attendanceService.saveMemberExcuse(eventId, segmentId, ownMemberId, reason, {
        id: user?.id,
        email: user?.email,
      });
      setPendingExcuseEvents((previous) => previous.filter((event) => event.id !== eventId));
      setExcuseDrafts((previous) => {
        const next = { ...previous };
        delete next[eventId];
        return next;
      });
    } catch (error) {
      console.error('Error guardando excusa desde el inicio:', error);
    } finally {
      setSavingExcuseEventId(null);
    }
  };

  const handleHomeAttendance = async (status: 'presente' | 'excusa') => {
    if (!ownMemberId || !nextMeeting || nextMeeting.status !== 'convocada') return;
    const nextStatus = homeAttendanceStatus === status ? 'ausente' : status;
    setSavingHomeAttendance(true);
    try {
      const segmentId = nextMeeting.degreeSegments?.[0]?.id;
      if (!segmentId) throw new Error('La tenida todavía no tiene un tramo de grado configurado.');
      if (nextStatus === 'ausente') {
        await attendanceService.clearMemberAttendance(nextMeeting.id, segmentId, ownMemberId, {
          id: user?.id,
          email: user?.email,
        });
      } else {
        await attendanceService.saveAttendanceBatch(
          nextMeeting.id,
          segmentId,
          [{ memberId: ownMemberId, status: nextStatus }],
          { id: user?.id, email: user?.email }
        );
      }
      setHomeAttendanceStatus(nextStatus === 'ausente' ? null : nextStatus);
      setShowHomeExcuse(nextStatus === 'excusa');
      toast.success(
        nextStatus === 'presente'
          ? 'Asistencia confirmada.'
          : nextStatus === 'excusa'
          ? 'Excusa registrada. Puedes explicar el motivo abajo.'
          : 'Respuesta retirada. Quedaste pendiente de responder.'
      );
    } catch {
      toast.error('No se pudo registrar tu respuesta.');
    } finally {
      setSavingHomeAttendance(false);
    }
  };

  const handleSaveHomeExcuse = async () => {
    if (!ownMemberId || !nextMeeting || !homeExcuseDraft.trim()) return;
    setSavingHomeAttendance(true);
    try {
      const segmentId = nextMeeting.degreeSegments?.[0]?.id;
      if (!segmentId) throw new Error('La tenida todavía no tiene un tramo de grado configurado.');
      await attendanceService.saveMemberExcuse(nextMeeting.id, segmentId, ownMemberId, homeExcuseDraft, {
        id: user?.id,
        email: user?.email,
      });
      setShowHomeExcuse(false);
      setHomeExcuseDraft('');
      toast.success('Tu explicación de la excusa fue guardada.');
      void loadDashboardData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la explicación.');
    } finally {
      setSavingHomeAttendance(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 pt-2.5 pb-6 sm:py-6 md:px-8 max-w-6xl mx-auto">
      {/* Cabecera Fraternal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/70">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink tracking-tight">
            Bienvenido, {user?.displayName || 'Hermano'}
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted mt-1 flex items-center gap-2">
            <span>R.·. L.·. L.·. Unión Fraternal No. 21</span>
            <span>•</span>
            <span className="text-amber-700 font-semibold">{userRoleName}</span>
          </p>
        </div>
      </div>

      {/* Alerta de Conflictos de Horario si existen */}
      {conflicts.length > 0 && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-destructive">
                Alerta de Calendario: {conflicts.length} conflicto(s) de tenidas detectado(s)
              </h3>
              <p className="mt-1 text-xs text-ink-secondary">
                Hay eventos que coinciden en fecha y hora en el templo.
              </p>
              <div className="mt-2">
                <Link
                  to="/app/calendario"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive hover:underline"
                >
                  Revisar en calendario <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingExcuseEvents.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-xs">
          <h3 className="text-sm font-semibold text-amber-900">Tienes una excusa pendiente</h3>
          <div className="mt-3 space-y-3">
            {pendingExcuseEvents.map((event) => (
              <div key={event.id} className="rounded-xl border border-amber-200 bg-white/70 p-3">
                <p className="text-xs text-amber-800">
                  Explica tu excusa para <span className="font-semibold">{event.title}</span>:
                </p>
                <textarea
                  value={excuseDrafts[event.id] || ''}
                  onChange={(e) => setExcuseDrafts((previous) => ({ ...previous, [event.id]: e.target.value }))}
                  placeholder="Escribe aquí el motivo de tu excusa..."
                  rows={3}
                  className="mt-2 w-full resize-y rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleSaveDashboardExcuse(event.id)}
                    disabled={!excuseDrafts[event.id]?.trim() || savingExcuseEventId === event.id}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-xl bg-amber-700 px-4 text-xs font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingExcuseEventId === event.id ? 'Guardando...' : 'Guardar excusa'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tarjeta Principal Hero: Próxima Tenida Convocada */}
      {nextMeeting ? (
        <div className="rounded-3xl border border-border/80 bg-white p-5 sm:p-7 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                  Próxima Convocatoria
                </span>
                <span className="text-xs text-ink-muted capitalize">
                  {nextMeeting.status}
                </span>
              </div>

              <div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink">
                  {nextMeeting.title}
                </h2>
                {nextMeetingBody && (
                  <p className="text-xs text-ink-muted mt-0.5">
                    {nextMeetingBody.name}
                  </p>
                )}
              </div>

              {/* Detalles del Encuentro */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs text-ink-secondary">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium text-ink">
                    {formatDateTimeSpanish(nextMeeting.startDate, nextMeeting.startTime)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <AppleEmoji name={nextMeetingBody?.appleEmoji || 'temple'} size={16} />
                  <span className="truncate">{nextMeeting.location}</span>
                </div>
              </div>

              {nextMeeting.status === 'convocada' && ownMemberId && (
                <div className="mt-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
                  <p className="text-xs font-semibold text-ink">¿Confirmas tu asistencia?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleHomeAttendance('presente')}
                      disabled={savingHomeAttendance}
                      className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold transition-colors disabled:opacity-60 ${homeAttendanceStatus === 'presente' ? 'bg-success text-white' : 'border border-success/30 bg-white text-success hover:bg-success/10'}`}
                    >
                      {homeAttendanceStatus === 'presente' ? 'Asistencia confirmada' : 'Confirmar asistencia'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleHomeAttendance('excusa')}
                      disabled={savingHomeAttendance}
                      className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold transition-colors disabled:opacity-60 ${homeAttendanceStatus === 'excusa' ? 'bg-amber-600 text-white' : 'border border-amber-300 bg-white text-amber-700 hover:bg-amber-50'}`}
                    >
                      {homeAttendanceStatus === 'excusa' ? 'Excusa seleccionada' : 'Presentar excusa'}
                    </button>
                  </div>
                  {homeAttendanceStatus === 'excusa' && (
                    <div className="mt-2">
                      <textarea
                        value={homeExcuseDraft}
                        onChange={(event) => setHomeExcuseDraft(event.target.value)}
                        placeholder="Escribe el motivo de tu excusa..."
                        rows={2}
                        className="w-full resize-y rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-ink outline-none placeholder:text-ink-muted focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                      />
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void handleSaveHomeExcuse()}
                          disabled={!homeExcuseDraft.trim() || savingHomeAttendance}
                          className="min-h-[34px] rounded-lg bg-amber-700 px-3 text-xs font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Guardar excusa
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="self-start sm:self-center shrink-0">
              <Link
                to="/app/calendario"
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-pressed transition-colors active:scale-95 whitespace-nowrap"
              >
                <span>Ver en Calendario</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-border bg-white p-6 sm:p-8 text-center space-y-3 shadow-2xs">
          <div className="flex justify-center">
            <AppleEmoji name="temple" size={32} />
          </div>
          <div>
            <h3 className="font-serif text-base font-bold text-ink">
              El Taller se encuentra a Cubierto
            </h3>
            <p className="text-xs text-ink-muted max-w-md mx-auto mt-1">
              No hay tenidas agendadas para los próximos días. Las actividades se encuentran en paz y descanso.
            </p>
          </div>
          <Link
            to="/app/calendario"
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-pressed transition-colors"
          >
            <span>Consultar Calendario</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Próximas tenidas y reuniones */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-bold text-ink">Próximas actividades</h2>
            <p className="text-xs text-ink-muted">Tenidas y reuniones programadas</p>
          </div>
          <Link to="/app/calendario" className="text-xs font-semibold text-primary hover:underline">
            Ver todas
          </Link>
        </div>
        {upcomingActivities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {upcomingActivities.map((event) => {
              const body = getBodyById(event.bodyId);
              return (
                <Link
                  key={event.id}
                  to="/app/calendario"
                  className="group rounded-2xl border border-border/80 bg-white p-4 shadow-2xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-center gap-2">
                    <AppleEmoji name={body.appleEmoji} size={20} className="shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary">{body.shortName}</span>
                  </div>
                  <h3 className="mt-2 font-serif text-sm font-bold leading-snug text-ink group-hover:text-primary">{event.title}</h3>
                  <p className="mt-2 text-xs font-medium text-primary">
                    {formatDateTimeSpanish(event.startDate, event.startTime)}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-ink-muted">
                    {event.eventCategory === 'tenida'
                      ? 'Tenida'
                      : event.eventCategory === 'reunion_masonica' ? 'Reunión Masónica' : 'Reunión Fraternal'}
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-white p-5 text-center text-xs text-ink-muted">
            No hay tenidas ni reuniones próximas agendadas.
          </div>
        )}
      </section>

      {/* Resumen Operativo y Cuadro Institucional */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Miembros Activos */}
        <Link
          to="/app/miembros"
          aria-label="Ver miembros del taller"
          className="group rounded-2xl border border-border/80 bg-white p-4 sm:p-5 shadow-2xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted font-medium group-hover:text-primary transition-colors">Membresía Activa</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-ink">{stats.activeCount}</p>
          <span className="text-[11px] text-ink-muted mt-0.5 block">Hermanos en el taller</span>
        </Link>

        {/* Tenidas Programadas */}
        <Link
          to="/app/calendario"
          aria-label="Ver calendario de tenidas"
          className="group rounded-2xl border border-border/80 bg-white p-4 sm:p-5 shadow-2xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted font-medium group-hover:text-primary transition-colors">Tenidas Convocadas</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-ink">{stats.upcomingTenidasCount}</p>
          <span className="text-[11px] text-ink-muted mt-0.5 block">Próximos trabajos litúrgicos</span>
        </Link>

        {/* Reuniones Programadas */}
        <Link
          to="/app/calendario?tipo=reuniones"
          aria-label="Ver calendario de reuniones"
          className="group rounded-2xl border border-border/80 bg-white p-4 sm:p-5 shadow-2xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted font-medium group-hover:text-primary transition-colors">Reuniones Próximas</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-ink">{stats.upcomingReunionsCount}</p>
          <span className="text-[11px] text-ink-muted mt-0.5 block">Masónicas y fraternales</span>
        </Link>

      </div>
    </div>
  );
}
