export type RoleCategory = 'dignatario' | 'oficial' | 'general';

export type MasonicDegree = 'aprendiz' | 'companero' | 'maestro';

export type MemberStatusCondition = 'activo' | 'ad_vitam' | 'dual' | 'inactivo';

export type InstitutionalRoleCode =
  | 'vm'
  | 'pv'
  | 'sv'
  | 'sec'
  | 'tes'
  | 'ora'
  | 'mc'
  | 'vmi'
  | 'pe'
  | 'se'
  | 'pd'
  | 'sd'
  | 'gt'
  | 'hos'
  | 'arm'
  | 'her';

export type TechnicalRole = 'admin' | 'secretary' | 'dignitary' | 'treasurer' | 'member';

export type Permission =
  | 'view'
  | 'create'
  | 'edit'
  | 'approve'
  | 'archive'
  | 'manage_users'
  | 'manage_members'
  | 'manage_events'
  | 'manage_minutes'
  | 'manage_attendance'
  | 'view_sensitive_info'
  | 'export_data'
  | 'configure_lodge';

export interface Role {
  id: InstitutionalRoleCode;
  name: string;
  category: RoleCategory;
  order: number;
  technicalRole: TechnicalRole;
  defaultPermissions: Permission[];
}

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleId: InstitutionalRoleCode;
  phone?: string;
  avatarUrl?: string;
  degree: MasonicDegree;
  condition: MemberStatusCondition;
  motherLodge?: string;
  initiationDate?: string;
  passingDate?: string;
  raisingDate?: string;
  diplomaNumber?: string;
  passportNumber?: string;
  otherBodies?: string[];
  joinedAt: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Validación de identidad y selfie de registro
  identityVerified?: boolean;
  identityStatus?: 'pending' | 'verified' | 'rejected' | 'not_started';
  selfieUrl?: string;
  identityValidatedAt?: string;
  identityValidatedBy?: string;
  identityNotes?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  memberId?: string;
  displayName: string;
  roleId: InstitutionalRoleCode;
  technicalRole: TechnicalRole;
  identityVerified: boolean;
  identityStatus: 'pending' | 'verified' | 'rejected' | 'not_started';
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  memberId?: string;
  displayName: string;
  isAuthenticated: boolean;
  profile?: UserProfile;
}

export type MasonicBodyId =
  | 'uf21'
  | 'glp'
  | 'interlogias'
  | 'york'
  | 'supremo_consejo'
  | 'shriners';

export interface MasonicBody {
  id: MasonicBodyId;
  name: string;
  shortName: string;
  symbol: string;
  appleEmoji: string;
  color: string;
  description?: string;
}

export type EventStatus = 'programada' | 'convocada' | 'celebrada' | 'cancelada';

export interface LodgeEvent {
  id: string;
  title: string;
  bodyId: MasonicBodyId;
  degreeRequired: MasonicDegree;
  startDate: string; // ISO string or YYYY-MM-DD
  endDate?: string; // Optional end date for multi-day
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  isAllDay: boolean;
  isMeeting: boolean; // Tenida vs evento social/administrativo
  location: string;
  notes?: string;
  status: EventStatus;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
  conflictJustification?: string;
  conflictApprovedBy?: string;
  conflictApprovedAt?: string;
}

export interface EventConflict {
  id: string;
  eventId1: string;
  eventId2: string;
  reason: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  justification?: string;
  createdAt: string;
}

export type MinuteStatus = 'borrador' | 'circulada' | 'aprobada' | 'firmada' | 'archivada';

export interface MinuteCorrection {
  id: string;
  minuteId: string;
  authorId: string;
  authorName: string;
  comment: string;
  createdAt: string;
}

export interface Minute {
  id: string;
  number: number; // Consecutivo anual
  year: number;
  formatNumber: string; // XX-YYYY
  title: string;
  description: string;
  meetingDate: string;
  degree: MasonicDegree;
  status: MinuteStatus;
  eventId?: string; // ID de la tenida / convocatoria asociada
  eventTitle?: string; // Título de la tenida asociada
  volume?: string; // Tomo
  folio?: string; // Folio
  notes?: string;
  pdfUrl?: string;
  pdfFileName?: string;
  pdfFileSize?: number;
  corrections?: MinuteCorrection[];
  readBy?: string[]; // IDs de miembros que leyeron
  allowedMemberIds?: string[]; // Permisos de acceso individual
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceStatus = 'presente' | 'excusa' | 'ausente';

export interface AttendanceRecord {
  id: string;
  eventId: string;
  memberId: string;
  status: AttendanceStatus;
  updatedBy: string;
  updatedAt: string;
}

export interface VisitorAttendance {
  id: string;
  eventId: string;
  fullName: string;
  lodge: string;
  degree: MasonicDegree;
  notes?: string;
  createdAt: string;
}

export interface LodgeSettings {
  id: string;
  lodgeName: string;
  lodgeNumber: number;
  orient: string;
  rite: string;
  charterDate: string;
  regularMeetingDays: string;
  templeAddress: string;
  contactEmail: string;
  currentVenerableMaster?: string;
  currentSecretary?: string;
  privacyPolicyUrl?: string;
  updatedAt: string;
}

export interface OfficialVisitChecklistItem {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  notes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface OfficialVisitSummary {
  activeMembersCount: number;
  regularMeetingsHeld: number;
  averageAttendancePercentage: number;
  approvedMinutesCount: number;
  pendingMinutesCount: number;
  checklistItemsCompleted: number;
  checklistTotalItems: number;
  charterStatus: 'valid' | 'pending';
  overallReadiness: number; // 0-100%
}

export interface Invitation {
  id: string;
  code: string;
  email?: string;
  degree: MasonicDegree;
  roleId: InstitutionalRoleCode;
  createdBy: string;
  expiresAt: string;
  isUsed: boolean;
  usedAt?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  userId: string;
  userEmail: string;
  details?: Record<string, unknown>;
  createdAt: string;
}
