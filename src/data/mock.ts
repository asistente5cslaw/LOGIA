import type { Role, Member } from '@/types';
import { institutionalRoles } from './rolesData';

export const roles: Role[] = institutionalRoles;

export const members: Member[] = [
  {
    id: 'm-denzel',
    firstName: 'Denzel',
    lastName: 'Coronado',
    email: 'asistente4@castillosucre.com',
    roleId: 'vm',
    degree: 'maestro',
    condition: 'activo',
    motherLodge: 'Resp.·. Log.·. Unión Fraternal No. 21',
    diplomaNumber: 'DIP-0021-01',
    passportNumber: 'PASS-GLP-2021',
    phone: '+507 6262-1527',
    joinedAt: '2018-03-15',
    isActive: true,
    identityVerified: true,
    identityStatus: 'verified',
    identityValidatedAt: '2026-09-01T10:00:00Z',
    identityValidatedBy: 'Venerable Maestro',
  },
];
