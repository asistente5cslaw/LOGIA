import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, BellRing, Check, CheckCheck, X, ExternalLink } from 'lucide-react';
import { pushNotificationService, type LodgeNotificationItem } from '@/services/pushNotificationService';
import { AppleEmoji } from '@/components/shared/AppleEmoji';
import { toast } from 'sonner';

export function NotificationButton() {
  const navigate = useNavigate();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications, setNotifications] = useState<LodgeNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setIsSupported(pushNotificationService.isSupported());
    setPermission(pushNotificationService.getPermission());
    setNotifications(pushNotificationService.getNotifications());
    setUnreadCount(pushNotificationService.getUnreadCount());

    const unsubscribe = pushNotificationService.subscribe(() => {
      setPermission(pushNotificationService.getPermission());
      setNotifications(pushNotificationService.getNotifications());
      setUnreadCount(pushNotificationService.getUnreadCount());
    });

    return () => unsubscribe();
  }, []);

  const handleRequestPermission = async () => {
    const res = await pushNotificationService.requestPermission();
    setPermission(res);
    if (res === 'granted') {
      toast.success('¡Notificaciones push activadas!');
    } else if (res === 'denied') {
      toast.error('Permiso de notificaciones denegado en tu navegador');
    }
  };

  const handleMarkAllAsRead = () => {
    pushNotificationService.markAllAsReadAndClear();
    toast.success('Notificaciones marcadas como leídas');
  };

  const handleDismissOne = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    pushNotificationService.dismissNotification(id);
  };

  const handleItemClick = (item: LodgeNotificationItem) => {
    pushNotificationService.dismissNotification(item.id);
    setShowDropdown(false);
    if (item.url) {
      navigate(item.url);
    }
  };

  if (!isSupported) return null;

  const isGranted = permission === 'granted';

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        title={isGranted ? 'Centro de Notificaciones' : 'Activar Notificaciones Push'}
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
          isGranted
            ? 'border-border bg-white text-ink hover:bg-surface-container active:scale-95 shadow-2xs'
            : 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 animate-pulse'
        }`}
      >
        {isGranted ? (
          <Bell className="h-4 w-4 text-ink-secondary" />
        ) : (
          <BellRing className="h-4 w-4 text-primary" />
        )}

        {/* Badge contador de no leídas estilo Apple */}
        {isGranted && unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm ring-2 ring-white animate-in zoom-in-75">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : isGranted ? (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-success ring-2 ring-white" />
        ) : (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-white" />
        )}
      </button>

      {/* Menú desplegable estilo Apple (Adaptable a móvil y escritorio sin cortes ni transparencias) */}
      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-xs transition-opacity"
            onClick={() => setShowDropdown(false)}
          />
          <div
            style={{ backgroundColor: '#ffffff' }}
            className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 z-50 max-h-[calc(100vh-90px)] sm:max-h-[500px] flex flex-col rounded-2xl border border-border bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {/* MODO 1: SI LAS NOTIFICACIONES NO ESTÁN ACTIVAS */}
            {!isGranted ? (
              <div className="p-4 space-y-3 bg-white">
                <div className="flex items-center gap-2.5 pb-2 border-b border-border">
                  <AppleEmoji name="bell" size={24} />
                  <div>
                    <h4 className="font-serif text-sm font-bold text-ink leading-tight">
                      Notificaciones Push
                    </h4>
                    <p className="text-[11px] text-ink-muted">
                      Avisos de tenidas y convocatorias
                    </p>
                  </div>
                </div>

                <div className="space-y-2 py-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-ink">Estado:</span>
                    {permission === 'denied' ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                        <BellOff className="h-3.5 w-3.5" />
                        Bloqueadas en el navegador
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                        <BellRing className="h-3.5 w-3.5" />
                        Pendientes de activación
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-ink-secondary leading-relaxed bg-surface-container-low rounded-xl p-3 border border-border">
                    Recibe convocatorias oficiales y trazados directo a tu pantalla o reloj inteligente con el logo de la logia.
                  </p>
                </div>

                <div className="pt-2 border-t border-border">
                  {permission === 'denied' ? (
                    <p className="text-[11px] text-destructive text-center py-1">
                      Debes habilitar los permisos en la configuración de tu navegador.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestPermission}
                      className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary-pressed shadow-sm transition-all cursor-pointer"
                    >
                      <Bell className="h-4 w-4" />
                      Activar en este dispositivo
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* MODO 2: BANDEJA COMPLETA DE NOTIFICACIONES */
              <div className="flex flex-col h-full bg-white">
                {/* Cabecera */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-white shrink-0">
                  <div className="flex items-center gap-2">
                    <AppleEmoji name="bell" size={20} />
                    <h4 className="font-serif text-sm font-bold text-ink">
                      Notificaciones
                    </h4>
                    {notifications.length > 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {notifications.length}
                      </span>
                    )}
                  </div>

                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-pressed transition-colors px-2 py-1 rounded-lg hover:bg-primary/10 cursor-pointer"
                      title="Marcar todas como leídas y retirar de la bandeja"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      <span>Marcar como leído</span>
                    </button>
                  )}
                </div>

                {/* Lista de Notificaciones Scrolleable */}
                <div className="flex-1 overflow-y-auto divide-y divide-border/60 bg-white">
                  {notifications.length === 0 ? (
                    <div className="py-10 px-4 text-center space-y-2">
                      <div className="flex justify-center">
                        <div className="h-12 w-12 rounded-full bg-surface-container flex items-center justify-center">
                          <Check className="h-6 w-6 text-success" />
                        </div>
                      </div>
                      <div className="font-serif text-sm font-bold text-ink">
                        Bandeja al día
                      </div>
                      <p className="text-xs text-ink-muted max-w-[240px] mx-auto leading-relaxed">
                        No tienes notificaciones pendientes. Todas las convocatorias y avisos han sido leídos.
                      </p>
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className="group relative flex items-start gap-3 p-3.5 hover:bg-surface-container-low transition-colors cursor-pointer text-left bg-white"
                      >
                        {/* Escudo oficial de la logia */}
                        <div className="relative shrink-0 mt-0.5">
                          <img
                            src="/logo-uf21.png"
                            alt="Logia UF No. 21"
                            className="h-8 w-8 rounded-full border border-border object-contain bg-white p-0.5 shadow-2xs"
                          />
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white shadow-xs">
                            {item.type === 'convocatoria' ? (
                              <AppleEmoji name="temple" size={10} />
                            ) : item.type === 'trazado' ? (
                              <AppleEmoji name="scroll" size={10} />
                            ) : (
                              <AppleEmoji name="bell" size={10} />
                            )}
                          </span>
                        </div>

                        {/* Contenido */}
                        <div className="flex-1 min-w-0 pr-6">
                          <h5 className="font-serif text-xs font-bold text-ink leading-tight truncate">
                            {item.title}
                          </h5>
                          <p className="text-[11px] text-ink-secondary mt-0.5 line-clamp-2 leading-relaxed">
                            {item.body}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-ink-muted font-medium">
                              {item.time}
                            </span>
                            {item.url && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary opacity-80 group-hover:opacity-100 transition-opacity">
                                Ver detalles <ExternalLink className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Botón individual para descartar */}
                        <button
                          type="button"
                          onClick={(e) => handleDismissOne(e, item.id)}
                          title="Quitar de la bandeja"
                          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-container transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
