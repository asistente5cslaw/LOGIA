import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Registrar el listener beforeinstallprompt antes de montar la interfaz.
// Así el botón de instalación puede abrir el diálogo nativo del navegador.
import './services/pwaIconService';
import { pushNotificationService } from './services/pushNotificationService';

// Limpieza forzada de datos falsos / mock de versiones anteriores en el navegador del usuario
try {
  const version = localStorage.getItem('logia_data_version');
  if (version !== '4.0.0') {
    localStorage.removeItem('logia_members_data');
    localStorage.removeItem('logia_events_data');
    localStorage.removeItem('logia_minutes_data');
    localStorage.removeItem('logia_invitations_data');
    localStorage.removeItem('logia_session_backup');
    localStorage.setItem('logia_data_version', '4.0.0');
  }
} catch {
  // ignore
}

// Inicializar Service Worker para Notificaciones Push en segundo plano y PWA
if (typeof window !== 'undefined') {
  pushNotificationService.initServiceWorker().catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
