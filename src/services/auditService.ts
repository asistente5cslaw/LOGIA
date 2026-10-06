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

  async getRoleChangeLogs(page = 1, pageSize = 10): Promise<{ logs: AuditLog[]; hasNext: boolean }> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    const { data, error, count } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('action', 'CAMBIAR_ROL_MIEMBRO')
      .eq('entity', 'members')
      .order('created_at', { ascending: false })
      .range(from, to - 1);

    if (error) throw error;
    const logs = (data || []).map((d) => ({
      id: d.id,
      action: d.action,
      entity: d.entity,
      entityId: d.entity_id,
      userId: d.user_id,
      userEmail: d.user_email,
      details: d.details,
      createdAt: d.created_at,
    }));

    const targetIds = logs.map((log) => log.entityId).filter((id): id is string => Boolean(id));
    const actorIds = logs.map((log) => log.userId).filter((id): id is string => Boolean(id && id !== 'sistema'));
    const [membersResult, profilesResult] = await Promise.all([
      targetIds.length > 0
        ? supabase.from('members').select('id, first_name, last_name').in('id', targetIds)
        : Promise.resolve({ data: [], error: null }),
      actorIds.length > 0
        ? supabase.from('profiles').select('id, display_name').in('id', actorIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (membersResult.error) throw membersResult.error;
    if (profilesResult.error) throw profilesResult.error;

    const targetNames = new Map(
      (membersResult.data || []).map((member) => [member.id, `${member.first_name} ${member.last_name}`.trim()])
    );
    const actorNames = new Map(
      (profilesResult.data || []).map((profile) => [profile.id, profile.display_name])
    );
    const enrichedLogs = logs.map((log) => {
      const details = { ...(log.details || {}) };
      if (!details.targetName && log.entityId && targetNames.has(log.entityId)) {
        details.targetName = targetNames.get(log.entityId);
      }
      if (!details.actorName && log.userId && actorNames.has(log.userId)) {
        details.actorName = actorNames.get(log.userId);
      }
      return { ...log, details };
    });

    return { logs: enrichedLogs, hasNext: (count ?? 0) > to };
  },
};
