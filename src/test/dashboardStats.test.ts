import { describe, expect, it } from 'vitest';
import { calculateDashboardStats, getEventIsoDate } from '@/domain/dashboardStats';
import { getIsoDateInTimeZone, parseLodgeDateTime } from '@/lib/dateUtils';
import type { LodgeEvent, Member } from '@/types';

const member = (isActive: boolean): Member => ({
  id: String(isActive), firstName: 'Test', lastName: 'Member', email: `${isActive}@test.local`,
  roleId: 'her', degree: 'maestro', condition: isActive ? 'activo' : 'inactivo',
  joinedAt: '2026-01-01', isActive,
});

const event = (overrides: Partial<LodgeEvent>): LodgeEvent => ({
  id: 'event', title: 'Actividad', bodyId: 'uf21', degreeRequired: 'maestro',
  startDate: '2026-10-14T00:00:00+00:00', isAllDay: false, eventCategory: 'otro',
  location: 'Templo', status: 'programada', createdBy: 'user', createdAt: '2026-01-01',
  ...overrides,
});

describe('dashboardStats', () => {
  it('counts active members and upcoming tenidas/reunions independently', () => {
    const stats = calculateDashboardStats(
      [member(true), member(false)],
      [
        event({ id: 'tenida', eventCategory: 'tenida' }),
        event({ id: 'reunion', eventCategory: 'reunion_fraternal' }),
        event({ id: 'cancelled', eventCategory: 'tenida', status: 'cancelada' }),
      ],
      '2026-10-12',
    );

    expect(stats).toEqual({ activeCount: 1, upcomingTenidasCount: 1, upcomingReunionsCount: 1 });
  });

  it('supports ISO timestamps and canonical event categories', () => {
    expect(getEventIsoDate('2026-10-14T00:00:00+00:00')).toBe('2026-10-14');
    const stats = calculateDashboardStats([], [event({ eventCategory: 'tenida' })], '2026-10-12');
    expect(stats.upcomingTenidasCount).toBe(1);
  });

  it('keeps calendar dates in Panama instead of shifting them to UTC', () => {
    expect(getIsoDateInTimeZone(new Date('2026-10-13T04:30:00.000Z'))).toBe('2026-10-12');
    expect(parseLodgeDateTime('2026-10-12', '19:00').toISOString()).toBe('2026-10-13T00:00:00.000Z');
  });
});
