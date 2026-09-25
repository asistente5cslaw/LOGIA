import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { memberService } from '@/services/memberService';
import { authService } from '@/services/authService';
import { institutionalRoles } from '@/data/rolesData';
import { PageHeader } from '@/components/shared/PageHeader';
import type { Member, MasonicDegree, MemberStatusCondition, InstitutionalRoleCode } from '@/types';
import {
  Search,
  Edit,
  Trash2,
  User,
  Mail,
  Phone,
  Award,
  FileText,
  Compass,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Camera,
  Check,
  X,
} from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { AppleSelect, type AppleSelectOption } from '@/components/shared/AppleSelect';
import { AppleInput } from '@/components/shared/AppleInput';
import { AppleEmoji } from '@/components/shared/AppleEmoji';
import { useAppleDialog } from '@/components/shared/AppleDialog';
import { formatDateSpanish } from '@/lib/dateUtils';
import { toast } from 'sonner';

const degreeOptions: AppleSelectOption<MasonicDegree>[] = [
  { value: 'aprendiz', label: 'Primer Grado — Aprendiz', icon: <AppleEmoji name="ruler" size={16} /> },
  { value: 'companero', label: 'Segundo Grado — Compañero', icon: <AppleEmoji name="cross" size={16} /> },
  { value: 'maestro', label: 'Tercer Grado — Maestro', icon: <AppleEmoji name="temple" size={16} /> },
];

const conditionOptions: AppleSelectOption<MemberStatusCondition>[] = [
  { value: 'activo', label: 'Activo', color: '#10B981', description: 'Plenos derechos en el taller' },
  { value: 'ad_vitam', label: 'Ad Vitam', color: '#8B5CF6', description: 'Exento por méritos o antigüedad' },
  { value: 'dual', label: 'Dual', color: '#F59E0B', description: 'Afiliado a otra logia hermana' },
  { value: 'inactivo', label: 'Inactivo', color: '#6B7280', description: 'Sin actividad regular' },
];

const roleOptions: AppleSelectOption<InstitutionalRoleCode>[] = institutionalRoles.map((r) => ({
  value: r.id,
  label: r.name,
}));

type FilterTab = 'todos' | 'pendientes' | 'aprendiz' | 'companero' | 'maestro';

export function MembersPage() {
  const { user, hasPermission } = useAuth();
  const { showConfirm } = useAppleDialog();
  const [members, setMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('todos');

  // Modales
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Modal Rápido de Asignar / Cambiar Cargo o Rol
  const [roleModalMember, setRoleModalMember] = useState<Member | null>(null);
  const [roleModalSelectedId, setRoleModalSelectedId] = useState<InstitutionalRoleCode>('her');
  const [isSavingRole, setIsSavingRole] = useState(false);

  // Modal de Validación de Identidad (Secretaría / Venerable Maestro)
  const [validatingMember, setValidatingMember] = useState<Member | null>(null);
  const [validationNotes, setValidationNotes] = useState('');
  const [isProcessingValidation, setIsProcessingValidation] = useState(false);

  // Formulario de Miembro
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRoleId, setFormRoleId] = useState<InstitutionalRoleCode>('her');
  const [formDegree, setFormDegree] = useState<MasonicDegree>('aprendiz');
  const [formCondition, setFormCondition] = useState<MemberStatusCondition>('activo');
  const [formMotherLodge, setFormMotherLodge] = useState('Resp.·. Log.·. Unión Fraternal No. 21');
  const [formInitiationDate, setFormInitiationDate] = useState('');
  const [formDiplomaNumber, setFormDiplomaNumber] = useState('');
  const [formPassportNumber, setFormPassportNumber] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const isVenerableMaestro = user?.profile?.roleId === 'vm';
  const isSecretario = user?.profile?.roleId === 'sec';
  const canManageMembers = hasPermission('manage_members') || isVenerableMaestro || isSecretario;

  // El Secretario y el Venerable Maestro pueden validar identidades y selfies de registro
  const canValidateIdentity = isVenerableMaestro || isSecretario || canManageMembers;

  const loadMembers = async () => {
    try {
      const list = await memberService.getAllMembers(true);
      setMembers(list);
    } catch {
      toast.error('Error al cargar miembros');
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const handleOpenRoleModal = (m: Member) => {
    setRoleModalMember(m);
    setRoleModalSelectedId(m.roleId || 'her');
  };

  const handleSaveRoleOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleModalMember) return;
    setIsSavingRole(true);
    try {
      await memberService.updateMemberRole(
        roleModalMember.id,
        roleModalSelectedId,
        { id: user?.id, email: user?.email }
      );
      await authService.updateUserRole(roleModalMember.email, roleModalSelectedId);
      toast.success(`Cargo asignado a ${roleModalMember.firstName} ${roleModalMember.lastName}`);
      setRoleModalMember(null);
      loadMembers();
    } catch {
      toast.error('Error al actualizar el cargo del hermano');
    } finally {
      setIsSavingRole(false);
    }
  };

  const pendingValidationsCount = useMemo(() => {
    return members.filter((m) => m.identityStatus === 'pending').length;
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Filtro por pestaña rápida
      if (activeTab === 'pendientes') {
        if (m.identityStatus !== 'pending') return false;
      } else if (activeTab === 'aprendiz' || activeTab === 'companero' || activeTab === 'maestro') {
        if (m.degree !== activeTab) return false;
      }

      // Filtro por búsqueda de texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.firstName.toLowerCase().includes(q) ||
          m.lastName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.diplomaNumber && m.diplomaNumber.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [members, activeTab, searchQuery]);

  const handleOpenEditModal = (m: Member) => {
    setEditingMember(m);
    setFormFirstName(m.firstName);
    setFormLastName(m.lastName);
    setFormEmail(m.email);
    setFormPhone(m.phone || '');
    setFormRoleId(m.roleId);
    setFormDegree(m.degree);
    setFormCondition(m.condition);
    setFormMotherLodge(m.motherLodge || '');
    setFormInitiationDate(m.initiationDate || '');
    setFormDiplomaNumber(m.diplomaNumber || '');
    setFormPassportNumber(m.passportNumber || '');
    setFormIsActive(m.isActive);
    setShowMemberModal(true);
  };

  const handleOpenValidationModal = (m: Member) => {
    setValidatingMember(m);
    setValidationNotes(m.identityNotes || '');
  };

  const handleApproveIdentity = async () => {
    if (!validatingMember) return;
    setIsProcessingValidation(true);
    try {
      const validatorUser = {
        id: user?.id,
        email: user?.email,
        displayName: user?.displayName || user?.profile?.displayName,
      };
      await memberService.updateIdentityStatus(
        validatingMember.id,
        'verified',
        validatorUser,
        validationNotes
      );
      toast.success(`Identidad de ${validatingMember.firstName} ${validatingMember.lastName} aprobada exitosamente.`);
      setValidatingMember(null);
      loadMembers();
    } catch {
      toast.error('Error al aprobar identidad del miembro.');
    } finally {
      setIsProcessingValidation(false);
    }
  };

  const handleRejectIdentity = async () => {
    if (!validatingMember) return;
    setIsProcessingValidation(true);
    try {
      const validatorUser = {
        id: user?.id,
        email: user?.email,
        displayName: user?.displayName || user?.profile?.displayName,
      };
      await memberService.updateIdentityStatus(
        validatingMember.id,
        'rejected',
        validatorUser,
        validationNotes
      );
      toast.info(`Validación rechazada. Se solicitará nueva selfie al hermano.`);
      setValidatingMember(null);
      loadMembers();
    } catch {
      toast.error('Error al registrar rechazo.');
    } finally {
      setIsProcessingValidation(false);
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await memberService.saveMember(
        {
          id: editingMember ? editingMember.id : undefined,
          firstName: formFirstName.trim(),
          lastName: formLastName.trim(),
          email: formEmail.trim(),
          phone: formPhone.trim() || undefined,
          roleId: formRoleId,
          degree: formDegree,
          condition: formCondition,
          motherLodge: formMotherLodge.trim(),
          initiationDate: formInitiationDate || undefined,
          diplomaNumber: formDiplomaNumber.trim() || undefined,
          passportNumber: formPassportNumber.trim() || undefined,
          otherBodies: editingMember?.otherBodies || [],
          isActive: formIsActive,
          identityStatus: editingMember?.identityStatus || 'pending',
          identityVerified: editingMember?.identityVerified || false,
          selfieUrl: editingMember?.selfieUrl,
        },
        { id: user?.id, email: user?.email }
      );

      await authService.updateUserRole(formEmail.trim(), formRoleId);

      toast.success('Ficha y rol del hermano actualizados');
      setShowMemberModal(false);
      loadMembers();
    } catch {
      toast.error('Error al guardar datos del miembro');
    }
  };

  const handleSoftDelete = async (id: string, name: string) => {
    const confirmed = await showConfirm({
      title: 'Dar de Baja a Hermano',
      message: `¿Confirmas la baja lógica del hermano ${name} del taller? Sus registros históricos se conservarán de forma segura.`,
      confirmText: 'Confirmar Baja',
      cancelText: 'Cancelar',
      type: 'warning',
    });
    if (!confirmed) return;
    try {
      await memberService.softDeleteMember(id, { id: user?.id, email: user?.email });
      toast.info(`Baja lógica registrada para ${name}`);
      loadMembers();
    } catch {
      toast.error('Error al dar de baja');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 px-4 pt-2.5 pb-8 sm:py-6 md:px-8 max-w-6xl mx-auto">
      {/* Cabecera limpia y despejada */}
      <div className="flex flex-row items-center justify-between gap-3">
        <PageHeader
          title="Filiación de Miembros"
          subtitle={`${members.length} hermanos registrados`}
        />
      </div>

      {/* Barra de Búsqueda y Filtros Rápidos Estilo Apple */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar hermano por nombre, correo..."
            className="w-full h-10 rounded-xl border border-border bg-white pl-10 pr-3 text-xs text-ink placeholder:text-ink-muted outline-none focus:border-primary shadow-xs transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Pestañas de Filtro Rápido */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setActiveTab('todos')}
            className={`h-7 px-3 rounded-lg font-medium whitespace-nowrap transition-colors ${
              activeTab === 'todos'
                ? 'bg-ink text-white font-semibold shadow-xs'
                : 'bg-surface-container/70 text-ink-secondary hover:bg-surface-container'
            }`}
          >
            Todos ({members.length})
          </button>

          <button
            onClick={() => setActiveTab('pendientes')}
            className={`h-7 px-2.5 rounded-lg font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              activeTab === 'pendientes'
                ? 'bg-amber-600 text-white font-semibold shadow-xs'
                : pendingValidationsCount > 0
                ? 'bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100 font-semibold'
                : 'bg-surface-container/70 text-ink-secondary hover:bg-surface-container'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Pendientes</span>
            {pendingValidationsCount > 0 && (
              <span
                className={`px-1.5 py-0.2 text-[10px] font-bold rounded-full ${
                  activeTab === 'pendientes' ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-900'
                }`}
              >
                {pendingValidationsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('aprendiz')}
            className={`h-7 px-2.5 rounded-lg font-medium whitespace-nowrap flex items-center gap-1 transition-colors ${
              activeTab === 'aprendiz'
                ? 'bg-ink text-white font-semibold shadow-xs'
                : 'bg-surface-container/70 text-ink-secondary hover:bg-surface-container'
            }`}
          >
            <AppleEmoji name="ruler" size={12} />
            <span>Aprendices</span>
          </button>

          <button
            onClick={() => setActiveTab('companero')}
            className={`h-7 px-2.5 rounded-lg font-medium whitespace-nowrap flex items-center gap-1 transition-colors ${
              activeTab === 'companero'
                ? 'bg-ink text-white font-semibold shadow-xs'
                : 'bg-surface-container/70 text-ink-secondary hover:bg-surface-container'
            }`}
          >
            <AppleEmoji name="cross" size={12} />
            <span>Compañeros</span>
          </button>

          <button
            onClick={() => setActiveTab('maestro')}
            className={`h-7 px-2.5 rounded-lg font-medium whitespace-nowrap flex items-center gap-1 transition-colors ${
              activeTab === 'maestro'
                ? 'bg-ink text-white font-semibold shadow-xs'
                : 'bg-surface-container/70 text-ink-secondary hover:bg-surface-container'
            }`}
          >
            <AppleEmoji name="temple" size={12} />
            <span>Maestros</span>
          </button>
        </div>
      </div>

      {/* Lista Despejada y Elegante de Miembros */}
      <div className="rounded-2xl border border-border bg-white shadow-xs overflow-hidden">
        {filteredMembers.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-2">
            <div className="flex justify-center">
              <AppleEmoji name="temple" size={32} />
            </div>
            <div className="font-serif text-sm font-bold text-ink">
              No se encontraron hermanos
            </div>
            <p className="text-xs text-ink-muted max-w-sm mx-auto">
              {activeTab === 'pendientes'
                ? 'No hay registros de identidad pendientes de revisión por Secretaría o Veneratura.'
                : 'No hay hermanos que coincidan con la búsqueda o filtro seleccionado.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredMembers.map((m) => {
              const role = institutionalRoles.find((r) => r.id === m.roleId);

              const degreeBadge =
                m.degree === 'aprendiz'
                  ? { label: '1° Aprendiz', emoji: 'ruler' }
                  : m.degree === 'companero'
                  ? { label: '2° Compañero', emoji: 'cross' }
                  : { label: '3° Maestro', emoji: 'temple' };

              const isPendingValidation = m.identityStatus === 'pending';
              const isVerified = m.identityStatus === 'verified';
              const isRejected = m.identityStatus === 'rejected';

              return (
                <div
                  key={m.id}
                  className="p-3.5 sm:p-4 hover:bg-surface-container-low/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                >
                  {/* Foto de Identidad / Avatar y Datos del Hermano */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar o Selfie de Registro */}
                    <div
                      onClick={() => handleOpenValidationModal(m)}
                      className="relative h-12 w-12 shrink-0 rounded-2xl overflow-hidden border border-border bg-surface shadow-2xs cursor-pointer group flex items-center justify-center transition-transform active:scale-95"
                      title="Ver validación de identidad"
                    >
                      {m.selfieUrl ? (
                        <img
                          src={m.selfieUrl}
                          alt={`${m.firstName} ${m.lastName}`}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/15 via-primary/5 to-surface text-primary font-serif font-bold text-sm">
                          {m.firstName[0]}
                          {m.lastName[0]}
                        </div>
                      )}

                      {/* Icono de verificación en la esquina del avatar */}
                      {isVerified && (
                        <span className="absolute bottom-0 right-0 rounded-tl-lg bg-emerald-500 p-0.5 text-white shadow-xs">
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </span>
                      )}
                      {isPendingValidation && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-white shadow-xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                        </span>
                      )}
                    </div>

                    {/* Información Principal */}
                    <div className="space-y-1 min-w-0 flex-1">
                      {/* Fila 1: Nombre y Badges esenciales */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4
                          onClick={() => handleOpenValidationModal(m)}
                          className="font-serif text-sm sm:text-base font-bold text-ink leading-tight hover:text-primary transition-colors cursor-pointer"
                        >
                          {m.firstName} {m.lastName}
                        </h4>

                        {/* Cargo oficial (Asignable por el Venerable Maestro) */}
                        {role && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canManageMembers) handleOpenRoleModal(m);
                            }}
                            disabled={!canManageMembers}
                            className={`inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider ${
                              canManageMembers
                                ? 'hover:bg-primary/20 hover:scale-105 active:scale-95 cursor-pointer transition-transform'
                                : ''
                            }`}
                            title={canManageMembers ? 'Clic para asignar o cambiar cargo / rol' : undefined}
                          >
                            {role.name}
                          </button>
                        )}

                        {/* Grado Masónico */}
                        <span className="inline-flex items-center gap-1 rounded-md bg-surface-container px-1.5 py-0.5 text-[11px] font-medium text-ink-secondary">
                          <AppleEmoji name={degreeBadge.emoji} size={11} />
                          <span>{degreeBadge.label}</span>
                        </span>

                        {/* Condición de membresía discreta */}
                        {!m.isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                            Inactivo
                          </span>
                        ) : m.condition !== 'activo' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 text-purple-700 px-1.5 py-0.5 text-[10px] font-medium">
                            {m.condition === 'ad_vitam' ? 'Ad Vitam' : 'Dual'}
                          </span>
                        ) : null}
                      </div>

                      {/* Fila 2: Correo y Teléfono */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{m.email}</span>
                        </span>
                        {m.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{m.phone}</span>
                          </span>
                        )}
                        {m.diplomaNumber && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted/80">
                            <Award className="h-3 w-3" />
                            <span>{m.diplomaNumber}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Estado de Validación de Identidad y Acciones */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                    {/* Píldora de Validación de Identidad para Secretario / VM */}
                    {isVerified ? (
                      <button
                        type="button"
                        onClick={() => handleOpenValidationModal(m)}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                        title="Identidad verificada. Clic para ver selfie de registro."
                      >
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Verificado</span>
                      </button>
                    ) : isPendingValidation ? (
                      <button
                        type="button"
                        onClick={() => handleOpenValidationModal(m)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-all cursor-pointer shadow-2xs active:scale-95"
                        title="Validación pendiente de aprobación. Clic para revisar selfie."
                      >
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
                        <span>Validación Pendiente</span>
                      </button>
                    ) : isRejected ? (
                      <button
                        type="button"
                        onClick={() => handleOpenValidationModal(m)}
                        className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                        title="Validación rechazada. Clic para revisar."
                      >
                        <XCircle className="h-3.5 w-3.5 text-rose-600" />
                        <span>Rechazado</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenValidationModal(m)}
                        className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-200 transition-colors cursor-pointer"
                        title="Sin selfie de registro cargada"
                      >
                        <Camera className="h-3 w-3 text-zinc-400" />
                        <span>Sin selfie</span>
                      </button>
                    )}

                    {/* Botones de Edición y Baja */}
                    <div className="flex items-center gap-1">
                      {canManageMembers && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(m)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-ink-muted hover:text-ink hover:bg-surface-container transition-colors cursor-pointer active:scale-95 shadow-2xs"
                          title="Editar ficha"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {canManageMembers && m.isActive && (
                        <button
                          type="button"
                          onClick={() => handleSoftDelete(m.id, `${m.firstName} ${m.lastName}`)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-ink-muted hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer active:scale-95 shadow-2xs"
                          title="Baja lógica"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Validación de Registro e Identidad Facial (Para Secretario y Venerable Maestro) */}
      <Modal
        isOpen={Boolean(validatingMember)}
        onClose={() => setValidatingMember(null)}
        title="Validación de Identidad y Registro Facial"
        maxWidth="md"
      >
        {validatingMember && (
          <div className="space-y-4">
            {/* Aviso Explicativo de Seguridad */}
            <div className="flex items-start gap-2.5 rounded-xl bg-surface-container-low border border-border p-3 text-xs text-ink-secondary">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-ink">Protección contra usurpación de identidad:</span>{' '}
                Esta comprobación facial se solicita durante el registro para validar la pertenencia fraternal de cada hermano antes de otorgar acceso directo a los trabajos de la logia.
              </div>
            </div>

            {/* Fotografía de Selfie de Registro */}
            <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-surface border border-border">
              <div className="relative h-44 w-44 sm:h-52 sm:w-52 rounded-2xl overflow-hidden border-2 border-border shadow-md bg-zinc-950 flex items-center justify-center">
                {validatingMember.selfieUrl ? (
                  <img
                    src={validatingMember.selfieUrl}
                    alt={`Selfie de ${validatingMember.firstName}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center space-y-2">
                    <Camera className="h-10 w-10 text-zinc-500" />
                    <span className="text-xs text-zinc-400">Sin captura de selfie registrada</span>
                  </div>
                )}

                {/* Badge flotante en la foto */}
                <div className="absolute top-2 right-2">
                  {validatingMember.identityStatus === 'verified' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                      <Check className="h-3 w-3 stroke-[3]" /> Aprobado
                    </span>
                  ) : validatingMember.identityStatus === 'pending' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-600/90 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                      <ShieldAlert className="h-3 w-3" /> Pendiente
                    </span>
                  ) : validatingMember.identityStatus === 'rejected' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-600/90 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                      <XCircle className="h-3 w-3" /> Rechazado
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Datos del hermano */}
              <div className="mt-3 text-center space-y-0.5">
                <h3 className="font-serif text-base font-bold text-ink">
                  {validatingMember.firstName} {validatingMember.lastName}
                </h3>
                <p className="text-xs text-ink-muted">
                  {validatingMember.degree.toUpperCase()} · {validatingMember.email}
                </p>
              </div>
            </div>

            {/* Resumen del Dictamen Biométrico */}
            <div className="space-y-2 rounded-xl border border-border p-3 text-xs bg-white">
              <div className="flex items-center justify-between">
                <span className="text-ink-secondary">Comprobación biométrica (Liveness):</span>
                <span className="font-semibold text-emerald-700 inline-flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" /> Positiva (Presencia real)
                </span>
              </div>
              {validatingMember.identityValidatedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-secondary">Fecha de captura / revisión:</span>
                  <span className="font-semibold text-ink">
                    {formatDateSpanish(validatingMember.identityValidatedAt)}
                  </span>
                </div>
              )}
              {validatingMember.identityValidatedBy && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-secondary">Dictamen emitido por:</span>
                  <span className="font-semibold text-primary">
                    {validatingMember.identityValidatedBy}
                  </span>
                </div>
              )}
            </div>

            {/* Campo opcional de observaciones para el Secretario / VM */}
            {canValidateIdentity && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-secondary">
                  Notas de verificación fraternal (opcional):
                </label>
                <input
                  type="text"
                  value={validationNotes}
                  onChange={(e) => setValidationNotes(e.target.value)}
                  placeholder="Ej. Reconocido personalmente en tenida anterior..."
                  className="w-full h-9 rounded-xl border border-border bg-white px-3 text-xs text-ink placeholder:text-ink-muted outline-none focus:border-primary shadow-xs"
                />
              </div>
            )}

            {/* Botones de Decisión para Secretario / Venerable Maestro */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setValidatingMember(null)}
                className="w-full sm:w-auto h-10 px-4 rounded-xl border border-border text-xs font-semibold text-ink-secondary hover:bg-surface-container transition-colors"
              >
                Cerrar
              </button>

              {canValidateIdentity && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={isProcessingValidation}
                    onClick={handleRejectIdentity}
                    className="flex-1 sm:flex-initial h-10 px-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Solicitar Nueva Selfie
                  </button>

                  <button
                    type="button"
                    disabled={isProcessingValidation}
                    onClick={handleApproveIdentity}
                    className="flex-1 sm:flex-initial h-10 px-4 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Aprobar Identidad</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Edición de Ficha de Miembro */}
      <Modal
        isOpen={showMemberModal}
        onClose={() => setShowMemberModal(false)}
        title="Editar Ficha del Hermano"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveMember} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <AppleInput
              label="Nombres *"
              required
              value={formFirstName}
              onChange={(e) => setFormFirstName(e.target.value)}
              icon={<User className="h-4 w-4" />}
              placeholder="Ej. Juan Carlos"
            />
            <AppleInput
              label="Apellidos *"
              required
              value={formLastName}
              onChange={(e) => setFormLastName(e.target.value)}
              icon={<User className="h-4 w-4" />}
              placeholder="Ej. Pérez Gómez"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <AppleInput
              label="Correo Electrónico *"
              type="email"
              required
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              icon={<Mail className="h-4 w-4" />}
              placeholder="hermano@logia.org"
            />
            <AppleInput
              label="Teléfono Móvil"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              icon={<Phone className="h-4 w-4" />}
              placeholder="+507 6000-0000"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <AppleSelect<MasonicDegree>
              label="Grado Masónico *"
              value={formDegree}
              onChange={setFormDegree}
              options={degreeOptions}
            />

            <AppleSelect<MemberStatusCondition>
              label="Condición Masónica *"
              value={formCondition}
              onChange={setFormCondition}
              options={conditionOptions}
            />
          </div>

          <AppleSelect<InstitutionalRoleCode>
            label="Cargo o Rol en el Taller *"
            value={formRoleId}
            onChange={setFormRoleId}
            options={roleOptions}
            searchable={true}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <AppleInput
              label="Diploma Gran Logia No."
              value={formDiplomaNumber}
              onChange={(e) => setFormDiplomaNumber(e.target.value)}
              icon={<Award className="h-4 w-4" />}
              placeholder="DIP-0021"
            />
            <AppleInput
              label="Pasaporte Masónico No."
              value={formPassportNumber}
              onChange={(e) => setFormPassportNumber(e.target.value)}
              icon={<FileText className="h-4 w-4" />}
              placeholder="PASS-GLP-1234"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setShowMemberModal(false)}
              className="h-10 px-5 rounded-xl border border-border text-xs font-semibold text-ink-secondary hover:bg-surface-container transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="h-10 px-6 rounded-xl bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary-pressed shadow-sm transition-all"
            >
              Guardar Ficha
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Dedicado para Asignar / Cambiar Cargo o Rol */}
      <Modal
        isOpen={Boolean(roleModalMember)}
        onClose={() => setRoleModalMember(null)}
        title="Asignar Cargo o Rol"
        subtitle={roleModalMember ? `Hermano ${roleModalMember.firstName} ${roleModalMember.lastName}` : undefined}
        maxWidth="md"
      >
        {roleModalMember && (
          <form onSubmit={handleSaveRoleOnly} className="space-y-4 py-1">
            {/* Tarjeta Resumen del Hermano */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-container-low border border-border">
              <div className="h-11 w-11 shrink-0 rounded-xl overflow-hidden border border-border bg-surface flex items-center justify-center font-serif font-bold text-primary text-sm shadow-2xs">
                {roleModalMember.selfieUrl ? (
                  <img
                    src={roleModalMember.selfieUrl}
                    alt={roleModalMember.firstName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{roleModalMember.firstName[0]}{roleModalMember.lastName[0]}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-ink truncate">
                  {roleModalMember.firstName} {roleModalMember.lastName}
                </p>
                <p className="text-[11px] text-ink-muted truncate">
                  {roleModalMember.email} • Grado:{' '}
                  <span className="capitalize font-medium text-ink-secondary">{roleModalMember.degree}</span>
                </p>
              </div>
            </div>

            {/* Selector de Rol Limpio y a Ancho Completo */}
            <AppleSelect<InstitutionalRoleCode>
              label="Seleccionar Cargo o Rol en el Taller *"
              value={roleModalSelectedId}
              onChange={setRoleModalSelectedId}
              options={roleOptions}
              searchable={true}
            />

            <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setRoleModalMember(null)}
                className="h-10 px-4 rounded-xl border border-border text-xs font-semibold text-ink-secondary hover:bg-surface-container transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingRole}
                className="h-10 px-5 rounded-xl bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary-pressed shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isSavingRole ? 'Guardando...' : 'Asignar Cargo'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
