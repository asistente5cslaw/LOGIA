import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { User, UserProfile, Invitation, MasonicDegree, InstitutionalRoleCode } from '@/types';
import { institutionalRoles } from '@/data/rolesData';
import { auditService } from './auditService';

interface AuthResponseShape {
  data: { user: { id: string; email?: string } | null; session: unknown };
  error: { message: string } | null;
}

interface ProfileRow {
  id: string;
  email?: string;
  member_id?: string;
  display_name?: string;
  role_id?: InstitutionalRoleCode;
  technical_role?: UserProfile['technicalRole'];
  identity_verified?: boolean;
  identity_status?: UserProfile['identityStatus'];
  access_disabled?: boolean;
  created_at: string;
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

    return { valid: false, message: 'Supabase no está configurado.' };
  },

  async markInvitationUsed(code: string, userId: string): Promise<void> {
    void code;
    void userId;
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
    } else throw new Error('Supabase no está configurado.');

    await auditService.log('CREAR_INVITACION', 'invitations', newInv.id, user, {
      code: newInv.code,
      roleId,
      degree,
    });

    return newInv;
  },

  async getInvitations(): Promise<Invitation[]> {
    if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('invitations')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data) {
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
      }
    throw new Error('Supabase no está configurado.');
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
      const timeoutPromise = new Promise<AuthResponseShape>((_, reject) =>
        setTimeout(() => reject(new Error('El servidor tardó demasiado en responder. Verifica tu conexión.')), 8000)
      );

      const { data, error } = await Promise.race([signInPromise, timeoutPromise]);

      if (error) {
        throw new Error(translateAuthError(error));
      }

      if (!data.user) {
        throw new Error('Credenciales incorrectas o usuario no encontrado.');
      }

      let profile: UserProfile;
      try {
        profile = await this.fetchProfile(data.user.id, data.user.email || cleanEmail);
      } catch (error) {
        await supabase.auth.signOut();
        throw error;
      }
      const user: User = {
        id: data.user.id,
        email: data.user.email || cleanEmail,
        memberId: profile.memberId,
        displayName: profile.displayName,
        isAuthenticated: true,
        profile,
      };

      await auditService.log('INICIO_SESION', 'auth', user.id, { id: user.id, email: user.email });
      return user;
    }

    throw new Error('Supabase no está configurado.');
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
    let assignedRoleId: InstitutionalRoleCode = 'apr';
    if (invitationCode && invitationCode.trim()) {
      const invCheck = await this.validateInvitation(invitationCode, email);
      if (invCheck.valid && invCheck.invitation) {
        assignedRoleId = invCheck.invitation.roleId;
      }
    }

    const cleanEmail = email.trim().toLowerCase();
    const displayName = `${firstName.trim()} ${lastName.trim()}`;

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
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
      let profile: UserProfile;
      try {
        profile = await this.fetchProfile(data.user.id, cleanEmail);
      } catch (error) {
        await supabase.auth.signOut();
        throw error;
      }

      const user: User = {
        id: data.user.id,
        email: cleanEmail,
        memberId: profile.memberId,
        displayName,
        isAuthenticated: Boolean(data.session),
        profile,
      };

      await auditService.log('REGISTRO_USUARIO', 'auth', user.id, { id: user.id, email: cleanEmail });
      return user;
    }

    throw new Error('Supabase no está configurado.');
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

    throw new Error('Supabase no está configurado.');
  },

  async logout(): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(translateAuthError(error));
  },

  async getCurrentSessionUser(): Promise<User | null> {
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) return null;
    const u = data.session.user;
    let profile: UserProfile;
    try {
      profile = await this.fetchProfile(u.id, u.email || '');
    } catch (error) {
      await supabase.auth.signOut();
      throw error;
    }
    return { id: u.id, email: u.email || '', memberId: profile.memberId, displayName: profile.displayName, isAuthenticated: true, profile };
  },

  async fetchProfile(userId: string, defaultEmail: string): Promise<UserProfile> {
    if (isSupabaseConfigured()) {
        const queryPromise = supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        const timeoutPromise = new Promise<{ data: null; error: null }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: null }), 3000)
        );

        const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as {
          data: ProfileRow | null;
          error: { message: string } | null;
        };

        if (error) throw error;
        if (data) {
          if (data.access_disabled) {
            throw new Error('Esta cuenta fue dada de baja y ya no tiene acceso al sistema.');
          }
          return {
            id: data.id,
            email: data.email || defaultEmail,
            memberId: data.member_id,
            displayName: data.display_name || defaultEmail.split('@')[0],
            roleId: data.role_id || 'apr',
            technicalRole: data.technical_role || 'member',
            identityVerified: data.identity_verified ?? true,
            identityStatus: data.identity_status || 'verified',
            accessDisabled: data.access_disabled ?? false,
            createdAt: data.created_at,
          };
        }
        throw new Error('No se encontró el perfil del usuario en Supabase.');
    }
    throw new Error('Supabase no está configurado.');
  },

  async createProfile(
    userId: string,
    email: string,
    displayName: string,
    roleId: InstitutionalRoleCode
  ): Promise<UserProfile> {
    void displayName;
    void roleId;
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    return this.fetchProfile(userId, email);
  },

  async updateUserRole(email: string, roleId: InstitutionalRoleCode): Promise<void> {
    const roleInfo = institutionalRoles.find((r) => r.id === roleId);
    const technicalRole = roleInfo?.technicalRole || 'member';

    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role_id: roleId, technical_role: technicalRole })
      .eq('email', email.trim().toLowerCase());
    if (profileError) throw profileError;

    const { error: memberError } = await supabase
      .from('members')
      .update({ role_id: roleId, updated_at: new Date().toISOString() })
      .eq('email', email.trim().toLowerCase());
    if (memberError) throw memberError;
  },
};
