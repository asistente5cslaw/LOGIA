import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { User, UserProfile, Invitation, MasonicDegree, InstitutionalRoleCode } from '@/types';
import { institutionalRoles } from '@/data/rolesData';
import { auditService } from './auditService';

const LOCAL_INVITATIONS_KEY = 'logia_invitations_data';

const defaultInvitations: Invitation[] = [];

function loadLocalInvitations(): Invitation[] {
  try {
    const raw = localStorage.getItem(LOCAL_INVITATIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return defaultInvitations;
}

function saveLocalInvitations(list: Invitation[]) {
  try {
    localStorage.setItem(LOCAL_INVITATIONS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

/**
 * Traduce errores técnicos de Supabase Auth a mensajes claros en español.
 */
export function translateAuthError(error: unknown): string {
  if (!error) return 'Ocurrió un error inesperado.';
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'Correo o contraseña incorrectos. Verifica tus credenciales.';
  }
  if (msg.includes('Email not confirmed')) {
    return 'Debes confirmar tu correo electrónico antes de ingresar. Revisa tu bandeja de entrada.';
  }
  if (msg.includes('User already registered') || msg.includes('already_registered')) {
    return 'Este correo ya se encuentra registrado en el sistema.';
  }
  if (msg.includes('Password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (msg.includes('Token has expired') || msg.includes('expired')) {
    return 'El enlace o código de seguridad ha expirado. Solicita uno nuevo.';
  }
  if (msg.includes('Rate limit')) {
    return 'Demasiados intentos. Espera unos momentos antes de intentar nuevamente.';
  }
  if (msg.includes('Network') || msg.includes('fetch')) {
    return 'Error de conexión de red. Verifica tu conexión a internet.';
  }
  if (msg.includes('Database error saving new user')) {
    return 'Error en el disparador de base de datos de Supabase. Aplica la migración actualizada en el SQL Editor.';
  }

  return msg;
}

export const authService = {
  /**
   * Valida un código de invitación.
   * REGLA: No se puede registrar sin una invitación válida y activa.
   */
  async validateInvitation(code: string, email = ''): Promise<{ valid: boolean; invitation?: Invitation; message?: string }> {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      return { valid: false, message: 'Ingresa un código de invitación.' };
    }

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.rpc('validate_invitation', {
          p_code: cleanCode,
          p_email: email.trim(),
        });
        if (error) return { valid: false, message: 'No se pudo validar la invitación. Inténtalo nuevamente.' };

        const result = data as {
          valid?: boolean;
          message?: string;
          invitation?: { id: string; code: string; email?: string; degree: MasonicDegree; role_id: InstitutionalRoleCode; expires_at: string };
        } | null;

        if (result?.valid && result.invitation) {
          const data = result.invitation;
          return {
            valid: true,
            invitation: {
              id: data.id,
              code: data.code,
              email: data.email,
              degree: data.degree,
              roleId: data.role_id,
              createdBy: 'u-sec',
              expiresAt: data.expires_at,
              isUsed: false,
              createdAt: new Date().toISOString(),
            },
          };
        }
        return { valid: false, message: result?.message || 'Código no válido, vencido o asignado a otro correo.' };
      } catch (e) {
        console.warn('Error verificando invitación en Supabase:', e);
        return { valid: false, message: 'No se pudo validar la invitación. Inténtalo nuevamente.' };
      }
    }

    const localList = loadLocalInvitations();
    const inv = localList.find((i) => i.code.toUpperCase() === cleanCode && !i.isUsed);
    if (!inv) {
      return { valid: false, message: 'Código de invitación no válido o ya utilizado.' };
    }
    const isExpired = new Date(inv.expiresAt) < new Date();
    if (isExpired) {
      return { valid: false, message: 'Este código de invitación ha expirado.' };
    }

    return { valid: true, invitation: inv };
  },

  async markInvitationUsed(code: string, userId: string): Promise<void> {
    const cleanCode = code.trim().toUpperCase();
    if (isSupabaseConfigured()) return; // La consume el trigger al crear auth.users.
    const local = loadLocalInvitations();
    const inv = local.find((i) => i.code.toUpperCase() === cleanCode);
    if (inv) {
      inv.isUsed = true;
      inv.usedAt = new Date().toISOString();
      saveLocalInvitations(local);
    }
  },

  async createInvitation(
    degree: MasonicDegree,
    roleId: InstitutionalRoleCode,
    email: string | undefined,
    user: { id?: string; email?: string }
  ): Promise<Invitation> {
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(4)), (value) =>
      value.toString(16).padStart(2, '0')
    ).join('').toUpperCase();
    const code = `UF21-${roleId.toUpperCase()}-${randomHex}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 días

    const newInv: Invitation = {
      id: crypto.randomUUID(),
      code,
      email,
      degree,
      roleId,
      createdBy: user.id || 'sec',
      expiresAt,
      isUsed: false,
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('invitations').insert({
          code: newInv.code,
          email: newInv.email || null,
          degree: newInv.degree,
          role_id: newInv.roleId,
          expires_at: newInv.expiresAt,
          is_used: false,
          created_by: user.id,
        }).select('id, created_at').single();
      if (error || !data) throw new Error('No se pudo guardar la invitación en Supabase.');
      newInv.id = data.id;
      newInv.createdAt = data.created_at;
    } else {
      const local = loadLocalInvitations();
      local.unshift(newInv);
      saveLocalInvitations(local);
    }

    await auditService.log('CREAR_INVITACION', 'invitations', newInv.id, user, {
      code: newInv.code,
      roleId,
      degree,
    });

    return newInv;
  },

  async getInvitations(): Promise<Invitation[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('invitations')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) {
          return data.map((d) => ({
            id: d.id,
            code: d.code,
            email: d.email,
            degree: d.degree,
            roleId: d.role_id,
            createdBy: d.created_by,
            expiresAt: d.expires_at,
            isUsed: d.is_used,
            usedAt: d.used_at,
            createdAt: d.created_at,
          }));
        }
      } catch (e) {
        console.warn('Error listando invitaciones Supabase:', e);
      }
    }
    return loadLocalInvitations();
  },

  /**
   * Inicio de sesión con correo y contraseña en Supabase Auth
   */
  async login(email: string, password: string): Promise<User> {
    if (isSupabaseConfigured()) {
      const cleanEmail = email.trim();
      
      // Protección con timeout de 8 segundos contra bloqueos de red
      const signInPromise = supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      const timeoutPromise = new Promise<{ data: { user: null; session: null }; error: { message: string } }>((_, reject) =>
        setTimeout(() => reject(new Error('El servidor tardó demasiado en responder. Verifica tu conexión.')), 8000)
      );

      const { data, error } = (await Promise.race([signInPromise, timeoutPromise])) as {
        data: { user: any; session: any };
        error: any;
      };

      if (error) {
        throw new Error(translateAuthError(error));
      }

      if (!data.user) {
        throw new Error('Credenciales incorrectas o usuario no encontrado.');
      }

      const profile = await this.fetchProfile(data.user.id, data.user.email || cleanEmail);
      const user: User = {
        id: data.user.id,
        email: data.user.email || cleanEmail,
        memberId: profile.memberId,
        displayName: profile.displayName,
        isAuthenticated: true,
        profile,
      };

      // Auditoría en segundo plano sin bloquear el flujo del usuario
      auditService.log('INICIO_SESION', 'auth', user.id, { id: user.id, email: user.email }).catch(console.warn);
      return user;
    }

    // Modo demostración cuando Supabase URL no ha sido configurada en .env
    // Validar formato estricto
    if (!email || !password || password.length < 6) {
      throw new Error('Ingresa un correo válido y una contraseña de al menos 6 caracteres.');
    }

    // Buscar si corresponde a un hermano conocido
    const defaultName = email.includes('carlos')
      ? 'Carlos Mendoza'
      : email.includes('andres')
      ? 'Andrés Rojas'
      : 'Hermano Masón';

    const fallbackRole = email.includes('carlos')
      ? 'vm'
      : email.includes('andres')
      ? 'sec'
      : 'her';

    const roleInfo = institutionalRoles.find((r) => r.id === fallbackRole)!;

    const mockProfile: UserProfile = {
      id: `u-${Date.now()}`,
      email,
      displayName: defaultName,
      roleId: fallbackRole,
      technicalRole: roleInfo.technicalRole,
      identityVerified: true,
      identityStatus: 'verified',
      createdAt: new Date().toISOString(),
    };

    const user: User = {
      id: mockProfile.id,
      email,
      displayName: defaultName,
      isAuthenticated: true,
      profile: mockProfile,
    };

    localStorage.setItem('logia_session_backup', JSON.stringify(user));
    await auditService.log('INICIO_SESION', 'auth', user.id, { id: user.id, email: user.email });
    return user;
  },

  /**
   * Registro con credenciales en Supabase Auth o modo local
   */
  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    invitationCode?: string
  ): Promise<User> {
    let assignedRoleId: InstitutionalRoleCode = 'her';
    if (invitationCode && invitationCode.trim()) {
      const invCheck = await this.validateInvitation(invitationCode, email);
      if (invCheck.valid && invCheck.invitation) {
        assignedRoleId = invCheck.invitation.roleId;
      }
    }

    const displayName = `${firstName.trim()} ${lastName.trim()}`;

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            invitation_code: invitationCode ? invitationCode.trim().toUpperCase() : null,
            role_id: assignedRoleId,
          },
        },
      });

      if (error) {
        throw new Error(translateAuthError(error));
      }

      if (!data.user) {
        throw new Error('No se pudo completar el registro del usuario.');
      }

      // El trigger de Supabase crea el perfil y consume la invitación atómicamente si existe.
      const profile = await this.fetchProfile(data.user.id, email);

      const user: User = {
        id: data.user.id,
        email,
        displayName,
        isAuthenticated: Boolean(data.session),
        profile,
      };

      await auditService.log('REGISTRO_USUARIO', 'auth', user.id, { id: user.id, email });
      return user;
    }

    // Modo local / sin backend configurado aún
    const roleInfo = institutionalRoles.find((r) => r.id === assignedRoleId)!;
    const profile: UserProfile = {
      id: `u-${Date.now()}`,
      email,
      displayName,
      roleId: assignedRoleId,
      technicalRole: roleInfo?.technicalRole || 'member',
      identityVerified: true,
      identityStatus: 'verified',
      createdAt: new Date().toISOString(),
    };

    if (invitationCode) {
      await this.markInvitationUsed(invitationCode, profile.id);
    }

    const user: User = {
      id: profile.id,
      email,
      displayName,
      isAuthenticated: true,
      profile,
    };

    localStorage.setItem('logia_session_backup', JSON.stringify(user));
    await auditService.log('REGISTRO_USUARIO', 'auth', user.id, { id: user.id, email });
    return user;
  },

  async resetPassword(email: string): Promise<void> {
    if (!email || !email.includes('@')) {
      throw new Error('Ingresa un correo electrónico válido.');
    }

    if (isSupabaseConfigured()) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login?reset=true`,
      });
      if (error) throw new Error(translateAuthError(error));
      return;
    }

    // Simulación auditada
    await auditService.log('SOLICITUD_RECUPERACION_CONTRASENA', 'auth', undefined, { email });
  },

  async logout(): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Error durante logout en Supabase:', e);
      }
    }
    localStorage.removeItem('logia_session_backup');
  },

  async getCurrentSessionUser(): Promise<User | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          const u = data.session.user;
          const profile = await this.fetchProfile(u.id, u.email || '');
          return {
            id: u.id,
            email: u.email || '',
            memberId: profile.memberId,
            displayName: profile.displayName,
            isAuthenticated: true,
            profile,
          };
        }
      } catch (e) {
        console.warn('Error obteniendo sesión Supabase:', e);
      }
    }

    const raw = localStorage.getItem('logia_session_backup');
    if (raw) {
      try {
        return JSON.parse(raw) as User;
      } catch {
        return null;
      }
    }
    return null;
  },

  async fetchProfile(userId: string, defaultEmail: string): Promise<UserProfile> {
    if (isSupabaseConfigured()) {
      try {
        const queryPromise = supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        const timeoutPromise = new Promise<{ data: null; error: null }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: null }), 3000)
        );

        const { data, error } = (await Promise.race([queryPromise, timeoutPromise])) as {
          data: any;
          error: any;
        };

        if (!error && data) {
          return {
            id: data.id,
            email: data.email || defaultEmail,
            memberId: data.member_id,
            displayName: data.display_name || defaultEmail.split('@')[0],
            roleId: data.role_id || 'her',
            technicalRole: data.technical_role || 'member',
            identityVerified: data.identity_verified ?? true,
            identityStatus: data.identity_status || 'verified',
            createdAt: data.created_at,
          };
        }
      } catch (e) {
        console.warn('Error leyendo profile en Supabase:', e);
      }
    }

    return {
      id: userId,
      email: defaultEmail,
      displayName: defaultEmail.split('@')[0],
      roleId: 'her',
      technicalRole: 'member',
      identityVerified: true,
      identityStatus: 'verified',
      createdAt: new Date().toISOString(),
    };
  },

  async createProfile(
    userId: string,
    email: string,
    displayName: string,
    roleId: InstitutionalRoleCode
  ): Promise<UserProfile> {
    const roleInfo = institutionalRoles.find((r) => r.id === roleId);
    const technicalRole = roleInfo?.technicalRole || 'member';

    const profile: UserProfile = {
      id: userId,
      email,
      displayName,
      roleId,
      technicalRole,
      identityVerified: false,
      identityStatus: 'pending',
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      return this.fetchProfile(userId, email);
    }

    return profile;
  },

  async updateUserRole(email: string, roleId: InstitutionalRoleCode): Promise<void> {
    const roleInfo = institutionalRoles.find((r) => r.id === roleId);
    const technicalRole = roleInfo?.technicalRole || 'member';

    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('user_profiles')
          .update({
            role_id: roleId,
            technical_role: technicalRole,
          })
          .eq('email', email.trim().toLowerCase());
      } catch (e) {
        console.warn('Error actualizando rol en Supabase user_profiles:', e);
      }
    }

    try {
      const raw = localStorage.getItem('logia_session_backup');
      if (raw) {
        const user = JSON.parse(raw);
        if (user?.email?.toLowerCase() === email.trim().toLowerCase() && user.profile) {
          user.profile.roleId = roleId;
          user.profile.technicalRole = technicalRole;
          localStorage.setItem('logia_session_backup', JSON.stringify(user));
        }
      }
    } catch {
      // ignore
    }
  },
};
