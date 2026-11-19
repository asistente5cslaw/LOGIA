import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { LodgeEvent } from '@/types';

export interface GoogleCalendarIntegrationStatus {
  connected: boolean;
  integration?: {
    account_email: string;
    calendar_id: string;
    connected_at: string;
    last_sync_at?: string;
    last_error?: string;
  } | null;
}

async function invoke(action: string, body: Record<string, unknown> = {}) {
  if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.functions.invoke(`google-calendar-oauth?action=${action}`, { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export const googleCalendarService = {
  async getStatus(): Promise<GoogleCalendarIntegrationStatus> {
    return invoke('status');
  },

  async connect(): Promise<void> {
    const data = await invoke('start');
    if (!data?.authUrl) throw new Error('Google no devolvió la URL de autorización.');
    window.location.assign(data.authUrl);
  },

  async disconnect(): Promise<void> {
    await invoke('disconnect');
  },

  async syncEvent(event: LodgeEvent, operation: 'create' | 'update' | 'cancel' | 'delete') {
    return invoke('sync', {
      operation,
      event: {
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        startTime: event.startTime,
        endTime: event.endTime,
        isAllDay: event.isAllDay,
        location: event.location,
        notes: event.notes,
        googleCalendarEventId: event.googleCalendarEventId,
        googleCalendarHtmlLink: event.googleCalendarHtmlLink,
      },
    });
  },
};
