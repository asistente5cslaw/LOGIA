import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { memberService } from '@/services/memberService';
import { eventService } from '@/services/eventService';
import { minuteService } from '@/services/minuteService';
import { attendanceService } from '@/services/attendanceService';
import { institutionalRoles } from '@/data/rolesData';
import { getBodyById } from '@/data/bodiesData';
import type { Member, LodgeEvent, EventConflict } from '@/types';
import {
  Users,
  CalendarDays,
  AlertTriangle,
  ArrowRight,
  Shield,
} from 'lucide-react';
import { AppleEmoji } from '@/components/shared/AppleEmoji';
import { formatDateTimeSpanish } from '@/lib/dateUtils';

export function DashboardPage() {
  const { user, userRoleName } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<LodgeEvent[]>([]);
  const [conflicts, setConflicts] = useState<EventConflict[]>([]);
  const [stats, setStats] = useState({
    activeCount: 0,
    upcomingMeetingsCount: 0,
    approvedMinutesCount: 0,
    attendanceRate: 0,
  });

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [memList, evList, minList, conflictList] = await Promise.all([
          memberService.getAllMembers(true),
          eventService.getAllEvents(),
          minuteService.getAllMinutes(),
          eventService.getUnresolvedConflicts(),
        ]);

        setMembers(memList);
        setEvents(evList);
        setConflicts(conflictList);

        const activeCount = memList.filter((m) => m.isActive).length;
        const upcomingMeetingsCount = evList.filter(
          (e) => e.isMeeting && e.status !== 'cancelada' && new Date(e.startDate) >= new Date()
        ).length;
        const approvedMinutesCount = minList.filter(
          (m) => m.status === 'aprobada' || m.status === 'firmada'
        ).length;

        const attCalc = attendanceService.calculateStatistics(evList, [], activeCount);

        setStats({
          activeCount,
          upcomingMeetingsCount,
          approvedMinutesCount,
          attendanceRate: attCalc.averageAttendanceRate || 0,
        });
      } catch (e) {
        console.error('Error cargando dashboard:', e);
      }
    }
    loadDashboardData();
  }, []);

  const dignatarios = institutionalRoles.filter((r) => r.category === 'dignatario');
  const upcomingEvents = events
    .filter((e) => e.status !== 'cancelada' && new Date(e.startDate) >= new Date(Date.now() - 86400000))
    .slice(0, 3);

  const nextMeeting = upcomingEvents[0];
  const nextMeetingBody = nextMeeting ? getBodyById(nextMeeting.bodyId) : null;
  const assignedDignatarios = dignatarios
    .map((role) => {
      const assigned = members.find((m) => m.roleId === role.id && m.isActive);
      return { role, assigned };
    })
    .filter((item): item is { role: typeof dignatarios[number]; assigned: Member } => Boolean(item.assigned));

  return (
    <div className="space-y-4 sm:space-y-6 px-4 pt-2.5 pb-6 sm:py-6 md:px-8 max-w-6xl mx-auto">
      {/* Cabecera Fraternal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/70">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink tracking-tight">
            Bienvenido, {user?.displayName || 'Hermano'}
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted mt-1 flex items-center gap-2">
            <span>Resp.·. Log.·. Unión Fraternal No. 21</span>
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

      {/* Resumen Operativo y Cuadro Institucional */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Miembros Activos */}
        <div className="rounded-2xl border border-border/80 bg-white p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted font-medium">Membresía Activa</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-ink">{stats.activeCount}</p>
          <span className="text-[11px] text-ink-muted mt-0.5 block">Hermanos en el taller</span>
        </div>

        {/* Tenidas Programadas */}
        <div className="rounded-2xl border border-border/80 bg-white p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted font-medium">Tenidas Convocadas</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-serif text-2xl font-bold text-ink">{stats.upcomingMeetingsCount}</p>
          <span className="text-[11px] text-ink-muted mt-0.5 block">Próximos trabajos litúrgicos</span>
        </div>

        {/* Dignatario Principal / Oficialidad */}
        <div className="rounded-2xl border border-border/80 bg-white p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted font-medium">Dirección del Taller</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Shield className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            {assignedDignatarios.length > 0 ? (
              assignedDignatarios.slice(0, 1).map(({ role, assigned }) => (
                <div key={role.id}>
                  <p className="font-serif text-base font-bold text-ink truncate">
                    {assigned?.firstName} {assigned?.lastName}
                  </p>
                  <span className="text-[11px] text-amber-700 font-medium block">
                    {role.name}
                  </span>
                </div>
              ))
            ) : (
              <div>
                <p className="font-serif text-base font-bold text-ink">Cuadro Oficial</p>
                <span className="text-[11px] text-ink-muted block">En proceso de asignación</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
