import { describe, it, expect, vi } from 'vitest';
import { institutionalRoles, hasRolePermission } from '@/data/rolesData';
import { eventService } from '@/services/eventService';
import { minuteService } from '@/services/minuteService';
import { attendanceService } from '@/services/attendanceService';
import { officialVisitService } from '@/services/officialVisitService';
import { memberService } from '@/services/memberService';
import { identityService } from '@/services/identityService';
import { convocationService } from '@/services/convocationService';
import { authService } from '@/services/authService';
import { supabase } from '@/lib/supabase';
import type { LodgeEvent, Minute, Member, AttendanceRecord, OfficialVisitChecklistItem } from '@/types';

describe('1. Roles Institucionales y Permisos', () => {
  it('debe contener los 8 roles institucionales requeridos', () => {
    expect(institutionalRoles.length).toBe(8);
    const roleIds = institutionalRoles.map((r) => r.id);
    expect(roleIds).toContain('apr');
    expect(roleIds).toContain('comp');
    expect(roleIds).toContain('mae');
    expect(roleIds).toContain('vm');
    expect(roleIds).toContain('sec');
    expect(roleIds).toContain('tes');
    expect(roleIds).toContain('vig');
    expect(roleIds).toContain('pm');
  });

  it('el Secretario debe tener permisos amplios de administración', () => {
    expect(hasRolePermission('sec', 'manage_users')).toBe(true);
    expect(hasRolePermission('sec', 'manage_members')).toBe(true);
    expect(hasRolePermission('sec', 'manage_events')).toBe(true);
    expect(hasRolePermission('sec', 'manage_minutes')).toBe(true);
    expect(hasRolePermission('sec', 'export_data')).toBe(true);
  });

  it('el Venerable Maestro debe tener permisos para aprobar actas y configurar logia', () => {
    expect(hasRolePermission('vm', 'approve')).toBe(true);
    expect(hasRolePermission('vm', 'configure_lodge')).toBe(true);
  });

  it('un Hermano general no debe tener permisos administrativos de miembros o usuarios', () => {
    expect(hasRolePermission('her', 'manage_users')).toBe(false);
    expect(hasRolePermission('her', 'manage_members')).toBe(false);
    expect(hasRolePermission('her', 'configure_lodge')).toBe(false);
    expect(hasRolePermission('her', 'view')).toBe(true);
  });
});

describe('2. Detección de Conflictos de Calendario', () => {
  const existingEvents: LodgeEvent[] = [
    {
      id: 'ev-1',
      title: 'Tenida de Primer Grado',
      bodyId: 'uf21',
      degreeRequired: 'aprendiz',
      startDate: '2026-10-14',
      startTime: '19:30',
      endTime: '21:30',
      isAllDay: false,
      isMeeting: true,
      location: 'Templo Mayor',
      status: 'programada',
      createdBy: 'sec',
      createdAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'ev-2',
      title: 'Evento Cancelado',
      bodyId: 'glp',
      degreeRequired: 'maestro',
      startDate: '2026-10-14',
      startTime: '19:30',
      endTime: '21:30',
      isAllDay: false,
      isMeeting: true,
      location: 'Templo Mayor',
      status: 'cancelada', // Cancelado no debe causar conflicto
      createdBy: 'sec',
      createdAt: '2026-09-01T00:00:00Z',
    },
  ];

  it('debe detectar conflicto cuando dos eventos activos se superponen en hora y fecha', () => {
    const candidate: LodgeEvent = {
      id: 'ev-candidate',
      title: 'Nueva Tenida Superpuesta',
      bodyId: 'glp',
      degreeRequired: 'maestro',
      startDate: '2026-10-14',
      startTime: '20:00',
      endTime: '22:00',
      isAllDay: false,
      isMeeting: true,
      location: 'Templo Mayor',
      status: 'programada',
      createdBy: 'sec',
      createdAt: '2026-09-01T00:00:00Z',
    };

    const conflicts = eventService.detectConflicts(candidate, existingEvents);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].id).toBe('ev-1');
  });

  it('no debe generar conflicto con eventos cancelados', () => {
    const candidate: LodgeEvent = {
      id: 'ev-candidate-2',
      title: 'Tenida sin colisión con cancelados',
      bodyId: 'glp',
      degreeRequired: 'maestro',
      startDate: '2026-10-14',
      startTime: '19:30',
      endTime: '21:30',
      isAllDay: false,
      isMeeting: true,
      location: 'Templo Mayor',
      status: 'cancelada', // El propio candidato cancelado
      createdBy: 'sec',
      createdAt: '2026-09-01T00:00:00Z',
    };

    const conflicts = eventService.detectConflicts(candidate, existingEvents);
    expect(conflicts.length).toBe(0);
  });

  it('debe detectar conflicto en eventos de varios días', () => {
    const multiDayEvent: LodgeEvent = {
      id: 'ev-multi',
      title: 'Congreso Masónico Gran Logia',
      bodyId: 'glp',
      degreeRequired: 'maestro',
      startDate: '2026-10-12',
      endDate: '2026-10-16',
      isAllDay: true,
      isMeeting: true,
      location: 'Hotel El Panamá',
      status: 'programada',
      createdBy: 'glp',
      createdAt: '2026-09-01T00:00:00Z',
    };

    const candidate: LodgeEvent = {
      id: 'ev-candidate-multi',
      title: 'Tenida Intermedia',
      bodyId: 'uf21',
      degreeRequired: 'aprendiz',
      startDate: '2026-10-14',
      startTime: '19:30',
      endTime: '21:30',
      isAllDay: false,
      isMeeting: true,
      location: 'Templo Mayor',
      status: 'programada',
      createdBy: 'sec',
      createdAt: '2026-09-01T00:00:00Z',
    };

    const conflicts = eventService.detectConflicts(candidate, [multiDayEvent]);
    expect(conflicts.length).toBe(1);
  });

  it('debe sugerir fechas alternativas dentro de los próximos 60 días priorizando el mismo día de la semana', () => {
    const candidate: LodgeEvent = {
      id: 'ev-candidate-alt',
      title: 'Tenida para reprogramar',
      bodyId: 'uf21',
      degreeRequired: 'aprendiz',
      startDate: '2026-10-14', // Miércoles
      startTime: '19:30',
      endTime: '21:30',
      isAllDay: false,
      isMeeting: true,
      location: 'Templo',
      status: 'programada',
      createdBy: 'sec',
      createdAt: '2026-09-01T00:00:00Z',
    };

    const suggestions = eventService.suggestAlternativeDates(candidate, existingEvents);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].startDate).not.toBe('2026-10-14');
  });
});

describe('3. Actas y Control de Acceso por Grado', () => {
  const sampleMinute: Minute = {
    id: 'min-1',
    number: 1,
    year: 2026,
    formatNumber: '01-2026',
    title: 'Tenida de Tercer Grado (Cámara del Medio)',
    description: 'Trabajos de exaltación reservada exclusivamente a Maestros Masones.',
    meetingDate: '2026-02-15',
    degree: 'maestro',
    status: 'aprobada',
    createdBy: 'sec',
    createdAt: '2026-02-16T00:00:00Z',
    updatedAt: '2026-02-16T00:00:00Z',
  };

  it('un Aprendiz NO debe tener acceso a un acta de Grado de Maestro', () => {
    const apprenticeMember = { id: 'm-app', degree: 'aprendiz' as const, roleId: 'her' };
    const canAccess = minuteService.canMemberAccessMinute(sampleMinute, apprenticeMember);
    expect(canAccess).toBe(false);
  });

  it('un Maestro sí debe tener acceso a un acta de Grado de Maestro', () => {
    const masterMember = { id: 'm-mas', degree: 'maestro' as const, roleId: 'her' };
    const canAccess = minuteService.canMemberAccessMinute(sampleMinute, masterMember);
    expect(canAccess).toBe(true);
  });

  it('el Secretario y Venerable Maestro siempre tienen acceso a cualquier acta', () => {
    const secMember = { id: 'm-sec', degree: 'companero' as const, roleId: 'sec' };
    const canAccess = minuteService.canMemberAccessMinute(sampleMinute, secMember);
    expect(canAccess).toBe(true);
  });
});

describe('4. Cálculos de Asistencia y Exclusión de Eventos Profanos', () => {
  it('debe excluir eventos que no sean tenidas rituales del cálculo de promedio', () => {
    const events: LodgeEvent[] = [
      {
        id: 'ev-tenida-1',
        title: 'Tenida Ordinaria',
        bodyId: 'uf21',
        degreeRequired: 'aprendiz',
        startDate: '2026-01-10',
        isAllDay: false,
        isMeeting: true, // Tenida
        location: 'Templo',
        status: 'celebrada',
        createdBy: 'sec',
        createdAt: '2026-01-01',
      },
      {
        id: 'ev-social-1',
        title: 'Cena Ágape Fraternal (Evento Social)',
        bodyId: 'uf21',
        degreeRequired: 'aprendiz',
        startDate: '2026-01-15',
        isAllDay: false,
        isMeeting: false, // NO es tenida
        location: 'Restaurante',
        status: 'celebrada',
        createdBy: 'sec',
        createdAt: '2026-01-01',
      },
    ];

    const attendance: AttendanceRecord[] = [
      { id: 'a1', eventId: 'ev-tenida-1', memberId: 'm1', status: 'presente', updatedBy: 'sec', updatedAt: 'now' },
      { id: 'a2', eventId: 'ev-tenida-1', memberId: 'm2', status: 'presente', updatedBy: 'sec', updatedAt: 'now' },
    ];

    const stats = attendanceService.calculateStatistics(events, attendance, 2);
    expect(stats.totalMeetings).toBe(1); // Solo 1 tenida
    expect(stats.averageAttendanceRate).toBe(100);
  });
});

describe('5. Visita Oficial de Inspección', () => {
  it('debe calcular el resumen automático considerando actas y asistencias', () => {
    const members: Member[] = [
      {
        id: 'm1',
        firstName: 'Carlos',
        lastName: 'Mendoza',
        email: 'carlos@logia.org',
        roleId: 'vm',
        degree: 'maestro',
        condition: 'activo',
        joinedAt: '2020-01-01',
        isActive: true,
      },
      {
        id: 'm2',
        firstName: 'Andrés',
        lastName: 'Rojas',
        email: 'andres@logia.org',
        roleId: 'sec',
        degree: 'maestro',
        condition: 'activo',
        joinedAt: '2020-01-01',
        isActive: true,
      },
    ];

    const events: LodgeEvent[] = [
      {
        id: 'e1',
        title: 'Tenida',
        bodyId: 'uf21',
        degreeRequired: 'aprendiz',
        startDate: '2026-02-01',
        isAllDay: false,
        isMeeting: true,
        location: 'Templo',
        status: 'celebrada',
        createdBy: 'sec',
        createdAt: '2026-01-01',
      },
    ];

    const minutes: Minute[] = [
      {
        id: 'min-1',
        number: 1,
        year: 2026,
        formatNumber: '01-2026',
        title: 'Acta Tenida',
        description: 'Trazado',
        meetingDate: '2026-02-01',
        degree: 'aprendiz',
        status: 'aprobada',
        createdBy: 'sec',
        createdAt: '2026-02-02',
        updatedAt: '2026-02-02',
      },
    ];

    const checklist: OfficialVisitChecklistItem[] = [
      { id: 1, title: 'Lista de asistencia', description: '', completed: true },
      { id: 2, title: 'Libro de Actas', description: '', completed: true },
    ];

    const summary = officialVisitService.computeAutomaticSummary(members, events, minutes, [], checklist);
    expect(summary.activeMembersCount).toBe(2);
    expect(summary.regularMeetingsHeld).toBe(1);
    expect(summary.approvedMinutesCount).toBe(1);
    expect(summary.charterStatus).toBe('valid');
  });
});

describe('6. Protección de Datos Sensibles de Miembros', () => {
  const member: Member = {
    id: 'm-secret',
    firstName: 'Hermano',
    lastName: 'Ejemplo',
    email: 'ejemplo@logia.org',
    roleId: 'her',
    degree: 'maestro',
    condition: 'activo',
    diplomaNumber: 'DIP-CONFIDENCIAL-1234',
    passportNumber: 'PASS-CONFIDENCIAL-5678',
    otherBodies: ['york', 'supremo_consejo'],
    joinedAt: '2020-01-01',
    isActive: true,
  };

  it('debe enmascarar diploma, pasaporte y otros cuerpos si el usuario no tiene view_sensitive_info', () => {
    const masked = memberService.filterSensitiveData(member, false);
    expect(masked.diplomaNumber).toBe('••••••••');
    expect(masked.passportNumber).toBe('••••••••');
    expect(masked.otherBodies).toEqual(['[Confidencial]']);
  });

  it('debe mostrar los datos originales si el usuario tiene permiso view_sensitive_info', () => {
    const unmasked = memberService.filterSensitiveData(member, true);
    expect(unmasked.diplomaNumber).toBe('DIP-CONFIDENCIAL-1234');
    expect(unmasked.passportNumber).toBe('PASS-CONFIDENCIAL-5678');
  });
});

describe('7. Biometría, Consentimiento y Ley 81 de Panamá', () => {
  it('debe rechazar la selfie si el usuario no otorgó el consentimiento explícito de la Ley 81', async () => {
    const dummyFrame = { data: new Uint8ClampedArray(400) } as ImageData;
    const result = await identityService.validateSelfie(dummyFrame, dummyFrame, false);
    expect(result.status).toBe('rejected');
    expect(result.message).toContain('Ley 81');
  });

  it('NUNCA debe devolver falsamente aprobado si el proveedor externo no está configurado', async () => {
    const dummyFrame1 = { data: new Uint8ClampedArray([100, 100, 100, 255, 100, 100, 100, 255]) } as ImageData;
    const dummyFrame2 = { data: new Uint8ClampedArray([115, 115, 115, 255, 100, 100, 100, 255]) } as ImageData;

    const result = await identityService.validateSelfie(dummyFrame1, dummyFrame2, true);
    // Si no hay API key configurada para Onfido/Persona, el resultado debe ser 'pending'
    expect(result.status).not.toBe('approved');
  });
});

describe('8. Convocatorias Protocolarias', () => {
  it('debe generar el texto protocolar conteniendo las siglas y datos de la logia', () => {
    const event: LodgeEvent = {
      id: 'e-conv',
      title: 'Tenida Solemne de Instalación',
      bodyId: 'uf21',
      degreeRequired: 'maestro',
      startDate: '2026-11-20',
      startTime: '19:30',
      isAllDay: false,
      isMeeting: true,
      location: 'Templo Mayor',
      status: 'programada',
      createdBy: 'sec',
      createdAt: '2026-09-01',
    };

    const text = convocationService.generateOfficialText(event);
    expect(text).toContain('A.·. L.·. G.·. D.·. G.·. A.·. D.·. U.·.');
    expect(text).toContain('CONVOCATORIA OFICIAL');
    expect(text).toContain('Tenida Solemne de Instalación');
  });
});

describe('9. Registro de Usuario Directo y Validación', () => {
  it('permite registrar un usuario directamente con nombre, correo y contraseña sin código obligatorio', async () => {
    vi.spyOn(supabase.auth, 'signUp').mockResolvedValueOnce({
      data: {
        user: { id: 'mock-user-123', email: 'nuevohermano@logia.org' } as any,
        session: null,
      },
      error: null,
    });
    vi.spyOn(authService, 'fetchProfile').mockResolvedValueOnce({
      id: 'mock-user-123',
      email: 'nuevohermano@logia.org',
      displayName: 'Carlos Mendoza',
      roleId: 'apr',
      technicalRole: 'member',
      identityVerified: false,
      identityStatus: 'pending',
      createdAt: new Date().toISOString(),
    });

    const user = await authService.register(
      'nuevohermano@logia.org',
      'secreto123',
      'Carlos',
      'Mendoza'
    );
    expect(user).toBeDefined();
    expect(user.displayName).toBe('Carlos Mendoza');
    expect(user.email).toBe('nuevohermano@logia.org');
    expect(user.profile?.roleId).toBe('apr');
    expect(user.profile?.identityVerified).toBe(false);
    expect(user.profile?.identityStatus).toBe('pending');
  });
});

