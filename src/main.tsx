import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { pushNotificationService } from './services/pushNotificationService';

// Inicializar Service Worker para Notificaciones Push en segundo plano y PWA
if (typeof window !== 'undefined') {
  pushNotificationService.initServiceWorker().catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
