import type { Role, InstitutionalRoleCode, Permission } from '@/types';

export const institutionalRoles: Role[] = [
  // Dignatarios
  {
    id: 'vm',
    name: 'Venerable Maestro',
    category: 'dignatario',
    order: 1,
    technicalRole: 'admin',
    defaultPermissions: [
      'view',
      'create',
      'edit',
      'approve',
      'archive',
      'manage_events',
      'manage_minutes',
      'view_sensitive_info',
      'configure_lodge',
      'export_data',
    ],
  },
  {
    id: 'pv',
    name: 'Primer Vigilante',
    category: 'dignatario',
    order: 2,
    technicalRole: 'dignitary',
    defaultPermissions: ['view', 'create', 'edit', 'manage_events', 'view_sensitive_info'],
  },
  {
    id: 'sv',
    name: 'Segundo Vigilante',
    category: 'dignatario',
    order: 3,
    technicalRole: 'dignitary',
    defaultPermissions: ['view', 'create', 'edit', 'manage_events'],
  },
  {
    id: 'sec',
    name: 'Secretario',
    category: 'dignatario',
    order: 4,
    technicalRole: 'admin',
    defaultPermissions: [
      'view',
      'create',
      'edit',
      'approve',
      'archive',
      'manage_users',
      'manage_members',
      'manage_events',
      'manage_minutes',
      'manage_attendance',
      'view_sensitive_info',
      'export_data',
      'configure_lodge',
    ],
  },
  {
    id: 'tes',
    name: 'Tesorero',
    category: 'dignatario',
    order: 5,
    technicalRole: 'treasurer',
    defaultPermissions: ['view', 'create', 'edit', 'export_data', 'view_sensitive_info'],
  },
  {
    id: 'ora',
    name: 'Orador',
    category: 'dignatario',
    order: 6,
    technicalRole: 'dignitary',
    defaultPermissions: ['view', 'approve', 'manage_minutes'],
  },
  {
    id: 'mc',
    name: 'Maestro de Ceremonia',
    category: 'dignatario',
    order: 7,
    technicalRole: 'dignitary',
    defaultPermissions: ['view', 'create', 'manage_events', 'manage_attendance'],
  },
  {
    id: 'vmi',
    name: 'Venerable Maestro Inmediato',
    category: 'dignatario',
    order: 8,
    technicalRole: 'dignitary',
    defaultPermissions: ['view', 'view_sensitive_info'],
  },
  // Oficiales
  {
    id: 'pe',
    name: 'Primer Experto',
    category: 'oficial',
    order: 9,
    technicalRole: 'member',
    defaultPermissions: ['view', 'manage_attendance'],
  },
  {
    id: 'se',
    name: 'Segundo Experto',
    category: 'oficial',
    order: 10,
    technicalRole: 'member',
    defaultPermissions: ['view'],
  },
  {
    id: 'pd',
    name: 'Primer Diácono',
    category: 'oficial',
    order: 11,
    technicalRole: 'member',
    defaultPermissions: ['view'],
  },
  {
    id: 'sd',
    name: 'Segundo Diácono',
    category: 'oficial',
    order: 12,
    technicalRole: 'member',
    defaultPermissions: ['view'],
  },
  {
    id: 'gt',
    name: 'Guarda Templo',
    category: 'oficial',
    order: 13,
    technicalRole: 'member',
    defaultPermissions: ['view', 'manage_attendance'],
  },
  {
    id: 'hos',
    name: 'Hospitalario',
    category: 'oficial',
    order: 14,
    technicalRole: 'member',
    defaultPermissions: ['view', 'edit'],
  },
  {
    id: 'arm',
    name: 'Maestro de la Armonía',
    category: 'oficial',
    order: 15,
    technicalRole: 'member',
    defaultPermissions: ['view'],
  },
  // General
  {
    id: 'her',
    name: 'Hermano',
    category: 'general',
    order: 16,
    technicalRole: 'member',
    defaultPermissions: ['view'],
  },
];

export const permissionLabels: Record<Permission, { title: string; description: string }> = {
  view: { title: 'Ver registros', description: 'Acceso de lectura a paneles y listados generales' },
  create: { title: 'Crear registros', description: 'Capacidad para crear eventos, borradores y notas' },
  edit: { title: 'Editar registros', description: 'Modificar registros creados previamente' },
  approve: { title: 'Aprobar documentos', description: 'Aprobación formal de actas y acuerdos de taller' },
  archive: { title: 'Archivar documentos', description: 'Mover actas y registros al archivo histórico' },
  manage_users: { title: 'Administrar usuarios', description: 'Gestionar invitaciones y cuentas de acceso' },
  manage_members: { title: 'Administrar miembros', description: 'Alta, baja lógica y ficha masónica de miembros' },
  manage_events: { title: 'Gestionar eventos', description: 'Creación, convocatoria y control de tenidas' },
  manage_minutes: { title: 'Gestionar actas', description: 'Redacción, correcciones y control del libro de actas' },
  manage_attendance: { title: 'Gestionar asistencia', description: 'Toma y edición de asistencia de tenidas' },
  view_sensitive_info: { title: 'Ver información sensible', description: 'Acceso a pasaportes, diplomas y afiliaciones' },
  export_data: { title: 'Exportar datos', description: 'Descarga de libros, reportes y respaldos CSV/JSON' },
  configure_lodge: { title: 'Configurar logia', description: 'Modificación de parámetros institucionales de la logia' },
};

export function getRoleById(id: string): Role | undefined {
  return institutionalRoles.find((r) => r.id === id);
}

export function hasRolePermission(roleId: InstitutionalRoleCode, permission: Permission): boolean {
  const role = getRoleById(roleId);
  if (!role) return false;
  return role.defaultPermissions.includes(permission);
}
