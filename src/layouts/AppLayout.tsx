import { useState } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { LodgeLogo } from '@/components/shared/LodgeLogo';
import { NotificationButton } from '@/components/shared/NotificationButton';
import { useAppleDialog } from '@/components/shared/AppleDialog';
import { AppIconSelectorModal } from '@/components/shared/AppIconSelectorModal';

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
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

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
      await logout();
      navigate('/login');
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-canvas text-ink">
      {/* Modal de selección de ícono / instalación PWA */}
      <AppIconSelectorModal
        isOpen={isIconModalOpen}
        onClose={() => setIsIconModalOpen(false)}
      />

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
                <span className="text-[11px] text-ink-muted truncate">Valle de Panamá</span>
              </div>
            </div>
          )}
        </div>

        {/* Lista de navegación fija sin scroll */}
        <nav className="flex flex-1 flex-col gap-1 p-3 overflow-hidden">
          {desktopNavItems.map(({ to, label, icon: Icon, end }) => (
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

          {/* Botón directo de Ícono App / Instalar en la barra lateral */}
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
      <div className="flex flex-1 flex-col h-screen min-w-0 overflow-hidden">
        {/* Barra superior móvil */}
        <header className="shrink-0 flex h-14 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
          <div className="flex items-center gap-2.5">
            <LodgeLogo className="h-9 w-9 shrink-0" />
            <div className="flex flex-col">
              <span className="font-serif text-sm font-bold text-ink leading-tight">Logia UF No. 21</span>
              <span className="text-[10px] text-ink-muted">Valle de Panamá</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsIconModalOpen(true)}
              title="Ícono e Instalación"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gold-600 hover:bg-surface-container transition-colors cursor-pointer"
            >
              <Smartphone className="h-4 w-4" />
            </button>
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
                Resp.·. Log.·. Unión Fraternal No. 21
              </span>
              <span className="text-xs text-ink-muted">• G.·. L.·. P.·.</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-ink-muted">
            <button
              onClick={() => setIsIconModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gold-500/30 text-gold-700 bg-gold-500/5 hover:bg-gold-500/10 transition-colors font-medium cursor-pointer"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Personalizar Ícono App</span>
            </button>
            <span className="font-serif text-xs text-ink-muted italic hidden lg:inline">
              Valle de Panamá • Rito Escocés Antiguo y Aceptado
            </span>
            <NotificationButton />
          </div>
        </header>

        {/* Contenido de página con scroll */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Barra de navegación inferior móvil */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border bg-white safe-area-bottom md:hidden shadow-lg">
        {mobileNavItems.map(({ to, label, icon: Icon, end }) => (
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
      </nav>
    </div>
  );
}
