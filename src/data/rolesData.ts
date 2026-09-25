import type { Role, InstitutionalRoleCode, Permission } from '@/types';

export const institutionalRoles: Role[] = [
  {
    id: 'vm',
    name: 'Venerable',
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
    id: 'sec',
    name: 'Secretario',
    category: 'dignatario',
    order: 2,
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
    order: 3,
    technicalRole: 'treasurer',
    defaultPermissions: ['view', 'create', 'edit', 'export_data', 'view_sensitive_info'],
  },
  {
    id: 'vig',
    name: 'Vigilantes',
    category: 'dignatario',
    order: 4,
    technicalRole: 'dignitary',
    defaultPermissions: ['view', 'create', 'edit', 'manage_events', 'manage_attendance', 'view_sensitive_info'],
  },
  {
    id: 'pm',
    name: 'Past Master',
    category: 'dignatario',
    order: 5,
    technicalRole: 'dignitary',
    defaultPermissions: ['view', 'view_sensitive_info'],
  },
  {
    id: 'mae',
    name: 'Maestro',
    category: 'general',
    order: 6,
    technicalRole: 'member',
    defaultPermissions: ['view', 'create', 'edit'],
  },
  {
    id: 'comp',
    name: 'Compañero',
    category: 'general',
    order: 7,
    technicalRole: 'member',
    defaultPermissions: ['view'],
  },
  {
    id: 'apr',
    name: 'Aprendiz',
    category: 'general',
    order: 8,
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
  if (!id) return institutionalRoles.find((r) => r.id === 'apr');
  const direct = institutionalRoles.find((r) => r.id === id);
  if (direct) return direct;
  // Aliases de compatibilidad
  if (id === 'her') return institutionalRoles.find((r) => r.id === 'apr');
  if (id === 'pv' || id === 'sv') return institutionalRoles.find((r) => r.id === 'vig');
  if (id === 'vmi') return institutionalRoles.find((r) => r.id === 'pm');
  if (id === 'ora' || id === 'mc' || id === 'pe' || id === 'se' || id === 'pd' || id === 'sd' || id === 'gt' || id === 'hos' || id === 'arm') {
    return institutionalRoles.find((r) => r.id === 'mae');
  }
  return institutionalRoles.find((r) => r.id === 'apr') || institutionalRoles[0];
}

export function hasRolePermission(roleId: InstitutionalRoleCode, permission: Permission): boolean {
  const role = getRoleById(roleId);
  if (!role) return false;
  return role.defaultPermissions.includes(permission);
}
