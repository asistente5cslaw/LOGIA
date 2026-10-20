import { useState, useEffect, useMemo, useCallback } from 'react';
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
  MapPin,
  Clock3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { AppleSelect, type AppleSelectOption } from '@/components/shared/AppleSelect';
import { AppleInput } from '@/components/shared/AppleInput';
import { AppleEmoji } from '@/components/shared/AppleEmoji';
import { formatDateSpanish, formatTime12, formatTimeRange12, normalizeDateOnly } from '@/lib/dateUtils';
import { getLocalIsoDate } from '@/domain/dashboardStats';
import { toast } from 'sonner';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { ErrorState } from '@/components/shared/ErrorState';

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
  const [memberMeetingResponses, setMemberMeetingResponses] = useState<Record<string, AttendanceResponseStatus>>({});
  const [editingExcuseMemberId, setEditingExcuseMemberId] = useState<string | null>(null);
  const [viewingExcuse, setViewingExcuse] = useState<{ memberName: string; reason: string } | null>(null);
  const [excuseDraft, setExcuseDraft] = useState('');
  const [visitors, setVisitors] = useState<VisitorAttendance[]>([]);
  const [searchMember, setSearchMember] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingAttendanceEvents, setPendingAttendanceEvents] = useState<LodgeEvent[]>([]);
  const [savedAttendanceKeys, setSavedAttendanceKeys] = useState<Record<string, boolean>>({});
  const [attendanceCalendarDate, setAttendanceCalendarDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [showAttendanceCalendar, setShowAttendanceCalendar] = useState(false);
  const [dayEventChoices, setDayEventChoices] = useState<LodgeEvent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal para agregar visitante
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [visName, setVisName] = useState('');
  const [visLodge, setVisLodge] = useState('');
  const [visDegree, setVisDegree] = useState<MasonicDegree>('maestro');
  const [visNotes, setVisNotes] = useState('');

  const canManageAttendance = user?.profile?.roleId === 'vm'
    || user?.profile?.roleId === 'sec'
    || user?.profile?.technicalRole === 'admin'
    || user?.profile?.technicalRole === 'secretary';
  const canViewExcuseReasons = user?.profile?.roleId === 'sec'
    || user?.profile?.roleId === 'vm'
    || user?.profile?.technicalRole === 'admin'
    || user?.profile?.technicalRole === 'secretary';

  const isOwnMember = useCallback((member: Member): boolean => (
    Boolean(user?.memberId && user.memberId === member.id) ||
    Boolean(user?.email && member.email && user.email.toLowerCase() === member.email.toLowerCase()) ||
    Boolean(
      user?.displayName &&
      `${member.firstName} ${member.lastName}`.trim().toLowerCase() === user.displayName.trim().toLowerCase()
    )
  ), [user?.displayName, user?.email, user?.memberId]);

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
      setLoadError(null);
    } catch {
      toast.error('Error al cargar datos de asistencia');
      setLoadError('No se pudieron cargar los eventos o miembros. Revisa tu conexión e inténtalo nuevamente.');
    }
  };

  const loadAttendanceForSelected = useCallback(async (eventId: string, segmentId: string, currentMembers: Member[]) => {
    if (!segmentId) return;
    try {
      const ownMember = currentMembers.find((member) => isOwnMember(member));
      const [recordsResult, responsesResult, visitorsResult] = await Promise.allSettled([
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
      if (recordsResult.status === 'rejected') {
        throw recordsResult.reason;
      }
      const records = recordsResult.value;
      const responses = responsesResult.status === 'fulfilled' ? responsesResult.value : [];
      const visList = visitorsResult.status === 'fulfilled' ? visitorsResult.value : [];
      if (responsesResult.status === 'rejected') {
        console.warn('No se pudieron cargar las respuestas personales de asistencia:', responsesResult.reason);
      }
      if (visitorsResult.status === 'rejected') {
        console.warn('No se pudieron cargar los visitantes de la actividad:', visitorsResult.reason);
      }
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
      setSavedAttendanceKeys((prev) => ({
        ...prev,
        [`${eventId}:${segmentId}`]: records.length > 0,
      }));
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
      setLoadError('No se pudo cargar la lista de asistencia de esta actividad. Puedes reintentar.');
    }
  }, [canManageAttendance, canViewExcuseReasons, isOwnMember]);

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
  }, [selectedEventId, selectedSegmentId, members, hasUnsavedChanges, loadAttendanceForSelected]);

  // Reuniones culminadas que todavía no tienen asistencia oficial guardada.
  useEffect(() => {
    if (!canManageAttendance || meetings.length === 0) {
      setPendingAttendanceEvents([]);
      return;
    }

    let cancelled = false;
    const loadPendingAttendance = async () => {
      const now = Date.now();
      const candidates = meetings.filter((event) => {
        if (event.status === 'cancelada' || !event.degreeSegments?.[0]) return false;
        const eventStart = new Date(`${event.startDate}T${event.startTime || '23:59:59'}-05:00`).getTime();
        return event.status === 'celebrada' || (!Number.isNaN(eventStart) && eventStart <= now);
      });
      const results = await Promise.allSettled(candidates.map(async (event) => {
        const segmentId = event.degreeSegments?.[0]?.id;
        if (!segmentId) return null;
        const records = await attendanceService.getAttendanceForEvent(event.id, segmentId);
        return records.length === 0 ? event : null;
      }));
      if (cancelled) return;
      setPendingAttendanceEvents(
        results
          .filter((result): result is PromiseFulfilledResult<LodgeEvent | null> => result.status === 'fulfilled')
          .map((result) => result.value)
          .filter((event): event is LodgeEvent => Boolean(event))
          .sort((a, b) => `${a.startDate}T${a.startTime || ''}`.localeCompare(`${b.startDate}T${b.startTime || ''}`))
      );
    };
    void loadPendingAttendance();
    return () => { cancelled = true; };
  }, [canManageAttendance, meetings]);

  // Mantiene los contadores y estados sincronizados entre dispositivos aunque
  // el canal realtime tarde o no esté disponible en el navegador.
  useEffect(() => {
    if (!selectedEventId || !selectedSegmentId || members.length === 0 || hasUnsavedChanges) return undefined;
    const intervalId = window.setInterval(() => {
      void loadAttendanceForSelected(selectedEventId, selectedSegmentId, members);
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [selectedEventId, selectedSegmentId, members, hasUnsavedChanges, loadAttendanceForSelected]);

  const selectedEvent = useMemo(() => {
    return meetings.find((m) => m.id === selectedEventId);
  }, [meetings, selectedEventId]);

  const memberMeetingCards = useMemo(() => {
    const today = getLocalIsoDate();
    return meetings
      .filter((event) => (
        (event.status === 'programada' || event.status === 'convocada')
        && event.startDate >= today
      ))
      .sort((a, b) => `${a.startDate}T${a.startTime || ''}`.localeCompare(`${b.startDate}T${b.startTime || ''}`));
  }, [meetings]);

  const getMemberMeetingResponseKey = useCallback((eventId: string, segmentId: string, memberId: string) => (
    `${eventId}:${segmentId}:${memberId}`
  ), []);

  useEffect(() => {
    if (canManageAttendance) return;
    const ownMember = members.find((member) => isOwnMember(member));
    if (!ownMember || memberMeetingCards.length === 0) {
      setMemberMeetingResponses({});
      return;
    }

    let cancelled = false;
    const loadMemberResponses = async () => {
      const results = await Promise.allSettled(
        memberMeetingCards.map(async (event) => {
          const segmentId = event.degreeSegments?.[0]?.id;
          if (!segmentId) return null;
          const responses = await attendanceService.getResponsesForEvent(event.id, segmentId, { memberId: ownMember.id });
          const response = responses.find((item) => item.memberId === ownMember.id);
          return response ? { key: getMemberMeetingResponseKey(event.id, segmentId, ownMember.id), status: response.status } : null;
        })
      );
      if (cancelled) return;
      const next: Record<string, AttendanceResponseStatus> = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) next[result.value.key] = result.value.status;
      });
      setMemberMeetingResponses(next);
    };
    void loadMemberResponses();
    return () => { cancelled = true; };
  }, [canManageAttendance, getMemberMeetingResponseKey, isOwnMember, memberMeetingCards, members]);

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

  const isBeforeSelectedEvent = (): boolean => {
    if (!selectedEvent) return false;
    const eventStart = new Date(`${selectedEvent.startDate}T${selectedEvent.startTime || '23:59:59'}-05:00`);
    return !Number.isNaN(eventStart.getTime()) && Date.now() < eventStart.getTime();
  };

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
      setSavedAttendanceKeys((prev) => ({
        ...prev,
        [`${selectedEventId}:${selectedSegmentId}`]: true,
      }));
      setPendingAttendanceEvents((prev) => prev.filter((event) => event.id !== selectedEventId));
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
        toast.success('Aviso de asistencia enviado. Secretaría registrará la asistencia oficial.');
      } else {
        setEditingExcuseMemberId(memberId);
        setExcuseDraft(memberResponseReasons[memberId] || '');
      }
    } catch {
      toast.error('No se pudo guardar tu respuesta.');
    }
  };

  const handleMemberMeetingResponse = async (event: LodgeEvent, status: 'presente' | 'excusa') => {
    const member = members.find((candidate) => isOwnMember(candidate));
    const segmentId = event.degreeSegments?.[0]?.id;
    if (!member || !segmentId) {
      toast.error('La reunión todavía no tiene un tramo de grado configurado.');
      return;
    }

    setSelectedEventId(event.id);
    setSelectedSegmentId(segmentId);
    const responseKey = getMemberMeetingResponseKey(event.id, segmentId, member.id);
    const currentResponse = memberMeetingResponses[responseKey];
    try {
      if (currentResponse === (status === 'presente' ? 'confirmada' : 'excusa')) {
        await attendanceService.clearMemberAttendance(event.id, segmentId, member.id, {
          id: user?.id,
          email: user?.email,
        });
        setMemberMeetingResponses((prev) => {
          const next = { ...prev };
          delete next[responseKey];
          return next;
        });
        setMemberResponses((prev) => {
          const next = { ...prev };
          delete next[member.id];
          return next;
        });
        if (currentResponse === 'excusa') {
          setEditingExcuseMemberId(null);
          setExcuseDraft('');
        }
        toast.success('Respuesta retirada. La asistencia oficial no fue modificada.');
        return;
      }
      if (status === 'presente') {
        await attendanceService.saveMemberConfirmation(event.id, segmentId, member.id, {
          id: user?.id,
          email: user?.email,
        });
        setMemberMeetingResponses((prev) => ({ ...prev, [responseKey]: 'confirmada' }));
        setMemberResponses((prev) => ({ ...prev, [member.id]: 'confirmada' }));
        toast.success('Aviso de asistencia enviado. Secretaría registrará la asistencia oficial.');
      } else {
        await attendanceService.saveMemberExcusePending(event.id, segmentId, member.id, {
          id: user?.id,
          email: user?.email,
        });
        setMemberMeetingResponses((prev) => ({ ...prev, [responseKey]: 'excusa' }));
        setMemberResponses((prev) => ({ ...prev, [member.id]: 'excusa' }));
        setMemberResponseSubmittedAt((prev) => ({ ...prev, [member.id]: new Date().toISOString() }));
        setEditingExcuseMemberId(member.id);
        setExcuseDraft('');
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
      setSavedAttendanceKeys((prev) => ({
        ...prev,
        [`${selectedEventId}:${selectedSegmentId}`]: true,
      }));
      setPendingAttendanceEvents((prev) => prev.filter((event) => event.id !== selectedEventId));
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
  const attendanceKey = `${selectedEventId}:${selectedSegmentId}`;
  const attendanceIsSaved = Boolean(savedAttendanceKeys[attendanceKey]);
  const isEditingSavedAttendance = attendanceIsSaved && hasUnsavedChanges;
  const attendanceCalendarYear = attendanceCalendarDate.getFullYear();
  const attendanceCalendarMonth = attendanceCalendarDate.getMonth();
  const attendanceDaysInMonth = new Date(attendanceCalendarYear, attendanceCalendarMonth + 1, 0).getDate();
  const attendanceFirstDayIndex = new Date(attendanceCalendarYear, attendanceCalendarMonth, 1).getDay();
  const attendanceMonthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const selectAttendanceEvent = (event: LodgeEvent) => {
    setHasUnsavedChanges(false);
    setSelectedSegmentId(event.degreeSegments?.[0]?.id || '');
    setSelectedEventId(event.id);
    setShowAttendanceCalendar(false);
    setDayEventChoices([]);
  };
  const handleAttendanceCalendarDayClick = (events: LodgeEvent[]) => {
    if (events.length === 1) {
      selectAttendanceEvent(events[0]);
    } else if (events.length > 1) {
      setDayEventChoices(events);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 pt-2.5 pb-6 sm:py-6 md:px-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <PageHeader
          title="Control de Asistencia"
          subtitle={canManageAttendance
            ? 'Toma y registro de hermanos activos y visitantes del orbe'
            : 'Confirma tu asistencia o presenta una excusa. La asistencia oficial la registra Secretaría.'}
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
            {attendanceIsSaved && !hasUnsavedChanges ? (
              <button
                type="button"
                onClick={() => setHasUnsavedChanges(true)}
                className="flex-1 sm:flex-initial min-h-[40px] flex flex-row items-center justify-center gap-1.5 rounded-xl border border-primary bg-surface px-3 sm:px-4 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors active:scale-95 cursor-pointer whitespace-nowrap flex-nowrap shrink-0"
              >
                <Save className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">Editar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={isSaving}
                className="flex-1 sm:flex-initial min-h-[40px] flex flex-row items-center justify-center gap-1.5 rounded-xl bg-primary px-3 sm:px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-pressed transition-colors disabled:opacity-60 active:scale-95 cursor-pointer whitespace-nowrap flex-nowrap shrink-0"
              >
                <Save className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{isSaving ? 'Guardando…' : isEditingSavedAttendance ? 'Guardar cambios' : 'Guardar lista'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {loadError && <ErrorState description={loadError} onRetry={() => {
        void loadInitial();
        if (selectedEventId && selectedSegmentId) void loadAttendanceForSelected(selectedEventId, selectedSegmentId, members);
      }} />}

      {/* Selector de Tenida estilo Apple */}
      {canManageAttendance && (meetings.length === 0 ? (
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
          <button
            type="button"
            onClick={() => setShowAttendanceCalendar((current) => !current)}
            className="flex min-h-[50px] w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 text-left text-sm text-ink transition-colors hover:border-primary"
          >
            <span className="flex min-w-0 items-center gap-2">
              {selectedEvent ? (
                <>
                  <AppleEmoji name={getBodyById(selectedEvent.bodyId).appleEmoji} size={18} />
                  <span className="truncate">{formatDateSpanish(selectedEvent.startDate)}{selectedEvent.startTime ? ` (${formatTime12(selectedEvent.startTime)})` : ''} — {selectedEvent.title}</span>
                </>
              ) : (
                <span className="text-ink-muted">Elige una actividad para registrar asistencia...</span>
              )}
            </span>
            {showAttendanceCalendar ? <ChevronLeft className="h-4 w-4 rotate-90 text-ink-muted" /> : <ChevronRight className="h-4 w-4 rotate-90 text-ink-muted" />}
          </button>

          {showAttendanceCalendar && (
            <div className="mt-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="flex items-center gap-2 font-serif text-lg font-bold text-ink">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  {attendanceMonthNames[attendanceCalendarMonth]} {attendanceCalendarYear}
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Mes anterior"
                    onClick={() => setAttendanceCalendarDate(new Date(attendanceCalendarYear, attendanceCalendarMonth - 1, 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-ink hover:bg-surface-container"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Mes siguiente"
                    onClick={() => setAttendanceCalendarDate(new Date(attendanceCalendarYear, attendanceCalendarMonth + 1, 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-ink hover:bg-surface-container"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-semibold text-ink-muted">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
                {Array.from({ length: attendanceFirstDayIndex }).map((_, index) => (
                  <div key={`attendance-empty-${index}`} className="min-h-[60px] rounded-lg border border-transparent bg-surface-container-low/30 sm:min-h-[74px]" />
                ))}
                {Array.from({ length: attendanceDaysInMonth }).map((_, index) => {
                  const day = index + 1;
                  const dateStr = `${attendanceCalendarYear}-${String(attendanceCalendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayEvents = meetings.filter((event) => {
                    const start = normalizeDateOnly(event.startDate);
                    const end = normalizeDateOnly(event.endDate || event.startDate);
                    return start === dateStr || (dateStr >= start && dateStr <= end);
                  });
                  const hasEvents = dayEvents.length > 0;
                  return (
                    <div
                      key={dateStr}
                      role={hasEvents ? 'button' : undefined}
                      tabIndex={hasEvents ? 0 : -1}
                      onClick={() => handleAttendanceCalendarDayClick(dayEvents)}
                      onKeyDown={(event) => {
                        if (hasEvents && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault();
                          handleAttendanceCalendarDayClick(dayEvents);
                        }
                      }}
                      className={`min-h-[60px] rounded-xl border p-1.5 sm:min-h-[74px] ${hasEvents ? 'cursor-pointer border-primary/40 bg-primary/10 hover:bg-primary/15' : 'border-border bg-white'}`}
                    >
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${hasEvents ? 'bg-primary font-bold text-primary-foreground' : 'text-ink-secondary'}`}>{day}</span>
                      {hasEvents && (
                        <div className="mt-1 space-y-1 overflow-hidden">
                          {dayEvents.slice(0, 2).map((event) => (
                            <span
                              key={event.id}
                              title={event.title}
                              className="flex w-full items-center gap-1 truncate rounded border border-primary/20 bg-white px-1 py-0.5 text-left text-[8px] leading-tight text-primary sm:text-[9px]"
                            >
                              <AppleEmoji name={getBodyById(event.bodyId).appleEmoji} size={11} />
                              <span className="truncate">{event.title}</span>
                            </span>
                          ))}
                          {dayEvents.length > 2 && <span className="block px-1 text-[8px] font-semibold text-ink-muted">+{dayEvents.length - 2} más</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" /> Lugar: <strong className="text-ink">{selectedEvent.location}</strong></span>
              <span className="capitalize font-medium">Estado: <span className="text-primary">{selectedEvent.status}</span></span>
            </div>
          )}
        </div>
      ))}

      <Modal
        isOpen={dayEventChoices.length > 1}
        onClose={() => setDayEventChoices([])}
        title="Selecciona la reunión"
        subtitle="Hay más de una actividad programada para este día."
        maxWidth="sm"
      >
        <div className="space-y-2">
          {dayEventChoices.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => selectAttendanceEvent(event)}
              className="flex w-full items-start gap-3 rounded-xl border border-border bg-surface px-3 py-3 text-left transition-colors hover:border-primary hover:bg-surface-container-low"
            >
              <AppleEmoji name={getBodyById(event.bodyId).appleEmoji} size={24} />
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-sm font-bold text-ink">{event.title}</span>
                <span className="mt-1 block text-xs text-ink-muted">
                  {formatTimeRange12(event.startTime, event.endTime) || 'Horario por confirmar'} · {event.location || 'Ubicación por confirmar'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Modal>

      {canManageAttendance && !selectedEventId && pendingAttendanceEvents.length > 0 && (
        <section className="rounded-2xl border border-dashed border-border bg-white p-5 shadow-xs sm:p-6">
          <div className="mb-5 text-center">
            <h4 className="font-serif text-base font-bold text-ink">Registros pendientes</h4>
            <p className="mx-auto mt-1 max-w-md text-xs text-ink-muted">Estas reuniones todavía no tienen asistencia oficial guardada.</p>
          </div>
          <div className="grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
            {pendingAttendanceEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => selectAttendanceEvent(event)}
                className="rounded-2xl border border-border bg-surface px-4 py-4 text-left transition-colors hover:border-primary hover:bg-surface-container-low"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                    <AppleEmoji name={getBodyById(event.bodyId).appleEmoji} size={24} />
                    {getBodyById(event.bodyId).shortName}
                  </span>
                  <span className="shrink-0 rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-semibold uppercase text-ink-secondary">
                    {event.status === 'convocada' ? 'Convocada' : event.status === 'celebrada' ? 'Celebrada' : 'Programada'}
                  </span>
                </span>
                <span className="mt-3 block font-serif text-base font-bold text-ink">{event.title}</span>
                <span className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-muted">
                  <Clock3 className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {formatTimeRange12(event.startTime, event.endTime) || 'Horario por confirmar'}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-muted">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {event.location || 'Ubicación por confirmar'}
                </span>
                {event.notes?.trim() && (
                  <span className="mt-2 block text-[11px] italic leading-relaxed text-ink-muted">«{event.notes.trim()}»</span>
                )}
                <span className="mt-3 block border-t border-border pt-3 text-[11px] font-semibold text-primary">Abrir registro →</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!canManageAttendance && (
        <section className="space-y-3">
          {memberMeetingCards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-ink-muted">
              No hay reuniones próximas disponibles para responder.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {memberMeetingCards.map((event) => {
                const ownMember = members.find((member) => isOwnMember(member));
                const segmentId = event.degreeSegments?.[0]?.id || '';
                const response = ownMember && segmentId
                  ? memberMeetingResponses[getMemberMeetingResponseKey(event.id, segmentId, ownMember.id)]
                  : undefined;
                const body = getBodyById(event.bodyId);
                return (
                  <article key={event.id} className="rounded-2xl border border-border bg-white p-4 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <AppleEmoji name={body.appleEmoji} size={24} />
                        <div>
                          <h3 className="font-serif text-base font-bold text-ink">{event.title}</h3>
                          <p className="mt-1 text-xs text-ink-secondary">
                            {formatDateSpanish(event.startDate)}{event.startTime ? ` · ${formatTime12(event.startTime)}` : ''}
                          </p>
                          <p className="flex items-center gap-1 text-xs text-ink-muted"><MapPin className="h-3 w-3 text-primary shrink-0" /> {event.location}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase text-primary">
                        {event.status === 'convocada' ? 'Convocada' : 'Programada'}
                      </span>
                    </div>
                    <p className="mt-3 text-[11px] text-ink-muted">
                      {response === 'confirmada' ? 'Has indicado que asistirás.' : response === 'excusa' ? 'Has presentado una excusa.' : 'Aún no has respondido.'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleMemberMeetingResponse(event, 'presente')}
                        className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold ${response === 'confirmada' ? 'bg-success text-white' : 'border border-success/30 text-success hover:bg-success/10'}`}
                      >
                        {response === 'confirmada' ? 'Asistiré' : 'Confirmar asistencia'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleMemberMeetingResponse(event, 'excusa')}
                        className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold ${response === 'excusa' ? 'bg-amber-600 text-white' : 'border border-amber-300 text-amber-700 hover:bg-amber-50'}`}
                      >
                        {response === 'excusa' ? 'Excusa presentada' : 'Presentar excusa'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Contenido de asistencia: Solo cuando hay una tenida seleccionada */}
      {canManageAttendance && selectedEventId && (
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
            <p className="mt-1 text-[11px] text-ink-muted">
              {canManageAttendance
                ? 'Esta lista es el registro oficial. Secretaría, el Venerable Maestro o el Administrador autorizado seleccionan quién asistió.'
                : 'Puedes enviar tu confirmación o presentar una excusa. Esta respuesta no modifica el registro oficial de asistencia.'}
            </p>
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
                        isBeforeSelectedEvent() ? (
                          <button
                            type="button"
                            onClick={() => handleOpenExcuseEditor(m.id)}
                            className="text-[11px] font-semibold text-primary hover:underline"
                          >
                            Editar mi excusa
                          </button>
                        ) : (
                          <span className="text-[11px] font-medium text-ink-muted">Edición de excusa cerrada al iniciar el evento</span>
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
                          <button
                            type="button"
                            onClick={() => setViewingExcuse({
                              memberName: `${m.firstName} ${m.lastName}`,
                              reason: excuseReasons[m.id],
                            })}
                            className="max-w-xs text-left text-[11px] text-amber-800 hover:underline"
                          >
                            <span className="font-semibold">Excusa:</span> {excuseReasons[m.id]}
                          </button>
                        ) : (
                          <span className="text-[11px] font-medium text-amber-700">Excusa pendiente de explicación por el hermano</span>
                        )
                      ) : (
                        <span className="text-[11px] font-medium text-amber-700">Excusa registrada</span>
                      )
                    )}
                    {canManageAttendance && responseStatus && (
                      <>
                        <span className={`text-[11px] font-semibold ${responseStatus === 'confirmada' ? 'text-success' : 'text-amber-700'}`}>
                          Respuesta del hermano: {responseStatus === 'confirmada' ? 'Asistencia confirmada' : 'Presentó excusa'}
                        </span>
                        {responseStatus === 'excusa' && canViewExcuseReasons && (
                          memberResponseReasons[m.id] ? (
                            <button
                              type="button"
                              onClick={() => setViewingExcuse({
                                memberName: `${m.firstName} ${m.lastName}`,
                                reason: memberResponseReasons[m.id],
                              })}
                              className="max-w-xs text-left text-[11px] text-amber-800 hover:underline"
                            >
                              <span className="font-semibold">Ver motivo de la excusa:</span> {memberResponseReasons[m.id]}
                            </button>
                          ) : (
                            <span className="text-[11px] font-medium text-amber-700">Motivo de la excusa pendiente de explicación</span>
                          )
                        )}
                      </>
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

      <Modal
        isOpen={Boolean(viewingExcuse)}
        onClose={() => setViewingExcuse(null)}
        title="Excusa presentada"
        subtitle={selectedEvent?.title}
        maxWidth="sm"
      >
        {viewingExcuse && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-ink-muted">Hermano</p>
              <p className="text-sm font-semibold text-ink">{viewingExcuse.memberName}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">Motivo de la excusa</p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-amber-950">{viewingExcuse.reason}</p>
            </div>
            <div className="flex justify-end border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setViewingExcuse(null)}
                className="min-h-[40px] rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary-pressed"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
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
