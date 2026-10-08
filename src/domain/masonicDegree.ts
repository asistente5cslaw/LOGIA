import type { InstitutionalRoleCode, MasonicDegree } from '@/types';

/**
 * Equivalencia protocolar entre el cargo/grado del miembro y el grado de trabajo.
 *
 * Aprendiz = primer grado.
 * Compañero = segundo grado.
 * Maestro y cualquier grado/cargo superior = tercer grado.
 */
const APPRENTICE_ROLES = new Set<InstitutionalRoleCode>(['apr', 'her']);
const COMPANION_ROLES = new Set<InstitutionalRoleCode>(['comp']);

export function masonicDegreeForRole(roleId: InstitutionalRoleCode | null | undefined): MasonicDegree {
  if (roleId && APPRENTICE_ROLES.has(roleId)) return 'aprendiz';
  if (roleId && COMPANION_ROLES.has(roleId)) return 'companero';
  return 'maestro';
}
