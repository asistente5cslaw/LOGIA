import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { eventService } from '@/services/eventService';
import { memberService } from '@/services/memberService';
import { attendanceService } from '@/services/attendanceService';
import { getBodyById } from '@/data/bodiesData';
import { PageHeader } from '@/components/shared/PageHeader';
import type { LodgeEvent, Member, AttendanceStatus, AttendanceResponseStatus, VisitorAttendance, MasonicDegree } from '@/types';
import {
  Users,
  Search,
  Check,
  X,
  Plus,
  Save,
  User,
  Building2,
} from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { AppleSelect, type AppleSelectOption } from '@/components/shared/AppleSelect';
import { AppleInput } from '@/components/shared/AppleInput';
import { AppleEmoji } from '@/components/shared/AppleEmoji';
import { formatDateSpanish, formatTime12 } from '@/lib/dateUtils';
import { toast } from 'sonner';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

const visitorDegreeOptions: AppleSelectOption<MasonicDegree>[] = [
  { value: 'aprendiz', label: 'Primer Grado — Aprendiz', icon: <AppleEmoji name="ruler" size={16} /> },
  { value: 'companero', label: 'Segundo Grado — Compañero', icon: <AppleEmoji name="cross" size={16} /> },
  { value: 'maestro', label: 'Tercer Grado — Maestro', icon: <AppleEmoji name="temple" size={16} /> },
];

export function AttendancePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<LodgeEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('');
  const [members, setMembers] = useState<Member[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [excuseReasons, setExcuseReasons] = useState<Record<string, string>>({});
  const [excuseSubmittedAt, setExcuseSubmittedAt] = useState<Record<string, string>>({});
  const [memberResponses, setMemberResponses] = useState<Record<string, AttendanceResponseStatus>>({});
  const [memberResponseReasons, setMemberResponseReasons] = useState<Record<string, string>>({});
  const [memberResponseSubmittedAt, setMemberResponseSubmittedAt] = useState<Record<string, string>>({});
  const [editingExcuseMemberId, setEditingExcuseMemberId] = useState<string | null>(null);
  const [excuseDraft, setExcuseDraft] = useState('');
  const [visitors, setVisitors] = useState<VisitorAttendance[]>([]);
  const [searchMember, setSearchMember] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Modal para agregar visitante
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [visName, setVisName] = useState('');
  const [visLodge, setVisLodge] = useState('');
  const [visDegree, setVisDegree] = useState<MasonicDegree>('maestro');
  const [visNotes, setVisNotes] = useState('');

  const canManageAttendance = user?.profile?.roleId === 'vm' || user?.profile?.roleId === 'sec';
  const canViewExcuseReasons = user?.profile?.roleId === 'sec' || user?.profile?.roleId === 'vm';

  const isOwnMember = (member: Member): boolean => (
    Boolean(user?.memberId && user.memberId === member.id) ||
    Boolean(user?.email && member.email && user.email.toLowerCase() === member.email.toLowerCase()) ||
    Boolean(
      user?.displayName &&
      `${member.firstName} ${member.lastName}`.trim().toLowerCase() === user.displayName.trim().toLowerCase()
    )
  );

  const loadInitial = async () => {
    try {
      const [evList, memList] = await Promise.all([
        eventService.getAllEvents(),
        memberService.getAllMembers(false),
      ]);
      // La asistencia también aplica a reuniones informales y actividades de
      // otros cuerpos masónicos; solo se excluyen las actividades canceladas.
      const attendanceEvents = evList.filter((e) => e.status !== 'cancelada');
      setMeetings(attendanceEvents);
      setMembers(memList);
    } catch {
      toast.error('Error al cargar datos de asistencia');
    }
  };

  const loadAttendanceForSelected = async (eventId: string, segmentId: string, currentMembers: Member[]) => {
    if (!segmentId) return;
    try {
      const ownMember = currentMembers.find((member) => isOwnMember(member));
      const [records, responses, visList] = await Promise.all([
        attendanceService.getAttendanceForEvent(eventId, segmentId, {
          canViewExcuseReasons,
          memberId: ownMember?.id,
        }),
        attendanceService.getResponsesForEvent(eventId, segmentId, {
          canViewAll: canManageAttendance,
          memberId: ownMember?.id,
        }),
        attendanceService.getVisitorsForEvent(eventId),
      ]);
      const map: Record<string, AttendanceStatus> = {};
      const reasons: Record<string, string> = {};
      const submitted: Record<string, string> = {};
      const responseMap: Record<string, AttendanceResponseStatus> = {};
      const responseReasons: Record<string, string> = {};
      const responseSubmitted: Record<string, string> = {};
      currentMembers.forEach((m) => {
        const rec = records.find((r) => r.memberId === m.id);
        map[m.id] = rec ? rec.status : 'ausente';
        if (rec?.excuseReason) reasons[m.id] = rec.excuseReason;
        if (rec?.excuseSubmittedAt) submitted[m.id] = rec.excuseSubmittedAt;
      });
      responses.forEach((response) => {
        responseMap[response.memberId] = response.status;
        if (response.excuseReason) responseReasons[response.memberId] = response.excuseReason;
        if (response.submittedAt) responseSubmitted[response.memberId] = response.submittedAt;
      });
      setAttendanceMap(map);
      setExcuseReasons(reasons);
      setExcuseSubmittedAt(submitted);
      setMemberResponses(responseMap);
      setMemberResponseReasons(responseReasons);
      setMemberResponseSubmittedAt(responseSubmitted);
      const ownPendingExcuse = currentMembers.find(
        (member) => isOwnMember(member) && responseMap[member.id] === 'excusa' && !responseSubmitted[member.id]
      );
      setEditingExcuseMemberId(ownPendingExcuse?.id || null);
      setExcuseDraft(ownPendingExcuse ? '' : '');
      setVisitors(visList);
    } catch {
      console.error('Error cargando asistencia del evento');
    }
  };

  useEffect(() => {
    void loadInitial();
  }, []);

  useRealtimeRefresh(() => {
    void loadInitial();
    if (selectedEventId && !hasUnsavedChanges) {
      void loadAttendanceForSelected(selectedEventId, selectedSegmentId, members);
    }
  });

  // Cargar asistencia del evento seleccionado
  useEffect(() => {
    if (hasUnsavedChanges) return;
    if (!selectedEventId) {
      setAttendanceMap({});
      setVisitors([]);
      setSelectedSegmentId('');
      return;
    }

    void loadAttendanceForSelected(selectedEventId, selectedSegmentId, members);
  }, [selectedEventId, selectedSegmentId, members, hasUnsavedChanges]);

  // Mantiene los contadores y estados sincronizados entre dispositivos aunque
  // el canal realtime tarde o no esté disponible en el navegador.
  useEffect(() => {
    if (!selectedEventId || !selectedSegmentId || members.length === 0 || hasUnsavedChanges) return undefined;
    const intervalId = window.setInterval(() => {
      void loadAttendanceForSelected(selectedEventId, selectedSegmentId, members);
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [selectedEventId, selectedSegmentId, members, hasUnsavedChanges]);

  const selectedEvent = useMemo(() => {
    return meetings.find((m) => m.id === selectedEventId);
  }, [meetings, selectedEventId]);

  const filteredMembers = useMemo(() => {
    if (!searchMember.trim()) return members;
    const q = searchMember.toLowerCase();
    return members.filter(
      (m) =>
        m.firstName.toLowerCase().includes(q) ||
        m.lastName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [members, searchMember]);

  const handleStatusToggle = async (memberId: string, status: AttendanceStatus) => {
    if (!canManageAttendance) return;
    const nextMap = {
      ...attendanceMap,
      [memberId]: status,
    };
    setAttendanceMap(() => nextMap);
    setHasUnsavedChanges(true);

    if (status !== 'excusa') {
      setExcuseReasons((prev) => {
        const next = { ...prev };
        delete next[memberId];
        return next;
      });
    }

    const ownMember = members.find((member) => member.id === memberId);
    if (status === 'excusa' && ownMember && isOwnMember(ownMember)) {
      setEditingExcuseMemberId(memberId);
      setExcuseDraft(excuseReasons[memberId] || '');
    }

    if (!selectedEventId || !selectedSegmentId) return;
    setIsSaving(true);
    try {
      const records = Object.entries(nextMap).map(([currentMemberId, currentStatus]) => ({
        memberId: currentMemberId,
        status: currentStatus,
        excuseReason: currentMemberId === memberId && status !== 'excusa'
          ? undefined
          : excuseReasons[currentMemberId],
      }));
      await attendanceService.saveAttendanceBatch(selectedEventId, selectedSegmentId, records, {
        id: user?.id,
        email: user?.email,
      });
      setHasUnsavedChanges(false);
    } catch {
      toast.error('No se pudo guardar el estado de asistencia.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMemberResponseToggle = async (memberId: string, status: 'presente' | 'excusa') => {
    const member = members.find((candidate) => candidate.id === memberId);
    if (!member || !isOwnMember(member) || !selectedEventId || !selectedSegmentId) return;
    try {
      if (status === 'presente') {
        await attendanceService.saveMemberConfirmation(selectedEventId, selectedSegmentId, memberId, {
          id: user?.id,
          email: user?.email,
        });
        setMemberResponses((prev) => ({ ...prev, [memberId]: 'confirmada' }));
        setMemberResponseReasons((prev) => {
          const next = { ...prev };
          delete next[memberId];
          return next;
        });
        toast.success('Asistencia confirmada.');
      } else {
        setEditingExcuseMemberId(memberId);
        setExcuseDraft(memberResponseReasons[memberId] || '');
      }
    } catch {
      toast.error('No se pudo guardar tu respuesta.');
    }
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, AttendanceStatus> = {};
    members.forEach((m) => {
      updated[m.id] = 'presente';
    });
    setAttendanceMap(updated);
    setHasUnsavedChanges(true);
    toast.info('Se han marcado todos los hermanos presentes.');
  };

  const handleSaveAttendance = async () => {
    if (!selectedEventId || !selectedSegmentId) return;
    setIsSaving(true);
    try {
      const records = Object.entries(attendanceMap).map(([memberId, status]) => ({
        memberId,
        status,
        excuseReason: excuseReasons[memberId],
      }));

      await attendanceService.saveAttendanceBatch(selectedEventId, selectedSegmentId, records, {
        id: user?.id,
        email: user?.email,
      });

      setHasUnsavedChanges(false);
      toast.success('Lista de asistencia guardada correctamente.');
    } catch {
      toast.error('Error al guardar la asistencia');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenExcuseEditor = (memberId: string) => {
    const member = members.find((candidate) => candidate.id === memberId);
    const currentResponseStatus = canManageAttendance
      ? attendanceMap[memberId]
      : memberResponses[memberId] === 'excusa' ? 'excusa' : undefined;
    if (!member || !isOwnMember(member) || currentResponseStatus !== 'excusa') return;
    const submittedAt = canManageAttendance ? excuseSubmittedAt[memberId] : memberResponseSubmittedAt[memberId];
    if (submittedAt && Date.now() >= new Date(submittedAt).getTime() + 24 * 60 * 60 * 1000) {
      toast.info('El plazo de 24 horas para editar esta excusa ya venció.');
      return;
    }
    setEditingExcuseMemberId(memberId);
    setExcuseDraft(canManageAttendance ? excuseReasons[memberId] || '' : memberResponseReasons[memberId] || '');
  };

  const handleSaveExcuse = async (memberId: string) => {
    const member = members.find((candidate) => candidate.id === memberId);
    if (!selectedEventId || !selectedSegmentId || !member || !isOwnMember(member) || !excuseDraft.trim()) return;
    try {
      await attendanceService.saveMemberExcuse(selectedEventId, selectedSegmentId, memberId, excuseDraft, {
        id: user?.id,
        email: user?.email,
      });
      setMemberResponses((prev) => ({ ...prev, [memberId]: 'excusa' }));
      setMemberResponseReasons((prev) => ({ ...prev, [memberId]: excuseDraft.trim() }));
      setMemberResponseSubmittedAt((prev) => ({
        ...prev,
        [memberId]: prev[memberId] || new Date().toISOString(),
      }));
      setEditingExcuseMemberId(null);
      setExcuseDraft('');
      toast.success('Excusa guardada correctamente.');
    } catch {
      toast.error('No se pudo guardar la excusa.');
    }
  };

  const handleAddVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !visName.trim() || !visLodge.trim()) return;

    try {
      const created = await attendanceService.addVisitor(
        {
          eventId: selectedEventId,
          fullName: visName.trim(),
          lodge: visLodge.trim(),
          degree: visDegree,
          notes: visNotes.trim() || undefined,
        },
        { id: user?.id, email: user?.email }
      );

      setVisitors((prev) => [...prev, created]);
      setShowVisitorModal(false);
      setVisName('');
      setVisLodge('');
      setVisNotes('');
      toast.success(`Visitante registrado: Q.·. H.·. ${created.fullName}`);
    } catch {
      toast.error('Error al registrar visitante');
    }
  };

  // Cálculos en vivo
  const totalActive = members.length;
  const presentCount = Object.values(attendanceMap).filter((s) => s === 'presente').length;
  const excuseCount = Object.values(attendanceMap).filter((s) => s === 'excusa').length;
  const absentCount = totalActive - presentCount - excuseCount;
  const currentPercentage = totalActive > 0 ? Math.round((presentCount / totalActive) * 100) : 0;

  return (
    <div className="space-y-4 sm:space-y-6 px-4 pt-2.5 pb-6 sm:py-6 md:px-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <PageHeader
          title="Control de Asistencia"
          subtitle="Toma y registro de hermanos activos y visitantes del orbe"
        />

        {canManageAttendance && selectedEventId && (
          <div className="flex w-full sm:w-auto items-center gap-2">
            <button
              onClick={handleMarkAllPresent}
              className="flex-1 sm:flex-initial min-h-[40px] flex flex-row items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-ink-secondary hover:bg-surface-container transition-colors active:scale-95 cursor-pointer whitespace-nowrap flex-nowrap shrink-0"
            >
              <Check className="h-4 w-4 text-success shrink-0" />
              <span className="whitespace-nowrap">Todos presentes</span>
            </button>
            <button
              onClick={handleSaveAttendance}
              disabled={isSaving}
              className="flex-1 sm:flex-initial min-h-[40px] flex flex-row items-center justify-center gap-1.5 rounded-xl bg-primary px-3 sm:px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-pressed transition-colors disabled:opacity-60 active:scale-95 cursor-pointer whitespace-nowrap flex-nowrap shrink-0"
            >
              <Save className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{isSaving ? 'Guardando…' : 'Guardar lista'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Selector de Tenida estilo Apple */}
      {meetings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-6 sm:p-8 text-center space-y-3 shadow-xs">
          <div className="flex justify-center">
            <AppleEmoji name="temple" size={32} />
          </div>
          <div>
            <h4 className="font-serif text-sm font-bold text-ink">
              No hay actividades agendadas en el Calendario
            </h4>
            <p className="text-xs text-ink-muted max-w-md mx-auto mt-1">
              Para registrar la asistencia de los hermanos, primero programa una actividad en el Calendario Masónico.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/calendario')}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-pressed transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Ir al Calendario para Agendar</span>
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-white p-4 sm:p-5 shadow-xs space-y-2">
          <label className="text-xs font-semibold text-ink block">
            Selecciona la actividad a registrar:
          </label>
          <AppleSelect
            value={selectedEventId}
            onChange={(val) => {
              setHasUnsavedChanges(false);
              const selected = meetings.find((meeting) => meeting.id === val);
              setSelectedSegmentId(selected?.degreeSegments?.[0]?.id || '');
              setSelectedEventId(val);
            }}
            placeholder="Elige una actividad para registrar asistencia..."
            options={meetings.map((m) => ({
              value: m.id,
              label: `${formatDateSpanish(m.startDate)} ${m.startTime ? `(${formatTime12(m.startTime)})` : ''} — ${m.title}`,
              badge: m.status,
              icon: <AppleEmoji name={getBodyById(m.bodyId).appleEmoji} size={16} />
            }))}
          />
          {selectedEvent && (selectedEvent.degreeSegments?.length || 0) > 0 && (
            <div className="mt-3">
              <AppleSelect
                value={selectedSegmentId}
                onChange={(val) => {
                  setHasUnsavedChanges(false);
                  setSelectedSegmentId(val);
                }}
                label="Tramo / grado de la asistencia"
                options={(selectedEvent.degreeSegments || []).map((segment) => ({
                  value: segment.id,
                  label: segment.degree === 'aprendiz' ? 'Primer grado — Aprendiz' : segment.degree === 'companero' ? 'Segundo grado — Compañero' : 'Tercer grado — Maestro',
                  description: `Tramo ${segment.sequence} de la misma tenida`,
                }))}
              />
            </div>
          )}
          {selectedEvent && (
            <div className="pt-2 flex items-center justify-between text-xs text-ink-secondary">
              <span>Lugar: <strong className="text-ink">{selectedEvent.location}</strong></span>
              <span className="capitalize font-medium">Estado: <span className="text-primary">{selectedEvent.status}</span></span>
            </div>
          )}
        </div>
      )}

      {/* Mensaje guiado cuando aún no se ha seleccionado ninguna tenida */}
      {meetings.length > 0 && !selectedEventId && (
        <div className="rounded-2xl border border-dashed border-border bg-white p-8 sm:p-12 text-center space-y-3 shadow-xs">
          <div className="flex justify-center">
            <AppleEmoji name="temple" size={38} />
          </div>
          <div>
            <h4 className="font-serif text-base font-bold text-ink">
              Ninguna actividad seleccionada
            </h4>
            <p className="text-xs text-ink-muted max-w-md mx-auto mt-1">
              Por favor selecciona en la lista desplegable superior la reunión o actividad masónica para registrar la asistencia y los QQ.·. HH.·. visitantes.
            </p>
          </div>
        </div>
      )}

      {/* Contenido de asistencia: Solo cuando hay una tenida seleccionada */}
      {selectedEventId && (
        <>

      {/* Indicadores de Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <span className="text-xs text-ink-muted">Presentes</span>
          <p className="mt-1 font-serif text-2xl font-bold text-success">{presentCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <span className="text-xs text-ink-muted">Con Excusa</span>
          <p className="mt-1 font-serif text-2xl font-bold text-amber-600">{excuseCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <span className="text-xs text-ink-muted">Ausentes</span>
          <p className="mt-1 font-serif text-2xl font-bold text-destructive">{absentCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <span className="text-xs text-ink-muted">% de Asistencia</span>
          <p className="mt-1 font-serif text-2xl font-bold text-primary">{currentPercentage}%</p>
        </div>
      </div>

      {/* Búsqueda y Lista de Hermanos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface shadow-card p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
            <h3 className="font-serif text-base font-bold text-ink flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Miembros del Taller
            </h3>
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-muted" />
              <input
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                placeholder="Buscar hermano..."
                className="w-full rounded-lg border border-border bg-surface pl-8 pr-2 py-1.5 text-xs text-ink outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="divide-y divide-border/60">
            {filteredMembers.map((m) => {
              const responseStatus = memberResponses[m.id];
              const isOwn = isOwnMember(m);
              const currentStatus = canManageAttendance
                ? (attendanceMap[m.id] || 'ausente')
                : responseStatus === 'confirmada'
                  ? 'presente'
                  : responseStatus === 'excusa'
                    ? 'excusa'
                    : 'ausente';
              const currentExcuseSubmittedAt = canManageAttendance ? excuseSubmittedAt[m.id] : memberResponseSubmittedAt[m.id];
              return (
                <div
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-xs font-semibold text-ink-secondary">
                      {m.firstName[0]}
                      {m.lastName[0]}
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-ink">
                        {m.firstName} {m.lastName}
                      </p>
                      <p className="text-[11px] text-ink-muted uppercase">Grado: {m.roleId === 'vm' ? 'maestro' : m.degree}</p>
                    </div>
                  </div>

                  {/* Botones de estado: Presente, Excusa, Ausente */}
                  <div className="flex flex-col items-end gap-1.5 self-end sm:self-auto">
                    <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!canManageAttendance && !isOwn}
                      onClick={() => canManageAttendance ? void handleStatusToggle(m.id, 'presente') : void handleMemberResponseToggle(m.id, 'presente')}
                      className={`min-h-[36px] px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                        currentStatus === 'presente'
                          ? 'bg-success text-white shadow-xs'
                          : 'border border-border text-ink-muted hover:bg-surface-container'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" /> Presente
                    </button>

                    <button
                      type="button"
                      disabled={!canManageAttendance && !isOwn}
                      onClick={() => canManageAttendance ? void handleStatusToggle(m.id, 'excusa') : void handleMemberResponseToggle(m.id, 'excusa')}
                      className={`min-h-[36px] px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                        currentStatus === 'excusa'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'border border-border text-ink-muted hover:bg-surface-container'
                      }`}
                    >
                      Excusa
                    </button>

                    <button
                      type="button"
                      disabled={!canManageAttendance}
                      onClick={() => handleStatusToggle(m.id, 'ausente')}
                      className={`min-h-[36px] px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                        currentStatus === 'ausente'
                          ? 'bg-destructive text-white shadow-xs'
                          : 'border border-border text-ink-muted hover:bg-surface-container'
                      }`}
                    >
                      <X className="h-3.5 w-3.5" /> Ausente
                    </button>
                    </div>
                    {isOwn && currentStatus === 'excusa' && (
                      currentExcuseSubmittedAt ? (
                        currentExcuseSubmittedAt && Date.now() < new Date(currentExcuseSubmittedAt).getTime() + 24 * 60 * 60 * 1000 ? (
                          <button
                            type="button"
                            onClick={() => handleOpenExcuseEditor(m.id)}
                            className="text-[11px] font-semibold text-primary hover:underline"
                          >
                            Editar mi excusa
                          </button>
                        ) : (
                          <span className="text-[11px] font-medium text-ink-muted">Edición de excusa cerrada después de 24 horas</span>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenExcuseEditor(m.id)}
                          className="text-[11px] font-semibold text-primary hover:underline"
                        >
                          Escribir mi excusa
                        </button>
                      )
                    )}
                    {!isOwn && currentStatus === 'excusa' && (
                      canViewExcuseReasons ? (
                        excuseReasons[m.id] ? (
                          <p className="max-w-xs text-left text-[11px] text-amber-800">
                            <span className="font-semibold">Excusa:</span> {excuseReasons[m.id]}
                          </p>
                        ) : (
                          <span className="text-[11px] font-medium text-amber-700">Excusa pendiente de explicación por el hermano</span>
                        )
                      ) : (
                        <span className="text-[11px] font-medium text-amber-700">Excusa registrada</span>
                      )
                    )}
                    {canManageAttendance && responseStatus && (
                      <span className="text-[11px] font-semibold text-primary">
                        Respuesta del hermano: {responseStatus === 'confirmada' ? 'Asistencia confirmada' : 'Presentó excusa'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sección de Hermanos Visitantes */}
        <div className="rounded-xl border border-border bg-surface shadow-card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="font-serif text-base font-bold text-ink">QQ.·. HH.·. Visitantes</h3>
              {canManageAttendance && (
                <button
                  onClick={() => setShowVisitorModal(true)}
                  className="flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar
                </button>
              )}
            </div>

            <div className="space-y-3">
              {visitors.length === 0 ? (
                <p className="text-xs text-ink-muted text-center py-8">
                  No hay visitantes registrados para esta tenida.
                </p>
              ) : (
                visitors.map((v) => (
                  <div key={v.id} className="rounded-lg border border-border p-3 bg-surface-container-low">
                    <p className="text-xs font-bold text-ink">{v.fullName}</p>
                    <p className="text-[11px] text-ink-secondary">Logia: {v.lodge}</p>
                    <span className="text-[10px] text-primary uppercase font-semibold">Grado: {v.degree}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Modal para explicar la excusa del miembro autenticado */}
      <Modal
        isOpen={Boolean(editingExcuseMemberId)}
        onClose={() => {
          setEditingExcuseMemberId(null);
          setExcuseDraft('');
        }}
        title="Explicar mi excusa"
        subtitle={editingExcuseMemberId ? selectedEvent?.title : undefined}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">
            Escribe el motivo de tu ausencia. Podrás editarlo durante las primeras 24 horas desde el primer guardado.
          </p>
          <textarea
            autoFocus
            value={excuseDraft}
            onChange={(e) => setExcuseDraft(e.target.value)}
            rows={5}
            maxLength={500}
            placeholder="Escribe el motivo de tu ausencia..."
            className="w-full resize-none rounded-xl border border-border bg-surface-container-low px-3 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex justify-end gap-2.5 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => {
                setEditingExcuseMemberId(null);
                setExcuseDraft('');
              }}
              className="min-h-[40px] rounded-xl border border-border px-4 text-xs font-semibold text-ink-secondary hover:bg-surface-container"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!excuseDraft.trim() || !editingExcuseMemberId}
              onClick={() => editingExcuseMemberId && void handleSaveExcuse(editingExcuseMemberId)}
              className="min-h-[40px] rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary-pressed disabled:cursor-not-allowed disabled:opacity-50"
            >
              Guardar excusa
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Registrar Visitante */}
      <Modal
        isOpen={showVisitorModal}
        onClose={() => setShowVisitorModal(false)}
        title="Registrar Visitante"
        subtitle="Registra al hermano de otro taller masónico"
        maxWidth="sm"
      >
        <form onSubmit={handleAddVisitor} noValidate className="space-y-4">
          <AppleInput
            label="Nombre Completo del Hermano *"
            required
            value={visName}
            onChange={(e) => setVisName(e.target.value)}
            icon={<User className="h-4 w-4" />}
            placeholder="Ej. Juan Pérez"
          />

          <AppleInput
            label="Logia y Oriente de Origen *"
            required
            value={visLodge}
            onChange={(e) => setVisLodge(e.target.value)}
            icon={<Building2 className="h-4 w-4" />}
            placeholder="Ej. Resp.·. Log.·. Acacia No. 10 (GLP)"
          />

          <AppleSelect<MasonicDegree>
            label="Grado Masónico"
            value={visDegree}
            onChange={setVisDegree}
            options={visitorDegreeOptions}
          />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setShowVisitorModal(false)}
              className="min-h-[44px] px-5 rounded-xl border border-border text-xs font-semibold text-ink-secondary hover:bg-surface-container transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-6 rounded-xl bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary-pressed shadow-sm transition-all"
            >
              Registrar Visitante
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
