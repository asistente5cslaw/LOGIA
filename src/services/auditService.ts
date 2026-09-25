import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AuditLog } from '@/types';

const LOCAL_AUDIT_KEY = 'logia_audit_logs';

function getStoredLogs(): AuditLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_AUDIT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredLogs(logs: AuditLog[]) {
  try {
    localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(logs.slice(0, 100)));
  } catch {
    // ignore
  }
}

export const auditService = {
  async log(
    action: string,
    entity: string,
    entityId: string | undefined,
    user: { id?: string; email?: string },
    details?: Record<string, unknown>
  ): Promise<void> {
    const record: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      action,
      entity,
      entityId,
      userId: user.id || 'sistema',
      userEmail: user.email || 'anonimo@logia.org',
      details,
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('audit_logs').insert({
          action,
          entity,
          entity_id: entityId,
          user_id: user.id,
          user_email: user.email,
          details,
          created_at: record.createdAt,
        });
        return;
      } catch (e) {
        console.warn('Fallo al registrar en Supabase audit_logs, guardando localmente:', e);
      }
    }

    const current = getStoredLogs();
    saveStoredLogs([record, ...current]);
  },

  async getLogs(limit: number = 50): Promise<AuditLog[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!error && data) {
          return data.map((d) => ({
            id: d.id,
            action: d.action,
            entity: d.entity,
            entityId: d.entity_id,
            userId: d.user_id,
            userEmail: d.user_email,
            details: d.details,
            createdAt: d.created_at,
          }));
        }
      } catch (e) {
        console.warn('Error al consultar logs en Supabase:', e);
      }
    }

    return getStoredLogs().slice(0, limit);
  },
};
