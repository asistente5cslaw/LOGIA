import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Member, MasonicDegree, MemberStatusCondition, InstitutionalRoleCode } from '@/types';
import { members as mockMembers } from '@/data/mock';
import { auditService } from './auditService';

const LOCAL_MEMBERS_KEY = 'logia_members_data';

function loadLocalMembers(): Member[] {
  try {
    const raw = localStorage.getItem(LOCAL_MEMBERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((m: Member) => {
          const mockMatch = mockMembers.find((mock) => mock.id === m.id);
          return {
            ...m,
            identityStatus: m.identityStatus || mockMatch?.identityStatus || (m.isActive ? 'verified' : 'pending'),
            identityVerified: m.identityVerified ?? (mockMatch?.identityVerified ?? (m.isActive ? true : false)),
            selfieUrl: m.selfieUrl || mockMatch?.selfieUrl,
            identityValidatedAt: m.identityValidatedAt || mockMatch?.identityValidatedAt,
            identityValidatedBy: m.identityValidatedBy || mockMatch?.identityValidatedBy,
            identityNotes: m.identityNotes || mockMatch?.identityNotes,
          };
        });
      }
    }
  } catch {
    // fallback
  }
  saveLocalMembers(mockMembers);
  return mockMembers;
}

function saveLocalMembers(list: Member[]) {
  try {
    localStorage.setItem(LOCAL_MEMBERS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export const memberService = {
  async getAllMembers(includeInactive = true): Promise<Member[]> {
    if (isSupabaseConfigured()) {
      try {
        let query = supabase.from('members').select('*').is('deleted_at', null);
        if (!includeInactive) {
          query = query.eq('is_active', true);
        }
        const { data, error } = await query.order('last_name', { ascending: true });
        if (!error && data) {
          return data.map((d) => ({
            id: d.id,
            firstName: d.first_name,
            lastName: d.last_name,
            email: d.email,
            phone: d.phone,
            roleId: d.role_id,
            degree: d.degree,
            condition: d.condition,
            motherLodge: d.mother_lodge,
            initiationDate: d.initiation_date,
            passingDate: d.passing_date,
            raisingDate: d.raising_date,
            diplomaNumber: d.diploma_number,
            passportNumber: d.passport_number,
            otherBodies: d.other_bodies || [],
            avatarUrl: d.avatar_url,
            joinedAt: d.joined_at,
            isActive: d.is_active,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
            identityVerified: d.identity_verified,
            identityStatus: d.identity_status || (d.is_active ? 'verified' : 'pending'),
            selfieUrl: d.selfie_url,
            identityValidatedAt: d.identity_validated_at,
            identityValidatedBy: d.identity_validated_by,
            identityNotes: d.identity_notes,
          }));
        }
      } catch (e) {
        console.warn('Fallo consulta Supabase members, usando local:', e);
      }
    }

    const local = loadLocalMembers();
    return includeInactive ? local : local.filter((m) => m.isActive);
  },

  async getMemberById(id: string): Promise<Member | undefined> {
    const list = await this.getAllMembers(true);
    return list.find((m) => m.id === id);
  },

  async saveMember(
    member: Omit<Member, 'id' | 'joinedAt'> & { id?: string },
    user: { id?: string; email?: string }
  ): Promise<Member> {
    const now = new Date().toISOString();
    const isNew = !member.id;
    const memberId = member.id || `m-${Date.now()}`;

    const completeMember: Member = {
      ...member,
      id: memberId,
      joinedAt: member.initiationDate || new Date().toISOString().split('T')[0],
      createdAt: now,
      updatedAt: now,
    };

    if (isSupabaseConfigured()) {
      try {
        const payload = {
          id: member.id,
          first_name: member.firstName,
          last_name: member.lastName,
          email: member.email,
          phone: member.phone,
          role_id: member.roleId,
          degree: member.degree,
          condition: member.condition,
          mother_lodge: member.motherLodge,
          initiation_date: member.initiationDate,
          passing_date: member.passingDate,
          raising_date: member.raisingDate,
          diploma_number: member.diplomaNumber,
          passport_number: member.passportNumber,
          other_bodies: member.otherBodies,
          avatar_url: member.avatarUrl,
          is_active: member.isActive,
        };

        if (isNew) {
          const { data } = await supabase.from('members').insert(payload).select().single();
          if (data) completeMember.id = data.id;
        } else {
          await supabase.from('members').update(payload).eq('id', member.id);
        }
      } catch (e) {
        console.warn('Error guardando en Supabase members:', e);
      }
    }

    // Always keep local updated
    const local = loadLocalMembers();
    const existingIdx = local.findIndex((m) => m.id === completeMember.id);
    if (existingIdx >= 0) {
      local[existingIdx] = completeMember;
    } else {
      local.push(completeMember);
    }
    saveLocalMembers(local);

    // Sync session profile role if this member is the current session
    if (completeMember.email && completeMember.roleId) {
      try {
        const raw = localStorage.getItem('logia_session_backup');
        if (raw) {
          const sessionUser = JSON.parse(raw);
          if (sessionUser?.email?.toLowerCase() === completeMember.email.toLowerCase() && sessionUser.profile) {
            sessionUser.profile.roleId = completeMember.roleId;
            localStorage.setItem('logia_session_backup', JSON.stringify(sessionUser));
          }
        }
      } catch {
        // ignore
      }
    }

    await auditService.log(
      isNew ? 'CREAR_MIEMBRO' : 'ACTUALIZAR_MIEMBRO',
      'members',
      completeMember.id,
      user,
      { name: `${completeMember.firstName} ${completeMember.lastName}`, role: completeMember.roleId }
    );

    return completeMember;
  },

  async updateMemberRole(
    memberId: string,
    roleId: InstitutionalRoleCode,
    user: { id?: string; email?: string }
  ): Promise<Member> {
    const local = loadLocalMembers();
    const member = local.find((m) => m.id === memberId);
    if (!member) throw new Error('Miembro no encontrado');
    member.roleId = roleId;
    member.updatedAt = new Date().toISOString();
    return this.saveMember(member, user);
  },

  async softDeleteMember(id: string, user: { id?: string; email?: string }): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('members')
          .update({ is_active: false, deleted_at: new Date().toISOString() })
          .eq('id', id);
      } catch (e) {
        console.warn('Error en softDelete Supabase:', e);
      }
    }

    const local = loadLocalMembers();
    const member = local.find((m) => m.id === id);
    if (member) {
      member.isActive = false;
      saveLocalMembers(local);
      await auditService.log('BAJA_LOGICA_MIEMBRO', 'members', id, user, {
        name: `${member.firstName} ${member.lastName}`,
      });
    }
  },

  async updateIdentityStatus(
    memberId: string,
    status: 'verified' | 'rejected' | 'pending',
    validatorUser: { id?: string; email?: string; displayName?: string },
    notes?: string,
    newSelfieUrl?: string
  ): Promise<Member> {
    const now = new Date().toISOString();
    const validatorName = validatorUser.displayName || validatorUser.email || 'Secretaría / Venerable Maestro';

    if (isSupabaseConfigured()) {
      try {
        const payload: Record<string, unknown> = {
          identity_status: status,
          identity_verified: status === 'verified',
          identity_validated_at: now,
          identity_validated_by: validatorName,
          identity_notes: notes || null,
          updated_at: now,
        };
        if (newSelfieUrl) {
          payload.selfie_url = newSelfieUrl;
        }
        await supabase
          .from('members')
          .update(payload)
          .eq('id', memberId);
      } catch (e) {
        console.warn('Error actualizando estado de identidad en Supabase:', e);
      }
    }

    const local = loadLocalMembers();
    const member = local.find((m) => m.id === memberId);
    if (!member) {
      throw new Error('Miembro no encontrado');
    }

    member.identityStatus = status;
    member.identityVerified = status === 'verified';
    member.identityValidatedAt = now;
    member.identityValidatedBy = validatorName;
    if (newSelfieUrl) {
      member.selfieUrl = newSelfieUrl;
    }
    if (notes !== undefined) {
      member.identityNotes = notes;
    }
    member.updatedAt = now;

    saveLocalMembers(local);

    await auditService.log(
      'VALIDACION_IDENTIDAD_BIOMETRICA',
      'members',
      memberId,
      validatorUser,
      {
        status,
        name: `${member.firstName} ${member.lastName}`,
        validator: validatorName,
        notes,
      }
    );

    return member;
  },

  filterSensitiveData(member: Member, canViewSensitive: boolean): Member {
    if (canViewSensitive) return member;
    return {
      ...member,
      diplomaNumber: member.diplomaNumber ? '••••••••' : undefined,
      passportNumber: member.passportNumber ? '••••••••' : undefined,
      otherBodies: member.otherBodies ? ['[Confidencial]'] : [],
    };
  },

  exportMembersCSV(members: Member[]): string {
    const headers = [
      'ID',
      'Nombres',
      'Apellidos',
      'Correo',
      'Teléfono',
      'Rol',
      'Grado',
      'Condición',
      'Logia Madre',
      'Fecha Iniciación',
      'Diploma No.',
      'Pasaporte No.',
      'Estado',
    ];

    const rows = members.map((m) => [
      m.id,
      `"${m.firstName}"`,
      `"${m.lastName}"`,
      m.email,
      m.phone || '',
      m.roleId,
      m.degree,
      m.condition,
      `"${m.motherLodge || ''}"`,
      m.initiationDate || '',
      m.diplomaNumber || '',
      m.passportNumber || '',
      m.isActive ? 'Activo' : 'Inactivo',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  },

  validateImportCSV(csvText: string): { valid: Member[]; errors: string[] } {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length <= 1) {
      return { valid: [], errors: ['El archivo CSV no contiene registros de datos.'] };
    }

    const valid: Member[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
      if (cols.length < 4) {
        errors.push(`Fila ${i + 1}: Columnas insuficientes (${cols.length}). Se requieren mínimo Nombres, Apellidos, Correo.`);
        continue;
      }

      const [id, firstName, lastName, email, phone, roleId, degree, condition] = cols;

      if (!email || !email.includes('@')) {
        errors.push(`Fila ${i + 1}: Correo electrónico no válido (${email}).`);
        continue;
      }

      valid.push({
        id: id || `m-imp-${Date.now()}-${i}`,
        firstName: firstName || 'Hermano',
        lastName: lastName || 'Masón',
        email,
        phone: phone || undefined,
        roleId: (roleId || 'her') as InstitutionalRoleCode,
        degree: (['aprendiz', 'companero', 'maestro'].includes(degree) ? degree : 'aprendiz') as MasonicDegree,
        condition: (['activo', 'ad_vitam', 'dual', 'inactivo'].includes(condition) ? condition : 'activo') as MemberStatusCondition,
        joinedAt: new Date().toISOString().split('T')[0],
        isActive: true,
      });
    }

    return { valid, errors };
  },
};
