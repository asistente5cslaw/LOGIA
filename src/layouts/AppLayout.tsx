import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Home,
  CalendarDays,
  FileText,
  Users,
  CheckSquare,
  LogOut,
  Shield,
  Menu,
  Smartphone,
  ShieldAlert,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { LodgeLogo } from '@/components/shared/LodgeLogo';
import { NotificationButton } from '@/components/shared/NotificationButton';
import { useAppleDialog } from '@/components/shared/AppleDialog';
import { AppIconSelectorModal } from '@/components/shared/AppIconSelectorModal';
import { IdentityRevalidationModal } from '@/components/shared/IdentityRevalidationModal';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { pushNotificationService } from '@/services/pushNotificationService';
import { DATA_CHANGED_EVENT } from '@/hooks/useRealtimeRefresh';

const desktopNavItems = [
  { to: '/app', label: 'Inicio', icon: Home, end: true },
  { to: '/app/calendario', label: 'Calendario', icon: CalendarDays, end: false },
  { to: '/app/actas', label: 'Actas', icon: FileText, end: false },
  { to: '/app/asistencia', label: 'Asistencia', icon: CheckSquare, end: false },
  { to: '/app/miembros', label: 'Miembros', icon: Users, end: false },
];

const mobileNavItems = [
  { to: '/app', label: 'Inicio', icon: Home, end: true },
  { to: '/app/calendario', label: 'Calendario', icon: CalendarDays, end: false },
  { to: '/app/actas', label: 'Actas', icon: FileText, end: false },
  { to: '/app/asistencia', label: 'Asistencia', icon: CheckSquare, end: false },
  { to: '/app/miembros', label: 'Miembros', icon: Users, end: false },
];

export function AppLayout() {
  const { user, logout, userRoleName } = useAuth();
  const { showConfirm } = useAppleDialog();
  const navigate = useNavigate();

  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  });
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const isIdentityRestricted = Boolean(
    user?.profile &&
    user.profile.identityStatus !== 'verified' &&
    user.profile.roleId !== 'vm' &&
    user.profile.roleId !== 'sec' &&
    user.profile.technicalRole !== 'admin'
  );

  const visibleDesktopNavItems = isIdentityRestricted
    ? desktopNavItems.filter((item) => item.to === '/app')
    : desktopNavItems;
  const visibleMobileNavItems = isIdentityRestricted
    ? mobileNavItems.filter((item) => item.to === '/app')
    : mobileNavItems;
  const canAccessSettings = user?.email?.trim().toLowerCase() === 'asistente4@castillosucre.com';

  useEffect(() => {
    if (sessionStorage.getItem('reopen_icon_selector') === 'true') {
      sessionStorage.removeItem('reopen_icon_selector');
      setIsIconModalOpen(true);
    }
  }, []);

  const isInstalledApp = () => window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  useEffect(() => {
    const updateInstallState = () => setIsInstalled(isInstalledApp());
    updateInstallState();
    window.addEventListener('appinstalled', updateInstallState);
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener?.('change', updateInstallState);
    return () => {
      window.removeEventListener('appinstalled', updateInstallState);
      mediaQuery.removeEventListener?.('change', updateInstallState);
    };
  }, []);

  // Primero ofrecemos instalar la PWA. Solo después de instalarla (o si ya
  // está instalada) se solicita el permiso nativo de notificaciones.
  useEffect(() => {
    if (!user?.id) return undefined;

    const askForNotifications = () => {
      if (!isInstalledApp() || !pushNotificationService.isSupported() || pushNotificationService.getPermission() !== 'default') return;
      void pushNotificationService.requestPermission().catch(() => undefined);
    };

    if (isInstalledApp()) {
      const timer = window.setTimeout(askForNotifications, 400);
      return () => window.clearTimeout(timer);
    }

    const installPromptSeenKey = `pwa_install_prompt_seen_${user.id}`;
    if (sessionStorage.getItem(installPromptSeenKey) !== 'true') {
      sessionStorage.setItem(installPromptSeenKey, 'true');
      setIsIconModalOpen(true);
    }

    const handleInstalled = () => {
      window.setTimeout(askForNotifications, 500);
    };
    window.addEventListener('appinstalled', handleInstalled);
    return () => window.removeEventListener('appinstalled', handleInstalled);
  }, [user?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const tables = [
      'profiles', 'members', 'events', 'event_conflicts', 'minutes',
      'minute_access', 'minute_corrections', 'minute_reads', 'attendance',
      'attendance_visitors', 'official_visit_checklist', 'lodge_settings',
      'invitations', 'push_subscriptions',
    ];
    const channel = supabase.channel('logia-system-realtime');

    tables.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, {
          detail: { table, event: payload.eventType },
        }));
      });
    });

    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleLogout = async () => {
    const confirmed = await showConfirm({
      title: 'Cerrar Sesión',
      message: '¿Estás seguro de que deseas salir del sistema oficial de la Logia?',
      confirmText: 'Cerrar Sesión',
      cancelText: 'Permanecer',
      type: 'confirm',
    });
    if (confirmed) {
      try {
        await logout();
      } finally {
        // Incluso si el navegador interrumpe la llamada de red, la pantalla
        // protegida no debe permanecer visible.
        navigate('/login', { replace: true });
      }
    }
  };

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-canvas text-ink">
      {/* Modal de selección de ícono / instalación PWA */}
      <AppIconSelectorModal
        isOpen={isIconModalOpen && !isInstalled}
        onClose={() => setIsIconModalOpen(false)}
      />
      <IdentityRevalidationModal />

      {/* Barra lateral escritorio fija */}
      <aside
        className={cn(
          'hidden border-r border-border bg-surface md:flex md:flex-col h-screen shrink-0 select-none shadow-sm transition-all duration-300 ease-in-out',
          isCollapsed ? 'md:w-20' : 'md:w-64 lg:w-72'
        )}
      >
        {/* Cabecera de la barra lateral */}
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-border transition-all duration-300',
            isCollapsed ? 'justify-center px-2' : 'justify-between px-5'
          )}
        >
          {isCollapsed ? (
            <button
              onClick={toggleSidebar}
              title="Expandir barra lateral"
              className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-surface-container transition-transform active:scale-95 cursor-pointer"
            >
              <LodgeLogo className="h-10 w-10 shrink-0" />
            </button>
          ) : (
            <div className="flex items-center gap-3 overflow-hidden">
              <LodgeLogo className="h-10 w-10 shrink-0" />
              <div className="flex flex-col truncate">
                <span className="font-serif text-base font-bold text-ink leading-tight truncate">
                  Logia UF No. 21
                </span>
                <span className="text-[11px] text-ink-muted truncate">Oriente de Panamá</span>
              </div>
            </div>
          )}
        </div>

        {/* Lista de navegación fija sin scroll */}
        <nav className="flex flex-1 flex-col gap-1 p-3 overflow-hidden">
          {visibleDesktopNavItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={isCollapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[44px] items-center rounded-xl text-sm font-medium transition-colors',
                  isCollapsed ? 'justify-center px-0' : 'gap-3 px-3',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-ink-secondary hover:bg-surface-container hover:text-ink'
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}

          {canAccessSettings && (
            <NavLink
              to="/app/ajustes"
              title={isCollapsed ? 'Ajustes' : undefined}
              className={({ isActive }) => cn(
                'flex min-h-[44px] items-center rounded-xl text-sm font-medium transition-colors',
                isCollapsed ? 'justify-center px-0' : 'gap-3 px-3',
                isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-ink-secondary hover:bg-surface-container hover:text-ink'
              )}
            >
              <Settings className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span className="truncate">Ajustes</span>}
            </NavLink>
          )}

          {/* Botón directo de Ícono App / Instalar en la barra lateral */}
          {!isInstalled && (
            <button
              onClick={() => setIsIconModalOpen(true)}
              title="Personalizar Ícono de la App"
              className={cn(
                'mt-auto flex min-h-[40px] items-center rounded-xl text-xs font-semibold text-ink-muted hover:text-primary hover:bg-surface-container transition-colors cursor-pointer',
                isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
              )}
            >
              <Smartphone className="h-4 w-4 shrink-0 text-gold-600" />
              {!isCollapsed && <span>Ícono de la App</span>}
            </button>
          )}
        </nav>

        {/* Perfil del usuario abajo */}
        <div className="border-t border-border p-3 shrink-0">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                title={`${user?.displayName || 'Hermano'} (${userRoleName})`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs"
              >
                {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'HM'}
              </div>
              <button
                onClick={handleLogout}
                title="Cerrar sesión"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-container hover:text-destructive transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-2.5">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-xs">
                  {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'HM'}
                </div>
                <div className="flex flex-col truncate">
                  <span className="truncate text-xs font-medium text-ink">
                    {user?.displayName || 'Hermano'}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                    <Shield className="h-3 w-3 shrink-0" />
                    <span className="truncate">{userRoleName}</span>
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Cerrar sesión"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-container hover:text-destructive transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Contenido principal móvil + escritorio */}
      <div className="flex flex-1 flex-col h-[100dvh] min-w-0 overflow-hidden">
        {/* Barra superior móvil */}
        <header className="shrink-0 flex h-14 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
          <div className="flex items-center gap-2.5">
            <LodgeLogo className="h-9 w-9 shrink-0" />
            <div className="flex flex-col">
              <span className="font-serif text-sm font-bold text-ink leading-tight">Logia UF No. 21</span>
              <span className="text-[10px] text-ink-muted">Oriente de Panamá</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isInstalled && (
              <button
                onClick={() => setIsIconModalOpen(true)}
                title="Ícono e Instalación"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gold-600 hover:bg-surface-container transition-colors cursor-pointer"
              >
                <Smartphone className="h-4 w-4" />
              </button>
            )}
            <NotificationButton />
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-container hover:text-destructive transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Barra superior escritorio */}
        <header className="shrink-0 hidden h-16 items-center justify-between border-b border-border bg-surface px-6 md:flex">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              title={isCollapsed ? 'Expandir barra lateral' : 'Comprimir barra lateral'}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-secondary hover:bg-surface-container hover:text-ink transition-colors cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-serif text-sm font-medium text-ink-secondary">
                R.·. L.·. L.·. Unión Fraternal No. 21
              </span>
              <span className="text-xs text-ink-muted">• G.·. L.·. P.·.</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-ink-muted">
            {!isInstalled && (
              <button
                onClick={() => setIsIconModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gold-500/30 text-gold-700 bg-gold-500/5 hover:bg-gold-500/10 transition-colors font-medium cursor-pointer"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Personalizar Ícono App</span>
              </button>
            )}
            <span className="font-serif text-xs text-ink-muted italic hidden lg:inline">
              Oriente de Panamá • Rito Escocés Antiguo y Aceptado
            </span>
            <NotificationButton />
          </div>
        </header>

        {/* Contenido de página con scroll */}
        <main className="mobile-scroll-content flex-1 overflow-y-auto md:pb-6">
          {isIdentityRestricted ? (
            <RestrictedAccessScreen status={user?.profile?.identityStatus} />
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {/* Barra de navegación inferior móvil */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border bg-white safe-area-bottom md:hidden shadow-lg">
        {visibleMobileNavItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-primary font-semibold' : 'text-ink-muted hover:text-ink-secondary'
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span className="truncate max-w-[56px]">{label}</span>
          </NavLink>
        ))}
        {canAccessSettings && (
          <NavLink
            to="/app/ajustes"
            className={({ isActive }) => cn(
              'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
              isActive ? 'text-primary font-semibold' : 'text-ink-muted hover:text-ink-secondary'
            )}
          >
            <Settings className="h-5 w-5" />
            <span className="truncate max-w-[56px]">Ajustes</span>
          </NavLink>
        )}
      </nav>
    </div>
  );
}

function RestrictedAccessScreen({ status }: { status?: 'pending' | 'verified' | 'rejected' | 'not_started' }) {
  const isRejected = status === 'rejected';

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-xl rounded-3xl border border-border bg-white p-6 text-center shadow-xs sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="mt-5 font-serif text-2xl font-bold text-ink">
          {isRejected ? 'Se requiere una nueva validación' : 'Registro pendiente de validación'}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-secondary">
          {isRejected
            ? 'Tu selfie fue devuelta por Secretaría. Completa la nueva captura solicitada para recuperar el acceso a la información de la logia.'
            : 'Puedes acceder al sistema, pero el calendario, las actas, la asistencia y el directorio permanecerán ocultos hasta que un Venerable o Secretario apruebe tu identidad.'}
        </p>
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-xs leading-5 text-amber-900">
          {isRejected
            ? 'La ventana de captura aparecerá automáticamente para completar la nueva selfie.'
            : 'Recibirás acceso automáticamente cuando tu identidad sea aprobada. No necesitas volver a registrarte.'}
        </div>
      </section>
    </div>
  );
}
