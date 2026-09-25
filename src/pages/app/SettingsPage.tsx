import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { officialVisitService } from '@/services/officialVisitService';
import { memberService } from '@/services/memberService';
import { eventService } from '@/services/eventService';
import { minuteService } from '@/services/minuteService';
import { backupService, type ImportPreview } from '@/services/backupService';
import { auditService } from '@/services/auditService';
import { authService } from '@/services/authService';
import { institutionalRoles, permissionLabels } from '@/data/rolesData';
import { PageHeader } from '@/components/shared/PageHeader';
import type {
  LodgeSettings,
  OfficialVisitChecklistItem,
  OfficialVisitSummary,
  AuditLog,
  Invitation,
  InstitutionalRoleCode,
  MasonicDegree,
} from '@/types';
import {
  Settings,
  ShieldCheck,
  ClipboardCheck,
  Database,
  KeyRound,
  FileText,
  Download,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { AppleSelect } from '@/components/shared/AppleSelect';
import { AppleDatePicker } from '@/components/shared/AppleDatePicker';
import { toast } from 'sonner';

export function SettingsPage() {
  const { user, hasPermission, isSecretaryOrVM } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'visita' | 'configuracion' | 'permisos' | 'invitaciones' | 'respaldo' | 'auditoria'
  >('visita');

  // Visita Oficial & Configuración
  const [checklist, setChecklist] = useState<OfficialVisitChecklistItem[]>([]);
  const [summary, setSummary] = useState<OfficialVisitSummary | null>(null);
  const [lodgeSettings, setLodgeSettings] = useState<LodgeSettings | null>(null);

  // Invitaciones
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [newInvDegree, setNewInvDegree] = useState<MasonicDegree>('aprendiz');
  const [newInvRole, setNewInvRole] = useState<InstitutionalRoleCode>('her');
  const [newInvEmail, setNewInvEmail] = useState('');

  // Auditoría
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Respaldo e Importación
  const [importJsonText, setImportJsonText] = useState('');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [overwriteDuplicates, setOverwriteDuplicates] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const canConfigure = hasPermission('configure_lodge') || isSecretaryOrVM;

  const loadData = async () => {
    try {
      const [chkList, settings, memList, evList, minList, invList, logs] = await Promise.all([
        officialVisitService.getChecklist(),
        officialVisitService.getLodgeSettings(),
        memberService.getAllMembers(true),
        eventService.getAllEvents(),
        minuteService.getAllMinutes(),
        authService.getInvitations(),
        auditService.getLogs(30),
      ]);

      setChecklist(chkList);
      setLodgeSettings(settings);
      setInvitations(invList);
      setAuditLogs(logs);

      const calculatedSummary = officialVisitService.computeAutomaticSummary(
        memList,
        evList,
        minList,
        [],
        chkList
      );
      setSummary(calculatedSummary);
    } catch {
      toast.error('Error al cargar ajustes');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleChecklistItem = async (item: OfficialVisitChecklistItem) => {
    if (!canConfigure) {
      toast.error('No tienes permisos para modificar el checklist de inspección.');
      return;
    }

    try {
      const updatedCompleted = !item.completed;
      await officialVisitService.updateChecklistItem(
        item.id,
        updatedCompleted,
        item.notes,
        { id: user?.id, email: user?.email }
      );

      setChecklist((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, completed: updatedCompleted } : i))
      );
      toast.success(`Elemento '${item.title}' actualizado`);
      loadData();
    } catch {
      toast.error('Error al actualizar checklist');
    }
  };

  const handleSaveLodgeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lodgeSettings) return;

    try {
      await officialVisitService.updateLodgeSettings(lodgeSettings, {
        id: user?.id,
        email: user?.email,
      });
      toast.success('Configuración de la logia guardada con éxito');
    } catch {
      toast.error('Error al guardar configuración');
    }
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await authService.createInvitation(
        newInvDegree,
        newInvRole,
        newInvEmail.trim() || undefined,
        { id: user?.id, email: user?.email }
      );
      setInvitations((prev) => [created, ...prev]);
      setNewInvEmail('');
      toast.success(`Código de invitación generado: ${created.code}`);
    } catch {
      toast.error('Error al generar invitación');
    }
  };

  const handleExportFullBackup = async () => {
    try {
      const json = await backupService.generateFullJsonBackup({
        id: user?.id,
        email: user?.email,
      });
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Respaldo_Total_Logia_UF21_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Respaldo integral JSON exportado exitosamente');
    } catch {
      toast.error('Error al generar respaldo JSON');
    }
  };

  const handlePreviewImport = async () => {
    if (!importJsonText.trim()) return;
    const preview = await backupService.previewImportJson(importJsonText);
    setImportPreview(preview);
    if (!preview.valid) {
      toast.error('El archivo JSON contiene errores de esquema.');
    } else {
      toast.info('Vista previa del respaldo lista para confirmación.');
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview?.parsedData) return;
    setIsImporting(true);
    try {
      const res = await backupService.applyImportBackup(
        importPreview.parsedData,
        overwriteDuplicates,
        { id: user?.id, email: user?.email }
      );

      toast.success(
        `Restauración finalizada: ${res.importedMembers} miembros, ${res.importedEvents} eventos, ${res.importedMinutes} actas.`
      );
      setImportPreview(null);
      setImportJsonText('');
      loadData();
    } catch {
      toast.error('Error aplicando respaldo');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 pt-2.5 pb-6 sm:py-6 md:px-8 max-w-7xl mx-auto">
      <PageHeader
        title="Ajustes de la Logia e Inspección Oficial"
        subtitle="Configuración institucional, auditoría y control de visita de Gran Logia"
      />

      {/* Selector de Sección Inteligente estilo Apple */}
      {(() => {
        const settingsTabs = [
          { id: 'visita' as const, label: 'Visita Oficial de Gran Logia', shortLabel: 'Visita Oficial', icon: ClipboardCheck },
          { id: 'configuracion' as const, label: 'Parámetros del Taller', shortLabel: 'Parámetros', icon: Settings },
          { id: 'permisos' as const, label: 'Matriz de Permisos', shortLabel: 'Permisos', icon: ShieldCheck },
          ...(isSecretaryOrVM
            ? [{ id: 'invitaciones' as const, label: 'Códigos de Invitación', shortLabel: 'Invitaciones', icon: KeyRound }]
            : []),
          { id: 'respaldo' as const, label: 'Respaldo y Restauración', shortLabel: 'Respaldos', icon: Database },
          { id: 'auditoria' as const, label: 'Reportes y Auditoría', shortLabel: 'Auditoría', icon: FileText },
        ];

        return (
          <div className="pb-1 border-b border-border">
            {/* Vista móvil: Selector desplegable limpio sin scroll horizontal */}
            <div className="sm:hidden">
              <AppleSelect
                value={activeTab}
                onChange={(val) => setActiveTab(val as typeof activeTab)}
                options={settingsTabs.map((tab) => ({
                  value: tab.id,
                  label: tab.label,
                  icon: <tab.icon className="h-4 w-4 text-primary" />,
                }))}
              />
            </div>

            {/* Vista escritorio: Control segmentado nativo Apple */}
            <div className="hidden sm:inline-flex items-center gap-1 rounded-2xl bg-surface-container-low p-1.5 border border-border/70 shadow-2xs">
              {settingsTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex min-h-[36px] items-center gap-2 rounded-xl px-3.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                        : 'text-ink-secondary hover:text-ink hover:bg-surface-container'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{tab.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 1. VISITA OFICIAL DE INSPECCIÓN */}
      {activeTab === 'visita' && (
        <div className="space-y-6">
          {/* Tarjeta de Resumen Automático */}
          <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-gold-dark text-amber-800">
                  Cálculo Automatizado del Sistema
                </span>
                <h3 className="font-serif text-xl font-bold text-ink">
                  Resumen Oficial para la Comisión Inspectora
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-muted">Alistamiento del Taller:</span>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                  {summary?.overallReadiness || 0}%
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <div className="rounded-lg bg-surface-container-low p-3.5 border border-border/60">
                <span className="text-xs text-ink-muted">Miembros Activos</span>
                <p className="mt-1 font-serif text-xl font-bold text-ink">{summary?.activeMembersCount || 0}</p>
                <span className="text-[10px] text-success flex items-center gap-1 mt-0.5">
                  <CheckCircle className="h-3 w-3" /> Fichas al día
                </span>
              </div>

              <div className="rounded-lg bg-surface-container-low p-3.5 border border-border/60">
                <span className="text-xs text-ink-muted">Tenidas Celebradas</span>
                <p className="mt-1 font-serif text-xl font-bold text-ink">{summary?.regularMeetingsHeld || 0}</p>
                <span className="text-[10px] text-ink-secondary mt-0.5 block">Año masónico actual</span>
              </div>

              <div className="rounded-lg bg-surface-container-low p-3.5 border border-border/60">
                <span className="text-xs text-ink-muted">Actas Aprobadas</span>
                <p className="mt-1 font-serif text-xl font-bold text-ink">{summary?.approvedMinutesCount || 0}</p>
                <span className="text-[10px] text-ink-muted mt-0.5 block">
                  {summary?.pendingMinutesCount || 0} pendientes
                </span>
              </div>

              <div className="rounded-lg bg-surface-container-low p-3.5 border border-border/60">
                <span className="text-xs text-ink-muted">Promedio de Asistencia</span>
                <p className="mt-1 font-serif text-xl font-bold text-primary">
                  {summary?.averageAttendancePercentage || 0}%
                </p>
                <span className="text-[10px] text-ink-secondary mt-0.5 block">Excluye actos profanos</span>
              </div>
            </div>
          </div>

          {/* Checklist de 8 Elementos Obligatorios */}
          <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-ink">Checklist de 8 Elementos de Inspección</h3>
                <p className="text-xs text-ink-secondary">
                  Revisión obligatoria reglamentaria para la visita oficial de Gran Logia
                </p>
              </div>
              <span className="text-xs font-semibold text-primary">
                {checklist.filter((c) => c.completed).length} de 8 completados
              </span>
            </div>

            <div className="divide-y divide-border/60">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-container text-[11px] font-bold text-ink">
                        {item.id}
                      </span>
                      <h4 className="text-sm font-bold text-ink">{item.title}</h4>
                      {/* Diferenciación visual clara entre datos calculados vs manuales */}
                      {item.id <= 2 ? (
                        <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase">
                          Calculado
                        </span>
                      ) : (
                        <span className="rounded bg-surface-container text-ink-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase">
                          Manual
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-secondary">{item.description}</p>
                    {item.notes && <p className="text-[11px] text-ink-muted italic">«{item.notes}»</p>}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleChecklistItem(item)}
                    className={`min-h-[38px] px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto ${
                      item.completed
                        ? 'bg-success text-white shadow-xs'
                        : 'border border-border text-ink-secondary hover:bg-surface-container'
                    }`}
                  >
                    {item.completed ? (
                      <>
                        <CheckCircle className="h-4 w-4" /> Conforme
                      </>
                    ) : (
                      'Pendiente'
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. PARÁMETROS DEL TALLER */}
      {activeTab === 'configuracion' && lodgeSettings && (
        <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card max-w-3xl">
          <h3 className="font-serif text-lg font-bold text-ink border-b border-border pb-3">
            Datos Institucionales de la Logia
          </h3>

          <form onSubmit={handleSaveLodgeSettings} noValidate className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink">Nombre de la Logia</label>
                <input
                  required
                  value={lodgeSettings.lodgeName}
                  onChange={(e) => setLodgeSettings({ ...lodgeSettings, lodgeName: e.target.value })}
                  className="min-h-[40px] rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink">Número de Taller</label>
                <input
                  type="number"
                  required
                  value={lodgeSettings.lodgeNumber}
                  onChange={(e) => setLodgeSettings({ ...lodgeSettings, lodgeNumber: Number(e.target.value) })}
                  className="min-h-[40px] rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink">Oriente Masónico</label>
                <input
                  value={lodgeSettings.orient}
                  onChange={(e) => setLodgeSettings({ ...lodgeSettings, orient: e.target.value })}
                  className="min-h-[40px] rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink">Rito de Trabajo</label>
                <input
                  value={lodgeSettings.rite}
                  onChange={(e) => setLodgeSettings({ ...lodgeSettings, rite: e.target.value })}
                  className="min-h-[40px] rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AppleDatePicker
                  label="Fecha de Carta Patente"
                  value={lodgeSettings.charterDate}
                  onChange={(val) => setLodgeSettings({ ...lodgeSettings, charterDate: val })}
                />

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink">Días de Tenida Habituales</label>
                <input
                  value={lodgeSettings.regularMeetingDays}
                  onChange={(e) => setLodgeSettings({ ...lodgeSettings, regularMeetingDays: e.target.value })}
                  className="min-h-[40px] rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink">Dirección del Templo</label>
              <input
                value={lodgeSettings.templeAddress}
                onChange={(e) => setLodgeSettings({ ...lodgeSettings, templeAddress: e.target.value })}
                className="min-h-[40px] rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink">Correo Oficial de Contacto</label>
              <input
                type="email"
                value={lodgeSettings.contactEmail}
                onChange={(e) => setLodgeSettings({ ...lodgeSettings, contactEmail: e.target.value })}
                className="min-h-[40px] rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-primary"
              />
            </div>

            <div className="pt-3 border-t border-border flex justify-end">
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary-pressed shadow-sm"
              >
                Guardar Ajustes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. MATRIZ DE PERMISOS */}
      {activeTab === 'permisos' && (
        <div className="rounded-2xl border border-border bg-white p-4 sm:p-6 shadow-xs space-y-4">
          <div className="border-b border-border pb-3">
            <h3 className="font-serif text-lg font-bold text-ink">Matriz Institucional de Permisos</h3>
            <p className="text-xs text-ink-secondary">
              Separación técnica entre cargo protocolar masónico, rol técnico del sistema y permisos granulares.
            </p>
          </div>

          {/* VISTA MÓVIL: Tarjetas Apple Legibles sin choques ni aplastamientos */}
          <div className="space-y-3 sm:hidden">
            {institutionalRoles.map((r) => {
              const catStyle =
                r.category === 'dignatario'
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : r.category === 'oficial'
                  ? 'bg-amber-500/10 text-amber-800 border-amber-500/20'
                  : 'bg-zinc-100 text-zinc-700 border-zinc-200';

              return (
                <div
                  key={r.id}
                  className="rounded-2xl border border-border bg-surface-container-low/50 p-4 space-y-2.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-serif text-sm font-bold text-ink">{r.name}</h4>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${catStyle}`}
                    >
                      {r.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-ink-secondary">
                    <span className="text-[11px] text-ink-muted">Rol técnico:</span>
                    <span className="rounded-md bg-white border border-border px-2 py-0.5 text-[10px] font-mono font-semibold text-primary">
                      {r.technicalRole}
                    </span>
                  </div>

                  <div className="pt-1 border-t border-border/50">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
                      Permisos Asignados ({r.defaultPermissions.length}):
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {r.defaultPermissions.map((p) => (
                        <span
                          key={p}
                          className="rounded-lg bg-white border border-border px-2 py-0.5 text-[10px] font-medium text-ink-secondary shadow-2xs"
                          title={permissionLabels[p]?.description}
                        >
                          {permissionLabels[p]?.title || p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* VISTA ESCRITORIO: Tabla amplia con protección de ancho mínimo */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[680px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-container-low text-ink-muted">
                  <th className="py-3 px-4 font-semibold">Cargo Institucional</th>
                  <th className="py-3 px-4 font-semibold">Categoría</th>
                  <th className="py-3 px-4 font-semibold">Rol Técnico</th>
                  <th className="py-3 px-4 font-semibold">Permisos Asignados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {institutionalRoles.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-ink">{r.name}</td>
                    <td className="py-3.5 px-4 capitalize text-ink-secondary">
                      <span className="rounded-full bg-surface-container border border-border px-2 py-0.5 text-[10px] font-medium">
                        {r.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="rounded-lg bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-mono font-bold text-primary">
                        {r.technicalRole}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {r.defaultPermissions.map((p) => (
                          <span
                            key={p}
                            className="rounded-md bg-surface-container-low border border-border px-2 py-0.5 text-[10px] font-medium text-ink-secondary"
                            title={permissionLabels[p]?.description}
                          >
                            {permissionLabels[p]?.title || p}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. INVITACIONES (Secretario / Venerable Maestro) */}
      {activeTab === 'invitaciones' && isSecretaryOrVM && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card max-w-xl">
            <h3 className="font-serif text-lg font-bold text-ink border-b border-border pb-3">
              Generar Código de Invitación
            </h3>
            <p className="text-xs text-ink-secondary mt-1">
              Permite a un hermano registrarse pasando la validación facial obligatoria.
            </p>

            <form onSubmit={handleCreateInvitation} noValidate className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-ink">Grado de Ingreso</label>
                  <select
                    value={newInvDegree}
                    onChange={(e) => setNewInvDegree(e.target.value as MasonicDegree)}
                    className="min-h-[40px] rounded-lg border border-border bg-surface px-2 text-xs text-ink outline-none focus:border-primary"
                  >
                    <option value="aprendiz">Aprendiz</option>
                    <option value="companero">Compañero</option>
                    <option value="maestro">Maestro</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-ink">Cargo Asignado</label>
                  <select
                    value={newInvRole}
                    onChange={(e) => setNewInvRole(e.target.value as InstitutionalRoleCode)}
                    className="min-h-[40px] rounded-lg border border-border bg-surface px-2 text-xs text-ink outline-none focus:border-primary"
                  >
                    {institutionalRoles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink">Correo Destinatario (Opcional)</label>
                <input
                  type="email"
                  value={newInvEmail}
                  onChange={(e) => setNewInvEmail(e.target.value)}
                  placeholder="hermano@correo.org"
                  className="min-h-[40px] rounded-lg border border-border bg-surface px-3 text-xs text-ink outline-none focus:border-primary"
                />
              </div>

              <button
                type="submit"
                className="min-h-[44px] w-full rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary-pressed shadow-sm"
              >
                Generar Invitación Oficial
              </button>
            </form>
          </div>

          {/* Listado de invitaciones */}
          <div className="rounded-xl border border-border bg-surface shadow-card p-5">
            <h4 className="font-serif text-base font-bold text-ink mb-3">Historial de Códigos</h4>
            <div className="divide-y divide-border/60">
              {invitations.length === 0 ? (
                <p className="text-xs text-ink-muted py-4">No hay invitaciones emitidas.</p>
              ) : (
                invitations.map((inv) => (
                  <div key={inv.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-primary">{inv.code}</span>
                      <p className="text-[11px] text-ink-muted">
                        Grado: {inv.degree} • Cargo: {inv.roleId} • Expira: {inv.expiresAt.split('T')[0]}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        inv.isUsed
                          ? 'bg-surface-container text-ink-muted'
                          : 'bg-success/15 text-success'
                      }`}
                    >
                      {inv.isUsed ? 'Utilizada' : 'Activa'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. RESPALDO Y RESTAURACIÓN */}
      {activeTab === 'respaldo' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card space-y-4">
            <h3 className="font-serif text-lg font-bold text-ink border-b border-border pb-3">
              Exportación de Datos del Taller
            </h3>
            <p className="text-xs text-ink-secondary">
              Descarga copias de seguridad de las actas, miembros y configuración institucional.
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                onClick={handleExportFullBackup}
                className="flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-pressed"
              >
                <Download className="h-4 w-4" /> Exportar Respaldo Completo (JSON)
              </button>

              <button
                onClick={async () => {
                  const csv = await backupService.exportMinutesCSV();
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Actas_Logia_UF21_${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  toast.success('Libro de actas exportado a CSV');
                }}
                className="flex min-h-[44px] items-center gap-2 rounded-lg border border-border px-4 text-xs font-semibold text-ink hover:bg-surface-container"
              >
                <FileText className="h-4 w-4" /> Exportar Actas (CSV)
              </button>
            </div>
          </div>

          {/* Restauración con Vista Previa */}
          <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card space-y-4">
            <h3 className="font-serif text-lg font-bold text-ink border-b border-border pb-3">
              Restaurar Respaldo JSON con Vista Previa
            </h3>
            <p className="text-xs text-ink-secondary">
              Pega el archivo de respaldo para verificar su integridad antes de aplicar cambios:
            </p>

            <textarea
              rows={5}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Pega el contenido JSON del respaldo aquí..."
              className="w-full rounded-lg border border-border bg-surface-container-low p-3 font-mono text-xs text-ink outline-none focus:border-primary"
            />

            <div className="flex gap-2">
              <button
                onClick={handlePreviewImport}
                className="min-h-[40px] px-4 rounded-lg bg-ink text-surface text-xs font-semibold hover:bg-ink/80"
              >
                Analizar y Generar Vista Previa
              </button>
            </div>

            {/* Vista Previa del Respaldo */}
            {importPreview && (
              <div className="mt-4 rounded-xl border border-border bg-surface-container-low p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-ink">Resultado del Análisis de Respaldo</h4>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      importPreview.valid ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                    }`}
                  >
                    {importPreview.valid ? 'Estructura Válida' : 'Inválido'}
                  </span>
                </div>

                {importPreview.valid ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 bg-surface rounded">
                      <span className="text-ink-muted">Miembros:</span>{' '}
                      <strong>{importPreview.membersCount}</strong>
                    </div>
                    <div className="p-2 bg-surface rounded">
                      <span className="text-ink-muted">Eventos:</span>{' '}
                      <strong>{importPreview.eventsCount}</strong>
                    </div>
                    <div className="p-2 bg-surface rounded">
                      <span className="text-ink-muted">Actas:</span>{' '}
                      <strong>{importPreview.minutesCount}</strong>
                    </div>
                    <div className="p-2 bg-surface rounded">
                      <span className="text-ink-muted">Duplicados:</span>{' '}
                      <strong>{importPreview.duplicateMembers}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-destructive space-y-1">
                    {importPreview.errors.map((err, i) => (
                      <p key={i}>• {err}</p>
                    ))}
                  </div>
                )}

                {importPreview.valid && (
                  <div className="pt-2 border-t border-border space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-ink font-medium">
                      <input
                        type="checkbox"
                        checked={overwriteDuplicates}
                        onChange={(e) => setOverwriteDuplicates(e.target.checked)}
                        className="h-4 w-4 rounded text-primary"
                      />
                      Sobrescribir registros existentes si coincide el correo
                    </label>

                    <button
                      onClick={handleConfirmImport}
                      disabled={isImporting}
                      className="min-h-[44px] px-5 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary-pressed shadow-sm disabled:opacity-60"
                    >
                      {isImporting ? 'Aplicando restauración…' : 'Confirmar y Restaurar Datos'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. REGISTRO DE AUDITORÍA */}
      {activeTab === 'auditoria' && (
        <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card space-y-4">
          <div className="border-b border-border pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-bold text-ink">Registro de Trazabilidad y Auditoría</h3>
              <p className="text-xs text-ink-secondary">Registro inmutable de quién modificó qué y cuándo</p>
            </div>
            <button
              onClick={loadData}
              className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Actualizar
            </button>
          </div>

          <div className="divide-y divide-border/60">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-ink-muted py-6 text-center">No hay registros de auditoría aún.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                  <div>
                    <span className="font-mono font-bold text-primary uppercase">{log.action}</span>
                    <span className="text-ink-muted"> sobre entidad </span>
                    <strong className="text-ink">{log.entity}</strong>
                    {log.details && (
                      <span className="text-ink-secondary block text-[11px] truncate max-w-lg mt-0.5">
                        {JSON.stringify(log.details)}
                      </span>
                    )}
                  </div>
                  <div className="text-right sm:text-right self-start sm:self-auto text-[11px] text-ink-muted">
                    <p>{log.userEmail}</p>
                    <p>{new Date(log.createdAt).toLocaleString('es-PA')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
