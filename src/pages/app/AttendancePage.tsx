import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { eventService } from '@/services/eventService';
import { memberService } from '@/services/memberService';
import { attendanceService } from '@/services/attendanceService';
import { PageHeader } from '@/components/shared/PageHeader';
import type { LodgeEvent, Member, AttendanceStatus, VisitorAttendance, MasonicDegree } from '@/types';
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

const visitorDegreeOptions: AppleSelectOption<MasonicDegree>[] = [
  { value: 'aprendiz', label: 'Primer Grado — Aprendiz', icon: <AppleEmoji name="ruler" size={16} /> },
  { value: 'companero', label: 'Segundo Grado — Compañero', icon: <AppleEmoji name="cross" size={16} /> },
  { value: 'maestro', label: 'Tercer Grado — Maestro', icon: <AppleEmoji name="temple" size={16} /> },
];

export function AttendancePage() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [meetings, setMeetings] = useState<LodgeEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [members, setMembers] = useState<Member[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [visitors, setVisitors] = useState<VisitorAttendance[]>([]);
  const [searchMember, setSearchMember] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Modal para agregar visitante
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [visName, setVisName] = useState('');
  const [visLodge, setVisLodge] = useState('');
  const [visDegree, setVisDegree] = useState<MasonicDegree>('maestro');
  const [visNotes, setVisNotes] = useState('');

  const canManageAttendance = hasPermission('manage_attendance');

  useEffect(() => {
    async function loadInitial() {
      try {
        const [evList, memList] = await Promise.all([
          eventService.getAllEvents(),
          memberService.getAllMembers(false), // Solo activos
        ]);

        // Filtrar SOLO eventos que sean tenidas rituales
        const meetingEvents = evList.filter((e) => e.isMeeting && e.status !== 'cancelada');
        setMeetings(meetingEvents);
        setMembers(memList);
      } catch {
        toast.error('Error al cargar datos de asistencia');
      }
    }
    loadInitial();
  }, []);

  // Cargar asistencia del evento seleccionado
  useEffect(() => {
    if (!selectedEventId) {
      setAttendanceMap({});
      setVisitors([]);
      return;
    }

    async function loadAttendanceForSelected() {
      try {
        const [records, visList] = await Promise.all([
          attendanceService.getAttendanceForEvent(selectedEventId),
          attendanceService.getVisitorsForEvent(selectedEventId),
        ]);

        const map: Record<string, AttendanceStatus> = {};
        members.forEach((m) => {
          const rec = records.find((r) => r.memberId === m.id);
          map[m.id] = rec ? rec.status : 'ausente';
        });

        setAttendanceMap(map);
        setVisitors(visList);
      } catch {
        console.error('Error cargando asistencia del evento');
      }
    }

    loadAttendanceForSelected();
  }, [selectedEventId, members]);

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

  const handleStatusToggle = (memberId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [memberId]: status,
    }));
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, AttendanceStatus> = {};
    members.forEach((m) => {
      updated[m.id] = 'presente';
    });
    setAttendanceMap(updated);
    toast.info('Se han marcado todos los hermanos presentes.');
  };

  const handleSaveAttendance = async () => {
    if (!selectedEventId) return;
    setIsSaving(true);
    try {
      const records = Object.entries(attendanceMap).map(([memberId, status]) => ({
        memberId,
        status,
      }));

      await attendanceService.saveAttendanceBatch(selectedEventId, records, {
        id: user?.id,
        email: user?.email,
      });

      toast.success('Lista de asistencia guardada correctamente.');
    } catch {
      toast.error('Error al guardar la asistencia');
    } finally {
      setIsSaving(false);
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
              No hay Tenidas agendadas en el Calendario
            </h4>
            <p className="text-xs text-ink-muted max-w-md mx-auto mt-1">
              Para registrar la asistencia de los hermanos, primero programa una tenida ritual en el Calendario Masónico.
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
            Selecciona la Tenida a registrar:
          </label>
          <AppleSelect
            value={selectedEventId}
            onChange={(val) => setSelectedEventId(val)}
            placeholder="Elige una tenida para registrar asistencia..."
            options={meetings.map((m) => ({
              value: m.id,
              label: `${formatDateSpanish(m.startDate)} ${m.startTime ? `(${formatTime12(m.startTime)})` : ''} — ${m.title}`,
              badge: m.status,
              icon: <AppleEmoji name="temple" size={16} />
            }))}
          />
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
              Ninguna tenida seleccionada
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
              const currentStatus = attendanceMap[m.id] || 'ausente';
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
                      <p className="text-[11px] text-ink-muted uppercase">Grado: {m.degree}</p>
                    </div>
                  </div>

                  {/* Botones de estado: Presente, Excusa, Ausente */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      type="button"
                      disabled={!canManageAttendance}
                      onClick={() => handleStatusToggle(m.id, 'presente')}
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
                      disabled={!canManageAttendance}
                      onClick={() => handleStatusToggle(m.id, 'excusa')}
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
