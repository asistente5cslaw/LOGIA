import { useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, Permission, InstitutionalRoleCode } from '@/types';
import { authService } from '@/services/authService';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { institutionalRoles, hasRolePermission } from '@/data/rolesData';
import { AuthContext, type AuthContextValue } from '@/context/AuthContext';

export { type AuthContextValue } from '@/context/AuthContext';

const defaultAuthContext: AuthContextValue = {
  user: null,
  isLoading: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  resetPassword: async () => {},
  hasPermission: () => false,
  isSecretaryOrVM: false,
  userRoleName: 'Hermano',
  refreshUser: async () => {},
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const current = await authService.getCurrentSessionUser();
      setUser(current);
    } catch (e) {
      console.error('Error inicializando autenticación:', e);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();

    if (isSupabaseConfigured()) {
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          authService
            .fetchProfile(session.user.id, session.user.email || '')
            .then((profile) => {
              setUser({
                id: session.user.id,
                email: session.user.email || '',
                memberId: profile.memberId,
                displayName: profile.displayName,
                isAuthenticated: true,
                profile,
              });
            })
            .catch((e) => {
              console.warn('Error resolviendo perfil en onAuthStateChange:', e);
              setUser(null);
              void supabase.auth.signOut().catch((signOutError) => {
                console.warn('No se pudo cerrar la sesión bloqueada:', signOutError);
              });
            })
            .finally(() => {
              setIsLoading(false);
            });
        } else {
          setUser(null);
          setIsLoading(false);
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, [initAuth]);

  const login = async (email: string, password: string) => {
    const u = await authService.login(email, password);
    setUser(u);
  };

  const register = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    invitationCode?: string
  ) => {
    const u = await authService.register(email, password, firstName, lastName, invitationCode);
    setUser(u.isAuthenticated ? u : null);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    await authService.resetPassword(email);
  };

  const refreshUser = useCallback(async () => {
    try {
      const current = await authService.getCurrentSessionUser();
      if (current) setUser(current);
    } catch (e) {
      console.warn('Error al refrescar usuario:', e);
      setUser(null);
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut().catch((signOutError) => {
          console.warn('No se pudo cerrar la sesión bloqueada:', signOutError);
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured()) return undefined;

    const channel = supabase
      .channel(`profile-access-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        () => {
          void refreshUser();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, refreshUser]);

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false;
      const roleId = (user.profile?.roleId || 'apr') as InstitutionalRoleCode;
      // Solo Administrador y Secretario tienen acceso completo. Venerable
      // conserva únicamente los permisos definidos para su cargo.
      if (user.profile?.technicalRole === 'admin' && roleId !== 'vm' || roleId === 'sec') {
        return true;
      }
      return hasRolePermission(roleId, permission);
    },
    [user]
  );

  const roleId = (user?.profile?.roleId || 'apr') as InstitutionalRoleCode;
  const isSecretaryOrVM = roleId === 'sec' || roleId === 'vm' || user?.profile?.technicalRole === 'admin';
  const roleObj = institutionalRoles.find((r) => r.id === roleId);
  const userRoleName = roleObj ? roleObj.name : 'Aprendiz';

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        resetPassword,
        hasPermission,
        isSecretaryOrVM,
        userRoleName,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  return ctx || defaultAuthContext;
}
