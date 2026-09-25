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

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false;
      const roleId = (user.profile?.roleId || 'her') as InstitutionalRoleCode;
      // El Administrador o Secretario tiene acceso completo
      if (user.profile?.technicalRole === 'admin' || roleId === 'sec' || roleId === 'vm') {
        return true;
      }
      return hasRolePermission(roleId, permission);
    },
    [user]
  );

  const roleId = (user?.profile?.roleId || 'her') as InstitutionalRoleCode;
  const isSecretaryOrVM = roleId === 'sec' || roleId === 'vm' || user?.profile?.technicalRole === 'admin';
  const roleObj = institutionalRoles.find((r) => r.id === roleId);
  const userRoleName = roleObj ? roleObj.name : 'Hermano';

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
