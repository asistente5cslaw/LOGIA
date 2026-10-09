import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { minuteService } from '@/services/minuteService';
import { memberService } from '@/services/memberService';
import { eventService } from '@/services/eventService';
import { convocationService } from '@/services/convocationService';
import { PageHeader } from '@/components/shared/PageHeader';
import type { Minute, MinuteStatus, MasonicDegree, Member, LodgeEvent } from '@/types';
import {
  Plus,
  Search,
  Eye,
  MessageSquare,
  Paperclip,
  Trash2,
  CalendarDays,
  Mail,
  Bell,
  ExternalLink,
  Download,
} from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { AppleSelect, type AppleSelectOption } from '@/components/shared/AppleSelect';
import { AppleInput, AppleTextarea } from '@/components/shared/AppleInput';
import { AppleEmoji } from '@/components/shared/AppleEmoji';
import { useAppleDialog } from '@/components/shared/AppleDialog';
import { formatDateSpanish } from '@/lib/dateUtils';
import { toast } from 'sonner';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { pushNotificationService } from '@/services/pushNotificationService';

export function MinutesPage() {
  const { user, hasPermission } = useAuth();
  const { showConfirm } = useAppleDialog();
  const [minutes, setMinutes] = useState<Minute[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<LodgeEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<MinuteStatus | 'all'>('all');
  const [selectedMinute, setSelectedMinute] = useState<Minute | null>(null);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

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
  const [formSegmentId, setFormSegmentId] = useState('');
  const [formStatus, setFormStatus] = useState<MinuteStatus>('borrador');
  const [formNotes, setFormNotes] = useState('');
  const [formPdfFile, setFormPdfFile] = useState<File | null>(null);

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

  useRealtimeRefresh(() => {
    void loadData();
  });

  // Filtrado y permisos de visualización
  const visibleMinutes = useMemo(() => {
    return minutes.filter((m) => {
      // Regla de seguridad: Si no tiene permiso de acceso por grado/individual, excluirlo
      const memberContext = {
        id: currentMember?.id || 'guest',
        degree: currentMember?.degree || 'aprendiz',
        roleId: user?.profile?.roleId || 'apr',
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
    setPdfViewerUrl(null);
    if (min.pdfUrl) {
      setIsLoadingPdf(true);
      void minuteService.getPdfViewerUrl(min.pdfUrl)
        .then((signedUrl) => {
          setPdfViewerUrl(signedUrl);
        })
        .catch(() => toast.error('No se pudo abrir el PDF del acta.'))
        .finally(() => setIsLoadingPdf(false));
    }
    if (user?.id) {
      minuteService.markAsRead(min.id, user.id).catch((error) => {
        console.warn('No se pudo registrar la lectura del acta:', error);
      });
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
      description: ev.location || 'Gran Templo Masónico',
      icon: <AppleEmoji name="temple" size={16} />,
    })),
  ], [events]);

  const handleSelectMeeting = (eventId: string) => {
    setFormEventId(eventId);
    if (!eventId) {
      setFormEventTitle('');
      setFormSegmentId('');
      return;
    }
    const found = events.find((e) => e.id === eventId);
    if (found) {
      setFormEventTitle(found.title);
      setFormMeetingDate(found.startDate);
      const firstSegment = found.degreeSegments?.[0];
      setFormDegree(firstSegment?.degree || found.degreeRequired);
      setFormSegmentId(firstSegment?.id || '');
      const dateLabel = formatDateSpanish(found.startDate);
      const naturalDateLabel = dateLabel.charAt(0).toLowerCase() + dateLabel.slice(1);
      if (!formTitle || formTitle.startsWith('Trazado de')) {
        setFormTitle(`Trazado de ${found.title}`);
      }
      if (!formDescription || formDescription.startsWith('A la Gloria del Gran Arquitecto del Universo...')) {
        setFormDescription(
          `A la Gloria del Gran Arquitecto del Universo...\n\nEn el Oriente de Panamá, el día ${naturalDateLabel}, reunidos los hermanos en el ${found.location || 'Gran Templo Masónico'}, se celebraron los trabajos de ${found.title}, bajo la dirección del Venerable Maestro.\n\n`
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
    setFormSegmentId('');
    setFormStatus('borrador');
    setFormNotes('');
    setFormPdfFile(null);
    setShowMinuteModal(true);
  };

  const handleSaveMinute = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const pushToAll = submitter?.value === 'push';
    const statusToSave = pushToAll && formStatus === 'borrador' ? 'circulada' : formStatus;
    try {
      const savedMinute = await minuteService.saveMinute(
        {
          id: editingMinute ? editingMinute.id : undefined,
          number: editingMinute ? editingMinute.number : undefined,
          formatNumber: editingMinute ? editingMinute.formatNumber : undefined,
          year: formYear,
          title: formTitle.trim(),
          description: formDescription.trim(),
          meetingDate: formMeetingDate,
          degree: formDegree,
          segmentId: formSegmentId || undefined,
          status: statusToSave,
          eventId: formEventId || undefined,
          eventTitle: formEventTitle || undefined,
          notes: formNotes.trim(),
        },
        { id: user?.id, email: user?.email, name: user?.displayName }
      );

      if (formPdfFile) {
        await minuteService.uploadPdf(savedMinute.id, formPdfFile);
      }

      const shouldNotify = pushToAll || (savedMinute.status !== 'borrador' && (!editingMinute || editingMinute.status === 'borrador'));
      let pushSent = false;
      if (shouldNotify) {
        try {
          await pushNotificationService.notifyNewMinute(savedMinute.title, savedMinute.formatNumber, savedMinute.degree);
          pushSent = true;
        } catch (notificationError) {
          console.warn('El acta se guardó, pero no se pudo enviar la notificación push:', notificationError);
        }
      }

      toast.success(
        pushToAll && pushSent
          ? 'Acta guardada y notificación push enviada'
          : editingMinute
            ? 'Acta actualizada'
            : 'Acta creada con numeración consecutiva'
      );
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
      if (min.status === 'borrador' && newStatus !== 'borrador') {
        try {
          await pushNotificationService.notifyNewMinute(min.title, min.formatNumber, min.degree);
        } catch (notificationError) {
          console.warn('El acta se actualizó, pero no se pudo enviar la notificación push:', notificationError);
        }
      }
      toast.success(`Acta actualizada a estado: ${newStatus}`);
      if (selectedMinute?.id === min.id) {
        setSelectedMinute({ ...selectedMinute, status: newStatus });
      }
      loadData();
    } catch {
      toast.error('Error al cambiar estado');
    }
  };

  const handleNotifyMinute = async (min: Minute) => {
    try {
      const result = await pushNotificationService.notifyNewMinute(min.title, min.formatNumber, min.degree);
      toast.success(result.sent > 0 ? 'Notificación push enviada' : 'No hay dispositivos push registrados para recibirla');
    } catch {
      toast.error('No se pudo enviar la notificación push');
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

  const generateMinuteEmailBody = (minute: Minute): string => {
    const minuteText = minute.description.trim();
    const notes = minute.notes?.trim() ? `\n\nNotas de Secretaría:\n${minute.notes.trim()}` : '';

    return `Estimados Hermanos:

Por este medio les remito adjunta el acta ${minute.formatNumber} de la reunión del ${formatDateSpanish(minute.meetingDate)} en ${minute.degree} grado.

Agradecemos nos hagan llegar sus comentarios y ajustes.

El acta deberá ser sometida a aprobación en la siguiente tenida.

Se adjunta el PDF del acta.

${minuteText}${notes}`;
  };

  const generateDraftMinuteEmailBody = (): string => {
    const dateLabel = formatDateSpanish(formMeetingDate);
    const notes = formNotes.trim() ? `\n\nNotas de Secretaría:\n${formNotes.trim()}` : '';

    return `Estimados Hermanos:

Por este medio les remito adjunta el acta de la reunión del ${dateLabel} en ${formDegree} grado.

Agradecemos nos hagan llegar sus comentarios y ajustes.

El acta deberá ser sometida a aprobación en la siguiente tenida.

Se adjunta el PDF del acta.

${formDescription.trim()}${notes}`;
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

            {/* Visor PDF */}
            <div className="rounded-lg border border-border p-3 space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-primary" />
                <span className="font-medium text-ink">
                  {selectedMinute.pdfUrl ? (selectedMinute.pdfFileName || `Acta_${selectedMinute.formatNumber}.pdf`) : 'No hay PDF adjunto'}
                </span>
              </div>
              {selectedMinute.pdfUrl && (
                isLoadingPdf ? (
                  <p className="py-8 text-center text-ink-muted">Cargando visor del PDF…</p>
                ) : pdfViewerUrl ? (
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-xl border border-border bg-white">
                      <iframe
                        src={pdfViewerUrl}
                        title={`Visor del acta ${selectedMinute.formatNumber}`}
                        className="block h-[60vh] min-h-[420px] w-full border-0"
                      />
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      <a
                        href={pdfViewerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary-pressed transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir PDF
                      </a>
                      <a
                        href={pdfViewerUrl}
                        download={selectedMinute.pdfFileName || `Acta_${selectedMinute.formatNumber}.pdf`}
                        className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-primary/30 bg-surface px-4 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Descargar PDF
                      </a>
                    </div>
                  </div>
                ) : pdfViewerUrl ? (
                  <p className="py-4 text-center text-destructive">No se pudo preparar el visor interno del PDF.</p>
                ) : (
                  <p className="py-4 text-center text-destructive">No se pudo cargar el visor.</p>
                )
              )}
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

              {canManageMinutes && (
                <a
                  href={convocationService.generateMailtoUrl(
                    `Acta ${selectedMinute.formatNumber} - ${selectedMinute.title}`,
                    generateMinuteEmailBody(selectedMinute),
                    members.filter((m) => m.isActive).map((m) => m.email)
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    window.location.assign(convocationService.generateMailtoUrl(
                      `Acta ${selectedMinute.formatNumber} - ${selectedMinute.title}`,
                      generateMinuteEmailBody(selectedMinute),
                      members.filter((m) => m.isActive).map((m) => m.email)
                    ));
                  }}
                  className="rounded-xl border border-info/30 bg-info/10 px-3 py-1.5 text-xs font-semibold text-info hover:bg-info/20 transition-colors flex items-center gap-1.5"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Enviar por correo
                </a>
              )}

              {(canApproveMinutes || canManageMinutes) && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-ink-secondary">Acciones:</span>
                  <div className="flex flex-wrap justify-end gap-2">
                    {canManageMinutes && (
                      <button
                        type="button"
                        onClick={() => handleNotifyMinute(selectedMinute)}
                        className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors flex items-center gap-1.5"
                      >
                        <Bell className="h-3.5 w-3.5" />
                        Push a todos
                      </button>
                    )}
                    {canApproveMinutes && (
                      <>
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
                      </>
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
          {/* Selector de reunión agendada */}
          <AppleSelect<string>
            label="Reunión agendada / Convocatoria asociada"
            value={formEventId}
            onChange={handleSelectMeeting}
            options={meetingOptions}
            searchable={true}
          />

          {formEventId && (events.find((event) => event.id === formEventId)?.degreeSegments?.length || 0) > 0 && (
            <AppleSelect<MasonicDegree>
              label="Tramo / grado del acta"
              value={formDegree}
              onChange={(degree) => {
                setFormDegree(degree);
                const segment = events.find((event) => event.id === formEventId)?.degreeSegments?.find((item) => item.degree === degree);
                setFormSegmentId(segment?.id || '');
              }}
              options={(events.find((event) => event.id === formEventId)?.degreeSegments || []).map((segment) => ({
                value: segment.degree,
                label: segment.degree === 'aprendiz' ? 'Primer grado — Aprendiz' : segment.degree === 'companero' ? 'Segundo grado — Compañero' : 'Tercer grado — Maestro',
                description: `Acta correspondiente al tramo ${segment.sequence} de la misma tenida`,
              }))}
            />
          )}

          <div className="rounded-lg border border-border bg-surface-container-low px-3 py-2.5 text-xs text-ink-secondary">
            {formEventId ? (
              <>
                <span className="font-semibold text-ink">Fecha, grado y reunión tomados del calendario:</span>{' '}
                {formatDateSpanish(formMeetingDate)} · {formDegree}
              </>
            ) : (
              <span>Selecciona una reunión agendada para asociar esta acta. Si es un acta independiente, se utilizará la fecha actual.</span>
            )}
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

          <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3">
            <label htmlFor="minute-pdf" className="flex items-center gap-2 text-xs font-semibold text-ink">
              <Paperclip className="h-4 w-4 text-primary" /> PDF del acta
            </label>
            <p className="mt-1 text-[11px] text-ink-muted">Sube el documento PDF para que los miembros autorizados lo vean dentro del sistema. Máximo 15 MB.</p>
            <input
              id="minute-pdf"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                if (file) {
                  const validation = minuteService.validatePdfFile(file);
                  if (!validation.valid) {
                    toast.error(validation.error);
                    event.currentTarget.value = '';
                    setFormPdfFile(null);
                    return;
                  }
                }
                setFormPdfFile(file);
              }}
              className="mt-2 block w-full text-xs text-ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary-pressed"
            />
            {formPdfFile && <p className="mt-2 text-[11px] font-medium text-success">PDF seleccionado: {formPdfFile.name}</p>}
          </div>

          <div className="flex flex-wrap justify-end gap-2.5 pt-3 border-t border-border">
            {canManageMinutes && (
              <a
                href={convocationService.generateMailtoUrl(
                  `Acta${editingMinute?.formatNumber ? ` ${editingMinute.formatNumber}` : ''} - ${formTitle || 'Reunión'}`,
                  generateDraftMinuteEmailBody(),
                  members.filter((m) => m.isActive).map((m) => m.email)
                )}
                onClick={(event) => {
                  event.preventDefault();
                  window.location.assign(convocationService.generateMailtoUrl(
                    `Acta${editingMinute?.formatNumber ? ` ${editingMinute.formatNumber}` : ''} - ${formTitle || 'Reunión'}`,
                    generateDraftMinuteEmailBody(),
                    members.filter((m) => m.isActive).map((m) => m.email)
                  ));
                }}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-info/30 bg-info/10 px-4 text-xs font-semibold text-info hover:bg-info/20 transition-colors"
              >
                <Mail className="h-3.5 w-3.5" />
                Correo
              </a>
            )}
            {canManageMinutes && (
              <button
                type="submit"
                value="push"
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-4 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                <Bell className="h-3.5 w-3.5" />
                Push a todos
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowMinuteModal(false)}
              className="min-h-[44px] px-5 rounded-xl border border-border text-xs font-semibold text-ink-secondary hover:bg-surface-container transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              value="save"
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
