// Servicio para gestión de Notificaciones Push nativas y PWA para cualquier dispositivo
// Incluye el escudo oficial de la Logia Unión Fraternal No. 21 (/logo-uf21.png)

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  type?: 'convocatoria' | 'trazado' | 'aviso';
}

export interface LodgeNotificationItem {
  id: string;
  title: string;
  body: string;
  url?: string;
  time: string;
  timestamp: number;
  read: boolean;
  type: 'convocatoria' | 'trazado' | 'aviso';
}

const STORAGE_KEY = 'lodge_notifications_list';

class PushNotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private readonly LOGO_PATH = '/logo-uf21.png';
  private listeners: (() => void)[] = [];

  /**
   * Comprueba si el navegador y dispositivo soportan notificaciones
   */
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Obtiene el estado actual de permisos
   */
  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  /**
   * Suscribirse a cambios en las notificaciones
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (e) {
        console.error('Error en listener de notificaciones:', e);
      }
    });
  }

  /**
   * Obtiene la lista de notificaciones almacenadas
   */
  public getNotifications(): LodgeNotificationItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        // Semilla inicial de convocatorias y avisos de la logia
        const initialList: LodgeNotificationItem[] = [
          {
            id: 'notif-1',
            title: 'Convocatoria: Tenida Ordinaria de 1° Grado',
            body: 'Martes a las 19:30 en el Gran Templo Masónico de Ancón. Se requiere mandil reglamentario.',
            time: 'Hace 15 min',
            timestamp: Date.now() - 15 * 60 * 1000,
            read: false,
            type: 'convocatoria',
            url: '/app/calendario',
          },
          {
            id: 'notif-2',
            title: 'Trazado Aprobado: Acta de Tenida Ordinaria',
            body: 'El trazado de la sesión anterior ha sido sancionado y firmado por el Venerable Maestro.',
            time: 'Hace 2 horas',
            timestamp: Date.now() - 2 * 60 * 60 * 1000,
            read: false,
            type: 'trazado',
            url: '/app/actas',
          },
          {
            id: 'notif-3',
            title: 'Aviso de Secretaría: Protocolo de Tenida',
            body: 'Recordatorio protocolar: vestir traje formal oscuro para la recepción de visitantes.',
            time: 'Hoy',
            timestamp: Date.now() - 4 * 60 * 60 * 1000,
            read: false,
            type: 'aviso',
            url: '/app/calendario',
          },
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialList));
        return initialList;
      }
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * Agrega una notificación a la bandeja interna
   */
  public addNotification(payload: PushNotificationPayload): LodgeNotificationItem {
    const list = this.getNotifications();
    const newItem: LodgeNotificationItem = {
      id: `notif-${Date.now()}`,
      title: payload.title,
      body: payload.body,
      url: payload.url || '/app/calendario',
      time: 'Hace un momento',
      timestamp: Date.now(),
      read: false,
      type: payload.type || 'aviso',
    };

    const updated = [newItem, ...list];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    this.notifyListeners();
    return newItem;
  }

  /**
   * Marca todas las notificaciones como leídas y las retira de la bandeja
   */
  public markAllAsRead(): void {
    try {
      const list = this.getNotifications();
      const updated = list.map((item) => ({ ...item, read: true }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    this.notifyListeners();
  }

  /**
   * Elimina las notificaciones leídas o limpia la bandeja
   */
  public clearReadNotifications(): void {
    try {
      const list = this.getNotifications();
      const remaining = list.filter((item) => !item.read);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    } catch {}
    this.notifyListeners();
  }

  /**
   * Elimina una sola notificación de la bandeja
   */
  public dismissNotification(id: string): void {
    try {
      const list = this.getNotifications();
      const updated = list.filter((item) => item.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    this.notifyListeners();
  }

  /**
   * Marca todas como leídas y las remueve de la bandeja activa
   */
  public markAllAsReadAndClear(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    } catch {}
    this.notifyListeners();
  }

  /**
   * Marca una sola notificación como leída
   */
  public markAsRead(id: string): void {
    try {
      const list = this.getNotifications();
      const updated = list.map((item) =>
        item.id === id ? { ...item, read: true } : item
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    this.notifyListeners();
  }

  /**
   * Retorna el conteo de no leídas
   */
  public getUnreadCount(): number {
    return this.getNotifications().filter((n) => !n.read).length;
  }

  /**
   * Inicializa el Service Worker para permitir notificaciones en segundo plano y móviles
   */
  public async initServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }

    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      this.swRegistration = reg;
      return reg;
    } catch (err) {
      console.warn('No se pudo registrar sw.js:', err);
      return null;
    }
  }

  /**
   * Solicita permiso al usuario para enviar notificaciones push
   */
  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }

    await this.initServiceWorker();

    try {
      const permission = await Notification.requestPermission();
      localStorage.setItem('lodge_notifications_enabled', permission === 'granted' ? 'true' : 'false');
      this.notifyListeners();
      return permission;
    } catch (err) {
      console.error('Error solicitando permisos de notificación:', err);
      return 'denied';
    }
  }

  /**
   * Envía una notificación con el logo oficial a través del Service Worker o fallback nativo
   */
  public async sendNotification(payload: PushNotificationPayload): Promise<boolean> {
    if (!this.isSupported()) return false;

    // Agregar a la bandeja interna de la logia
    this.addNotification(payload);

    if (Notification.permission !== 'granted') {
      const perm = await this.requestPermission();
      if (perm !== 'granted') return false;
    }

    const { title, body, url = '/app/calendario', tag = 'logia-notif' } = payload;

    // Intentar vía Service Worker primero (indispensable para Android y PWA iOS)
    try {
      let reg = this.swRegistration;
      if (!reg && 'serviceWorker' in navigator) {
        reg = (await navigator.serviceWorker.getRegistration()) ?? null;
      }

      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon: this.LOGO_PATH,
          badge: this.LOGO_PATH,
          tag,
          vibrate: [200, 100, 200],
          data: { url, timestamp: Date.now() },
        } as NotificationOptions);
        return true;
      }
    } catch (e) {
      console.warn('Fallo al mostrar vía Service Worker, intentando constructor nativo:', e);
    }

    // Fallback: Constructor nativo de Notification
    try {
      const n = new Notification(title, {
        body,
        icon: this.LOGO_PATH,
        badge: this.LOGO_PATH,
        tag,
      });

      n.onclick = (e) => {
        e.preventDefault();
        window.focus();
        if (url && window.location.pathname !== url) {
          window.location.href = url;
        }
      };

      return true;
    } catch (e) {
      console.error('Error mostrando notificación nativa:', e);
      return false;
    }
  }

  /**
   * Notificación protocolar para convocatorias y tenidas
   */
  public async notifyConvocation(title: string, date: string, time: string, location: string): Promise<boolean> {
    return this.sendNotification({
      title: `Convocatoria: ${title}`,
      body: `Tenida programada para el ${date} a las ${time || '19:30'} en ${location}. Haz clic para ver detalles.`,
      url: '/app/calendario',
      tag: `convocatoria-${Date.now()}`,
      type: 'convocatoria',
    });
  }

  /**
   * Envía una notificación de prueba para que el usuario verifique en su dispositivo
   */
  public async sendTestNotification(): Promise<boolean> {
    return this.sendNotification({
      title: 'Logia Unión Fraternal No. 21',
      body: '¡Notificaciones push activadas exitosamente! Recibirás avisos de convocatorias y tenidas con este emblema oficial.',
      url: '/app/calendario',
      tag: 'test-notification',
      type: 'aviso',
    });
  }
}

export const pushNotificationService = new PushNotificationService();
