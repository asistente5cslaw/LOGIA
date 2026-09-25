import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { minuteService } from '@/services/minuteService';
import { memberService } from '@/services/memberService';
import { eventService } from '@/services/eventService';
import { PageHeader } from '@/components/shared/PageHeader';
import type { Minute, MinuteStatus, MasonicDegree, Member, LodgeEvent } from '@/types';
import {
  Plus,
  Search,
  Eye,
  MessageSquare,
  Paperclip,
  X,
  Calendar,
  BookOpen,
  Trash2,
  CalendarDays,
} from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { AppleSelect, type AppleSelectOption } from '@/components/shared/AppleSelect';
import { AppleDatePicker } from '@/components/shared/AppleDatePicker';
import { AppleInput, AppleTextarea } from '@/components/shared/AppleInput';
import { AppleEmoji } from '@/components/shared/AppleEmoji';
import { useAppleDialog } from '@/components/shared/AppleDialog';
import { formatDateSpanish } from '@/lib/dateUtils';
import { toast } from 'sonner';

const minuteDegreeOptions: AppleSelectOption<MasonicDegree>[] = [
  { value: 'aprendiz', label: 'Primer Grado — Aprendiz', icon: <AppleEmoji name="ruler" size={16} /> },
  { value: 'companero', label: 'Segundo Grado — Compañero', icon: <AppleEmoji name="cross" size={16} /> },
  { value: 'maestro', label: 'Tercer Grado — Maestro', icon: <AppleEmoji name="temple" size={16} /> },
];

const minuteStatusOptions: AppleSelectOption<MinuteStatus>[] = [
  { value: 'borrador', label: 'Borrador', description: 'En redacción por Secretaría', color: '#F59E0B' },
  { value: 'circulada', label: 'Circulada', description: 'Compartida con los hermanos para observaciones', color: '#3B82F6' },
  { value: 'aprobada', label: 'Aprobada', description: 'Leída y sancionada en Tenida', color: '#10B981' },
];

export function MinutesPage() {
  const { user, hasPermission } = useAuth();
  const { showConfirm } = useAppleDialog();
  const [minutes, setMinutes] = useState<Minute[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<LodgeEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<MinuteStatus | 'all'>('all');
  const [selectedMinute, setSelectedMinute] = useState<Minute | null>(null);

  // Modal para redactar/editar acta
  const [showMinuteModal, setShowMinuteModal] = useState(false);
  const [editingMinute, setEditingMinute] = useState<Minute | null>(null);
  const [formEventId, setFormEventId] = useState('');
  const [formEventTitle, setFormEventTitle] = useState('');
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMeetingDate, setFormMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDegree, setFormDegree] = useState<MasonicDegree>('aprendiz');
  const [formStatus, setFormStatus] = useState<MinuteStatus>('borrador');
  const [formNotes, setFormNotes] = useState('');

  // Correcciones
  const [newComment, setNewComment] = useState('');

  const canManageMinutes = hasPermission('manage_minutes');
  const canApproveMinutes = hasPermission('approve');

  const currentMember = useMemo(() => {
    return members.find((m) => m.email.toLowerCase() === user?.email.toLowerCase());
  }, [members, user]);

  const loadData = async () => {
    try {
      const [mList, memList, evList] = await Promise.all([
        minuteService.getAllMinutes(),
        memberService.getAllMembers(true),
        eventService.getAllEvents(),
      ]);
      setMinutes(mList);
      setMembers(memList);
      setEvents(evList);
    } catch {
      toast.error('Error al cargar actas y eventos');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtrado y permisos de visualización
  const visibleMinutes = useMemo(() => {
    return minutes.filter((m) => {
      // Regla de seguridad: Si no tiene permiso de acceso por grado/individual, excluirlo
      const memberContext = {
        id: currentMember?.id || 'guest',
        degree: currentMember?.degree || 'aprendiz',
        roleId: user?.profile?.roleId || 'her',
      };

      const hasAccess = minuteService.canMemberAccessMinute(m, memberContext);
      if (!hasAccess) return false;

      if (statusFilter !== 'all' && m.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.formatNumber.toLowerCase().includes(q) ||
          m.title.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.meetingDate.includes(q) ||
          String(m.year).includes(q)
        );
      }

      return true;
    });
  }, [minutes, currentMember, user, statusFilter, searchQuery]);

  const handleOpenDetail = (min: Minute) => {
    setSelectedMinute(min);
    if (currentMember) {
      minuteService.markAsRead(min.id, currentMember.id);
    }
  };

  const meetingOptions: AppleSelectOption<string>[] = useMemo(() => [
    {
      value: '',
      label: 'Acta Independiente / Sin convocatoria previa',
      description: 'Crear trazado sin vincular a evento del calendario',
      icon: <AppleEmoji name="temple" size={16} />,
    },
    ...events.map((ev) => ({
      value: ev.id,
      label: `${ev.title} (${formatDateSpanish(ev.startDate)})`,
      description: `Cámara: ${ev.degreeRequired.toUpperCase()} • ${ev.location || 'Gran Templo Masónico'}`,
      icon: <AppleEmoji name="temple" size={16} />,
    })),
  ], [events]);

  const handleSelectMeeting = (eventId: string) => {
    setFormEventId(eventId);
    if (!eventId) {
      setFormEventTitle('');
      return;
    }
    const found = events.find((e) => e.id === eventId);
    if (found) {
      setFormEventTitle(found.title);
      setFormMeetingDate(found.startDate);
      setFormDegree(found.degreeRequired);
      if (!formTitle || formTitle.startsWith('Trazado de')) {
        setFormTitle(`Trazado de ${found.title}`);
      }
      if (!formDescription || formDescription.startsWith('A la Gloria del Gran Arquitecto del Universo...')) {
        setFormDescription(
          `A la Gloria del Gran Arquitecto del Universo...\n\nEn el Oriente de Panamá, el día ${formatDateSpanish(found.startDate)}, reunidos los hermanos en el ${found.location || 'Gran Templo Masónico'} para celebrar los trabajos de ${found.title}, bajo la dirección del Venerable Maestro.\n\n`
        );
      }
    }
  };

  const handleNewMinute = () => {
    setEditingMinute(null);
    setFormEventId('');
    setFormEventTitle('');
    setFormYear(new Date().getFullYear());
    setFormTitle('');
    setFormDescription('A la Gloria del Gran Arquitecto del Universo...\n\nEn el Oriente de Panamá, reunidos los hermanos en el Gran Templo Masónico...');
    setFormMeetingDate(new Date().toISOString().split('T')[0]);
    setFormDegree('aprendiz');
    setFormStatus('borrador');
    setFormNotes('');
    setShowMinuteModal(true);
  };

  const handleSaveMinute = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await minuteService.saveMinute(
        {
          id: editingMinute ? editingMinute.id : undefined,
          number: editingMinute ? editingMinute.number : undefined,
          formatNumber: editingMinute ? editingMinute.formatNumber : undefined,
          year: formYear,
          title: formTitle.trim(),
          description: formDescription.trim(),
          meetingDate: formMeetingDate,
          degree: formDegree,
          status: formStatus,
          eventId: formEventId || undefined,
          eventTitle: formEventTitle || undefined,
          notes: formNotes.trim(),
        },
        { id: user?.id, email: user?.email, name: user?.displayName }
      );

      toast.success(editingMinute ? 'Acta actualizada' : 'Acta creada con numeración consecutiva');
      setShowMinuteModal(false);
      loadData();
    } catch {
      toast.error('Error al guardar acta');
    }
  };

  const handleAddCorrection = async () => {
    if (!selectedMinute || !newComment.trim()) return;
    try {
      const corr = await minuteService.addCorrection(
        selectedMinute.id,
        newComment.trim(),
        { id: user?.id, email: user?.email, name: user?.displayName }
      );
      toast.success('Observación registrada en el acta');
      setNewComment('');
      // Actualizar detalle
      setSelectedMinute({
        ...selectedMinute,
        corrections: [...(selectedMinute.corrections || []), corr],
      });
      loadData();
    } catch {
      toast.error('Error al agregar observación');
    }
  };

  const handleStatusChange = async (min: Minute, newStatus: MinuteStatus) => {
    try {
      await minuteService.saveMinute(
        { ...min, status: newStatus },
        { id: user?.id, email: user?.email, name: user?.displayName }
      );
      toast.success(`Acta actualizada a estado: ${newStatus}`);
      if (selectedMinute?.id === min.id) {
        setSelectedMinute({ ...selectedMinute, status: newStatus });
      }
      loadData();
    } catch {
      toast.error('Error al cambiar estado');
    }
  };

  const handleDeleteMinute = async (minuteId: string, formatNumber: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirmed = await showConfirm({
      title: 'Eliminar Acta de Tenida',
      message: `¿Confirmas que deseas eliminar el acta No. ${formatNumber}? Esta acción retirará el acta del libro.`,
      confirmText: 'Eliminar Acta',
      cancelText: 'Cancelar',
      type: 'warning',
    });
    if (!confirmed) return;

    try {
      await minuteService.deleteMinute(minuteId, { id: user?.id, email: user?.email });
      toast.success('Acta eliminada exitosamente');
      if (selectedMinute?.id === minuteId) {
        setSelectedMinute(null);
      }
      loadData();
    } catch {
      toast.error('Error al eliminar el acta');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 pt-2.5 pb-6 sm:py-6 md:px-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <PageHeader
          title="Libro de Actas de Tenidas"
          subtitle="Trazados protocolarios foliados y sancionados"
        />

        {canManageMinutes && (
          <button
            onClick={handleNewMinute}
            className="w-full sm:w-auto flex flex-row min-h-[40px] items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-pressed transition-colors cursor-pointer active:scale-95 shrink-0 whitespace-nowrap flex-nowrap"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">Redactar Acta</span>
          </button>
        )}
      </div>

      {/* Búsqueda y Filtros de Estado */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por número (01-2026), año o asunto..."
            className="w-full min-h-[42px] rounded-xl border border-border bg-surface pl-10 pr-3 text-xs text-ink outline-none focus:border-primary shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
          {(['all', 'borrador', 'circulada', 'aprobada', 'firmada', 'archivada'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold capitalize transition-all min-h-[38px] whitespace-nowrap cursor-pointer shrink-0 ${
                statusFilter === st
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'border-border bg-surface text-ink-secondary hover:bg-surface-container'
              }`}
            >
              {st === 'all' ? 'Todas' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Actas */}
      <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="divide-y divide-border">
          {visibleMinutes.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">
              No se encontraron actas autorizadas para tu grado o con los filtros seleccionados.
            </div>
          ) : (
            visibleMinutes.map((m) => (
              <div
                key={m.id}
                onClick={() => handleOpenDetail(m)}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 hover:bg-surface-container-low/60 cursor-pointer transition-colors gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      Acta No. {m.formatNumber}
                    </span>
                    <span className="text-xs text-ink-muted">• Tenida del {formatDateSpanish(m.meetingDate)}</span>
                    <span className="rounded bg-surface-container px-2 py-0.5 text-[10px] font-semibold text-ink-secondary uppercase">
                      {m.degree}
                    </span>
                    {m.eventTitle && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        <CalendarDays className="h-3 w-3" />
                        <span className="truncate max-w-[200px]">{m.eventTitle}</span>
                      </span>
                    )}
                  </div>
                  <h4 className="font-serif text-base font-bold text-ink">{m.title}</h4>
                  <p className="text-xs text-ink-secondary line-clamp-2">{m.description}</p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${
                      m.status === 'firmada'
                        ? 'bg-success/15 text-success'
                        : m.status === 'aprobada'
                        ? 'bg-info/15 text-info'
                        : m.status === 'circulada'
                        ? 'bg-gold/20 text-amber-800'
                        : m.status === 'archivada'
                        ? 'bg-surface-container text-ink-muted'
                        : 'bg-surface-container text-ink-secondary'
                    }`}
                  >
                    {m.status}
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" /> Ver trazado
                    </span>
                    {canManageMinutes && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteMinute(m.id, m.formatNumber, e)}
                        className="p-1 rounded-lg text-ink-muted hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        title="Eliminar acta"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Detalle de Acta */}
      <Modal
        isOpen={Boolean(selectedMinute)}
        onClose={() => setSelectedMinute(null)}
        title={selectedMinute ? `Acta No. ${selectedMinute.formatNumber}` : ''}
        subtitle={selectedMinute ? `${selectedMinute.title} • Tenida: ${selectedMinute.meetingDate} (Grado: ${selectedMinute.degree})` : ''}
        maxWidth="xl"
      >
        {selectedMinute && (
          <div className="space-y-4">
            {selectedMinute.eventTitle && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-2.5 text-xs">
                <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="text-ink-muted text-[11px] block">Tenida / Convocatoria Asociada:</span>
                  <span className="font-semibold text-ink">{selectedMinute.eventTitle}</span>
                </div>
              </div>
            )}

            <div className="rounded-lg bg-surface-container-low p-4 text-xs text-ink leading-relaxed space-y-3 font-serif">
              <p className="whitespace-pre-line">{selectedMinute.description}</p>
              {selectedMinute.notes && (
                <div className="border-t border-border pt-2 text-[11px] text-ink-muted italic">
                  Notas de Secretaría: {selectedMinute.notes}
                </div>
              )}
            </div>

            {/* Adjunto PDF */}
            <div className="rounded-lg border border-border p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-primary" />
                <span className="font-medium text-ink">
                  {selectedMinute.pdfFileName || `Acta_${selectedMinute.formatNumber}.pdf`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => toast.info('Descarga de acta PDF autorizada para tu grado.')}
                className="text-primary font-semibold hover:underline"
              >
                Descargar PDF Seguro
              </button>
            </div>

            {/* Observaciones y Correcciones */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-gold" /> Observaciones y correcciones del Taller
              </h4>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {(!selectedMinute.corrections || selectedMinute.corrections.length === 0) ? (
                  <p className="text-[11px] text-ink-muted italic">Sin observaciones registradas.</p>
                ) : (
                  selectedMinute.corrections.map((corr) => (
                    <div key={corr.id} className="rounded bg-surface-container p-2 text-xs">
                      <span className="font-semibold text-ink">{corr.authorName}: </span>
                      <span className="text-ink-secondary">{corr.comment}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Agregar corrección */}
              <div className="flex gap-2 pt-1">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escribir observación al trazado..."
                  className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-ink outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={handleAddCorrection}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-pressed"
                >
                  Enviar
                </button>
              </div>
            </div>

            {/* Cambios de estado (Dignatarios / Administradores) */}
            {/* Acciones de Estado y Gestión */}
            <div className="border-t border-border pt-3 flex flex-wrap items-center justify-between gap-2">
              {canManageMinutes && (
                <button
                  type="button"
                  onClick={() => handleDeleteMinute(selectedMinute.id, selectedMinute.formatNumber)}
                  className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/15 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Eliminar Acta</span>
                </button>
              )}

              {canApproveMinutes && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-ink-secondary">Acciones:</span>
                  <div className="flex gap-2">
                    {selectedMinute.status === 'borrador' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedMinute, 'circulada')}
                        className="rounded bg-gold/20 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-gold/30"
                      >
                        Poner a circular
                      </button>
                    )}
                    {selectedMinute.status === 'circulada' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedMinute, 'aprobada')}
                        className="rounded bg-info/20 px-3 py-1 text-xs font-semibold text-info hover:bg-info/30"
                      >
                        Aprobar trazado
                      </button>
                    )}
                    {selectedMinute.status === 'aprobada' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedMinute, 'firmada')}
                        className="rounded bg-success/20 px-3 py-1 text-xs font-semibold text-success hover:bg-success/30"
                      >
                        Firmar y sancionar
                      </button>
                    )}
                    {selectedMinute.status === 'firmada' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedMinute, 'archivada')}
                        className="rounded border border-border px-3 py-1 text-xs font-semibold text-ink-secondary hover:bg-surface-container"
                      >
                        Archivar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Redactar Nueva Acta */}
      <Modal
        isOpen={showMinuteModal}
        onClose={() => setShowMinuteModal(false)}
        title="Redactar Nueva Acta"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveMinute} noValidate className="space-y-4">
          {/* Selector de Tenida / Convocatoria Asociada */}
          <AppleSelect<string>
            label="Tenida o Convocatoria Asociada"
            value={formEventId}
            onChange={handleSelectMeeting}
            options={meetingOptions}
            searchable={true}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <AppleDatePicker
              label="Fecha de Tenida *"
              required
              value={formMeetingDate}
              onChange={(val) => setFormMeetingDate(val)}
            />

            <AppleSelect<MasonicDegree>
              label="Cámara de Grado *"
              value={formDegree}
              onChange={setFormDegree}
              options={minuteDegreeOptions}
            />

            <AppleSelect<MinuteStatus>
              label="Estado Inicial del Trazado *"
              value={formStatus}
              onChange={setFormStatus}
              options={minuteStatusOptions}
            />
          </div>

          <AppleInput
            label="Asunto o Título del Trazado *"
            required
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Ej. Tenida Ordinaria de Primer Grado y Recepción"
          />

          <AppleTextarea
            label="Cuerpo del Trazado de Secretaría *"
            required
            rows={6}
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="A la Gloria del Gran Arquitecto del Universo... En el Oriente de Panamá, reunidos los hermanos en el Templo..."
          />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setShowMinuteModal(false)}
              className="min-h-[44px] px-5 rounded-xl border border-border text-xs font-semibold text-ink-secondary hover:bg-surface-container transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-6 rounded-xl bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary-pressed shadow-sm transition-all"
            >
              Guardar Trazado
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
