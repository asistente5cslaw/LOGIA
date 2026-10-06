// Servicio para gestión de Notificaciones Push nativas y PWA para cualquier dispositivo
// Incluye el escudo oficial de la Logia Unión Fraternal No. 21 (/logo-uf21.png)

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  type?: 'convocatoria' | 'trazado' | 'aviso' | 'nuevo_registro';
  recipientRoles?: string[];
}

export interface LodgeNotificationItem {
  id: string;
  title: string;
  body: string;
  url?: string;
  time: string;
  timestamp: number;
  read: boolean;
  type: 'convocatoria' | 'trazado' | 'aviso' | 'nuevo_registro';
}

const STORAGE_KEY = 'lodge_notifications_list';

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Formato corto y legible para las notificaciones: Miércoles 30 de septiembre · 7:30 p. m. */
export function formatPushDateTime(dateValue: string, timeValue?: string): string {
  const dateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return `${dateValue}${timeValue ? ` · ${formatPushTime(timeValue)}` : ''}`;

  const [, year, month, day] = dateMatch;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const dateText = `${WEEKDAYS[date.getDay()][0].toUpperCase()}${WEEKDAYS[date.getDay()].slice(1)} ${Number(day)} de ${MONTHS[Number(month) - 1]}`;
  return `${dateText}${timeValue ? ` · ${formatPushTime(timeValue)}` : ''}`;
}

function formatPushTime(timeValue: string): string {
  const match = timeValue.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return timeValue;
  const hour24 = Number(match[1]);
  const minutes = match[2];
  const suffix = hour24 >= 12 ? 'p. m.' : 'a. m.';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minutes} ${suffix}`;
}

interface PushSubscriptionRow {
  endpoint: string;
  expirationTime?: number | null;
  keys?: { p256dh: string; auth: string };
}

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

class PushNotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private lastRegistrationError = '';
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

  public getLastRegistrationError(): string {
    return this.lastRegistrationError;
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
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];

      // Elimina las tres semillas antiguas de demostración sin borrar
      // notificaciones reales que el usuario ya haya recibido.
      const demoIds = new Set(['notif-1', 'notif-2', 'notif-3']);
      const cleaned = parsed.filter((item) => !demoIds.has(item?.id));
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      }
      return cleaned;
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
    } catch (error) { console.warn('No se pudo limpiar notificaciones antiguas:', error); }

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
    } catch (error) { console.warn('No se pudo guardar la notificación:', error); }
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
    } catch (error) { console.warn('No se pudieron marcar las notificaciones:', error); }
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
    } catch (error) { console.warn('No se pudieron limpiar las notificaciones:', error); }
    this.notifyListeners();
  }

  /**
   * Marca todas como leídas y las remueve de la bandeja activa
   */
  public markAllAsReadAndClear(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    } catch (error) { console.warn('No se pudo eliminar la notificación:', error); }
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
    } catch (error) { console.warn('No se pudieron limpiar las notificaciones:', error); }
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
      if (permission === 'granted') await this.registerCurrentDevice();
      this.notifyListeners();
      return permission;
    } catch (err) {
      console.error('Error solicitando permisos de notificación:', err);
      return 'denied';
    }
  }

  public async registerCurrentDevice(): Promise<boolean> {
    this.lastRegistrationError = '';
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapidKey) {
      this.lastRegistrationError = 'Falta VITE_VAPID_PUBLIC_KEY en el deployment de Vercel.';
      return false;
    }
    if (!('serviceWorker' in navigator)) {
      this.lastRegistrationError = 'Este navegador no admite Service Worker.';
      return false;
    }
    if (!('PushManager' in window)) {
      this.lastRegistrationError = 'Este navegador o modo de navegación no admite Web Push.';
      return false;
    }

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (isIOS && !isStandalone) {
      this.lastRegistrationError = 'En iPhone debes abrir la aplicación desde “Añadir a la pantalla de inicio” para recibir push.';
      return false;
    }

    try {
      const registration = this.swRegistration || await this.initServiceWorker();
      if (!registration) {
        this.lastRegistrationError = 'No se pudo registrar el Service Worker.';
        return false;
      }
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
      const json = subscription.toJSON() as PushSubscriptionRow;
      const { supabase, isSupabaseConfigured } = await import('@/lib/supabase');
      if (!isSupabaseConfigured()) {
        this.lastRegistrationError = 'Supabase no está configurado en este deployment.';
        return false;
      }
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        this.lastRegistrationError = 'El navegador no devolvió una suscripción push válida.';
        return false;
      }
      const { error } = await supabase.from('push_subscriptions').upsert({
        endpoint: json.endpoint,
        expiration_time: json.expirationTime ?? null,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' });
      if (error) {
        this.lastRegistrationError = `Supabase rechazó el registro: ${error.message}`;
        return false;
      }
      return true;
    } catch (error) {
      console.warn('No se pudo registrar este dispositivo para push:', error);
      this.lastRegistrationError = error instanceof Error ? error.message : 'Error desconocido al registrar el dispositivo.';
      return false;
    }
  }

  public async sendPushToAll(payload: PushNotificationPayload): Promise<{ sent: number; removed: number }> {
    const { supabase, isSupabaseConfigured } = await import('@/lib/supabase');
    if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
    const { data, error } = await supabase.functions.invoke('send-push-notification', { body: payload });
    if (error) throw error;
    return { sent: Number(data?.sent || 0), removed: Number(data?.removed || 0) };
  }

  public async notifyNewRegistration(displayName: string, email: string): Promise<{ sent: number; removed: number }> {
    return this.sendPushToAll({
      title: 'Nuevo registro pendiente',
      body: `${displayName} (${email}) se registró. Revisa su identidad y asigna el rol correspondiente.`,
      url: '/app/miembros',
      tag: `nuevo-registro-${email.toLowerCase()}`,
      type: 'nuevo_registro',
      recipientRoles: ['vm', 'sec'],
    });
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
      body: `Tenida programada para el ${formatPushDateTime(date, time || '19:30')} en ${location}.`,
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
