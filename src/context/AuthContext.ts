import { createContext } from 'react';
import type { User, Permission } from '@/types';

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    invitationCode?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  isSecretaryOrVM: boolean;
  userRoleName: string;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
