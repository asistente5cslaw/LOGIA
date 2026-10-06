import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AuditLog } from '@/types';

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

    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    {
        const { error } = await supabase.from('audit_logs').insert({
          action,
          entity,
          entity_id: entityId,
          user_id: user.id,
          user_email: user.email,
          details,
          created_at: record.createdAt,
        });
        if (error) throw error;
    }
  },

  async getLogs(limit: number = 50): Promise<AuditLog[]> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        if (data) {
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
      }
    return [];
  },
};
