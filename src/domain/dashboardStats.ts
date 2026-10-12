import type { LodgeEvent, Member } from '@/types';

export interface DashboardStats {
  activeCount: number;
  upcomingTenidasCount: number;
  upcomingReunionsCount: number;
}

/** Returns the calendar date in the browser's local timezone. */
export function getLocalIsoDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Supabase date columns can arrive as a date or as an ISO timestamp. */
export function getEventIsoDate(value: string | undefined): string {
  return String(value || '').slice(0, 10);
}

export function isUpcomingEvent(event: LodgeEvent, today = getLocalIsoDate()): boolean {
  return event.status !== 'cancelada' && getEventIsoDate(event.startDate) >= today;
}

export function getEventCategory(event: Pick<LodgeEvent, 'eventCategory' | 'isMeeting'>): LodgeEvent['eventCategory'] {
  // Keep older rows working until every event has event_category populated.
  return event.eventCategory || (event.isMeeting ? 'tenida' : 'otro');
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
