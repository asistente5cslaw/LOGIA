import type { LodgeEvent, Member } from '@/types';
import { getIsoDateInTimeZone, normalizeDateOnly } from '@/lib/dateUtils';

export interface DashboardStats {
  activeCount: number;
  upcomingTenidasCount: number;
  upcomingReunionsCount: number;
}

/** Returns the calendar date in the browser's local timezone. */
export function getLocalIsoDate(now = new Date()): string {
  return getIsoDateInTimeZone(now);
}

/** Supabase date columns can arrive as a date or as an ISO timestamp. */
export function getEventIsoDate(value: string | undefined): string {
  return normalizeDateOnly(value);
}

export function isUpcomingEvent(event: LodgeEvent, today = getLocalIsoDate()): boolean {
  return event.status !== 'cancelada' && getEventIsoDate(event.startDate) >= today;
}

export function getEventCategory(event: Pick<LodgeEvent, 'eventCategory'>): LodgeEvent['eventCategory'] {
  return event.eventCategory;
}

export function calculateDashboardStats(
  members: Member[],
  events: LodgeEvent[],
  today = getLocalIsoDate(),
): DashboardStats {
  const upcoming = events.filter((event) => isUpcomingEvent(event, today));

  return {
    activeCount: members.filter((member) => member.isActive).length,
    upcomingTenidasCount: upcoming.filter((event) => getEventCategory(event) === 'tenida').length,
    upcomingReunionsCount: upcoming.filter((event) => getEventCategory(event) !== 'tenida').length,
  };
}
