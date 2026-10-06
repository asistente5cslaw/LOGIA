import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Member, MasonicDegree, MemberStatusCondition, InstitutionalRoleCode } from '@/types';
import { auditService } from './auditService';

function degreeForRole(roleId: InstitutionalRoleCode): MasonicDegree {
  if (roleId === 'apr' || roleId === 'her') return 'aprendiz';
  if (roleId === 'comp') return 'companero';
  return 'maestro';
}

function mapSupabaseMember(d: Record<string, unknown>): Member {
  const value = (key: string) => d[key];
  const roleId = value('role_id') as InstitutionalRoleCode;
  return {
    id: String(value('id')),
    firstName: String(value('first_name') || ''),
    lastName: String(value('last_name') || ''),
    email: String(value('email') || ''),
    phone: value('phone') as string | undefined,
    roleId,
    degree: degreeForRole(roleId),
    condition: value('condition') as MemberStatusCondition,
    motherLodge: value('mother_lodge') as string | undefined,
    initiationDate: value('initiation_date') as string | undefined,
    passingDate: value('passing_date') as string | undefined,
    raisingDate: value('raising_date') as string | undefined,
    diplomaNumber: value('diploma_number') as string | undefined,
    passportNumber: value('passport_number') as string | undefined,
    otherBodies: (value('other_bodies') as string[] | null) || [],
    avatarUrl: value('avatar_url') as string | undefined,
    joinedAt: String(value('joined_at') || ''),
    isActive: Boolean(value('is_active')),
    deletedAt: value('deleted_at') as string | undefined,
    createdAt: value('created_at') as string | undefined,
    updatedAt: value('updated_at') as string | undefined,
    identityVerified: value('identity_verified') as boolean | undefined,
    identityStatus: (value('identity_status') as Member['identityStatus']) || (value('is_active') ? 'verified' : 'pending'),
    selfieUrl: value('selfie_url') as string | undefined,
    identityValidatedAt: value('identity_validated_at') as string | undefined,
    identityValidatedBy: value('identity_validated_by') as string | undefined,
    identityNotes: value('identity_notes') as string | undefined,
  };
}

function mapProfileAsMember(profile: Record<string, unknown>): Member {
  const displayName = String(profile.display_name || profile.email || 'Hermano').trim();
  const parts = displayName.split(/\s+/);
  const firstName = parts.shift() || 'Hermano';
  const lastName = parts.join(' ') || 'Sin apellido';

  const roleId = (profile.role_id || 'apr') as InstitutionalRoleCode;

  return {
    id: String(profile.member_id || profile.id),
    firstName,
    lastName,
    email: String(profile.email || ''),
    roleId,
    degree: degreeForRole(roleId),
    condition: 'activo',
    motherLodge: 'Resp.·. Log.·. Unión Fraternal No. 21',
    joinedAt: String(profile.created_at || new Date().toISOString()).split('T')[0],
    isActive: true,
    createdAt: profile.created_at as string | undefined,
    identityVerified: Boolean(profile.identity_verified),
    identityStatus: (profile.identity_status || 'pending') as Member['identityStatus'],
  };
}

export const memberService = {
  async saveRegistrationIdentity(
    memberId: string,
    identity: Pick<Member, 'identityVerified' | 'identityStatus' | 'selfieUrl' | 'identityValidatedAt'>
  ): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');

    const { error } = await supabase
      .from('members')
      .update({
        identity_verified: identity.identityVerified ?? false,
        identity_status: identity.identityStatus || 'pending',
        selfie_url: identity.selfieUrl || null,
        identity_validated_at: identity.identityValidatedAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId);

    if (error) throw error;
  },

  async getAllMembers(includeInactive = true, includeDeleted = false, includeIdentity = false): Promise<Member[]> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');

    let membersFromDatabase: Member[] = [];
    let query = includeIdentity
      ? supabase.from('members').select('*')
      : supabase.from('members').select('id, first_name, last_name, email, phone, role_id, degree, condition, mother_lodge, initiation_date, passing_date, raising_date, diploma_number, passport_number, other_bodies, avatar_url, joined_at, is_active, deleted_at, identity_verified, identity_status, identity_validated_at, identity_validated_by, identity_notes, created_at, updated_at');
      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }
      if (!includeInactive) {
        query = query.eq('is_active', true);
      }
      const { data, error } = await query.order('last_name', { ascending: true });
      if (error) throw error;
      if (data) membersFromDatabase = data.map(mapSupabaseMember);


    // Los registros creados por Auth que todavía no estén vinculados aparecen
    // también para que ningún usuario real quede oculto del directorio.
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, member_id, email, display_name, role_id, identity_verified, identity_status, created_at')
      .order('created_at', { ascending: true });
    if (profilesError) throw profilesError;
    if (profiles) {
      const knownEmails = new Set(membersFromDatabase.map((m) => m.email.toLowerCase()));
      const visibleMemberIds = new Set(membersFromDatabase.map((m) => m.id));
      const profileMembers = profiles
        .filter((profile) => {
          if (!profile.email || knownEmails.has(String(profile.email).toLowerCase())) return false;
          // Un perfil vinculado a un miembro dado de baja no debe reaparecer
          // como si fuera un registro independiente.
          if (profile.member_id && !visibleMemberIds.has(String(profile.member_id))) return false;
          return true;
        })
        .map(mapProfileAsMember);
      membersFromDatabase = [...membersFromDatabase, ...profileMembers];
    }

    return includeInactive ? membersFromDatabase : membersFromDatabase.filter((m) => m.isActive);
  },

  async getMemberById(id: string): Promise<Member | undefined> {
    const list = await this.getAllMembers(true, false, true);
    return list.find((m) => m.id === id);
  },

  async saveMember(
    member: Omit<Member, 'id' | 'joinedAt'> & { id?: string },
    user: { id?: string; email?: string; name?: string }
  ): Promise<Member> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
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

    {
      try {
        const payload = {
          id: member.id,
          first_name: member.firstName,
          last_name: member.lastName,
          email: member.email,
          phone: member.phone,
          role_id: member.roleId,
          degree: degreeForRole(member.roleId),
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
          identity_verified: member.identityVerified ?? false,
          identity_status: member.identityStatus || 'pending',
          selfie_url: member.selfieUrl,
          identity_validated_at: member.identityValidatedAt,
          identity_validated_by: member.identityValidatedBy,
          identity_notes: member.identityNotes,
          updated_by: user.id,
        };

        if (isNew) {
          const { data, error } = await supabase.from('members').insert(payload).select().single();
          if (error) throw error;
          if (data) completeMember.id = data.id;
        } else {
          const { error } = await supabase.from('members').update(payload).eq('id', member.id);
          if (error) throw error;

          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              identity_verified: member.identityVerified ?? false,
              identity_status: member.identityStatus || 'pending',
            })
            .eq('member_id', member.id);
          if (profileError) throw profileError;
        }
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'No se pudo guardar el miembro en Supabase.');
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
    user: { id?: string; email?: string; name?: string }
  ): Promise<Member> {
    const now = new Date().toISOString();
    const previousMember = await this.getMemberById(memberId);
    if (!previousMember) throw new Error('Miembro no encontrado.');

    if (isSupabaseConfigured()) {
      // 1. Actualizar en la tabla members (si existe ese registro)
      const { data: updatedMember, error: memberError } = await supabase
          .from('members')
          .update({
            role_id: roleId,
            degree: degreeForRole(roleId),
            updated_at: now,
          })
          .eq('id', memberId)
          .select('id')
          .single();
      if (memberError) throw memberError;
      if (!updatedMember) throw new Error('No se encontró el miembro que se intentó actualizar.');

      // 2. Actualizar en la tabla profiles (por member_id o id)
      const { error: profileError } = await supabase
          .from('profiles')
          .update({ role_id: roleId })
          .or(`member_id.eq.${memberId},id.eq.${memberId}`);
      if (profileError) throw profileError;
    } else {
      throw new Error('Supabase no está configurado.');
    }

    await auditService.log('CAMBIAR_ROL_MIEMBRO', 'members', memberId, user, {
      targetMemberId: memberId,
      targetName: `${previousMember.firstName} ${previousMember.lastName}`,
      actorName: user.name,
      previousRoleId: previousMember.roleId,
      newRoleId: roleId,
    });

    // Devolver el miembro actualizado
    const allMembers = await this.getAllMembers(true);
    const updated = allMembers.find((m) => m.id === memberId);
    if (updated) return updated;

    throw new Error('El cargo se actualizó, pero no se pudo recargar el miembro.');
  },

  async softDeleteMember(id: string, user: { id?: string; email?: string }): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    const { error } = await supabase
      .from('members')
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await auditService.log('BAJA_LOGICA_MIEMBRO', 'members', id, user, {});
  },

  async restoreMember(id: string, user: { id?: string; email?: string; name?: string }): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    const { error } = await supabase
      .from('members')
      .update({ is_active: true, deleted_at: null, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await auditService.log('RESTAURAR_ACCESO_MIEMBRO', 'members', id, user, {
      actorName: user.name,
    });
  },

  async permanentlyDeleteMember(id: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    const { error } = await supabase.rpc('permanently_delete_member', {
      target_member_id: id,
    });
    if (error) throw error;
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
      const { error } = await supabase
          .from('members')
          .update(payload)
          .eq('id', memberId);
      if (error) throw error;

      // La pantalla de acceso restringido consulta el estado en profiles.
      // Mantener ambos registros sincronizados permite liberar el acceso
      // inmediatamente después de aprobar la identidad.
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          identity_status: status,
          identity_verified: status === 'verified',
          updated_at: now,
        })
        .or(`member_id.eq.${memberId},id.eq.${memberId}`);
      if (profileError) throw profileError;
    }

    const members = await this.getAllMembers(true, false, true);
    const member = members.find((m) => m.id === memberId);
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
