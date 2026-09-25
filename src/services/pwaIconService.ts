export type LodgeIconOption = 'emblem' | 'monogram';

export interface LodgeIconDetails {
  id: LodgeIconOption;
  name: string;
  subtitle: string;
  description: string;
  imageSrc: string;
  previewBg: string;
}

export const LODGE_ICONS: Record<LodgeIconOption, LodgeIconDetails> = {
  emblem: {
    id: 'emblem',
    name: 'Emblema Masónico Oficial',
    subtitle: 'Escudo Sagrado de Taller',
    description: 'Columnas J y B, Escuadra, Compás, Ojo que Todo lo Ve y monograma UF21 sobre fondo carmesí.',
    imageSrc: '/icons/logo-uf21-emblem.jpg',
    previewBg: 'bg-amber-950/40',
  },
  monogram: {
    id: 'monogram',
    name: 'Monograma UF21 en Relieve',
    subtitle: 'Diseño Solemne Oro y Carmesí',
    description: 'Monograma dorado en alto relieve UF21 con textura de cuero carmesí.',
    imageSrc: '/icons/logo-uf21-monogram.jpg',
    previewBg: 'bg-red-950/40',
  },
};

const STORAGE_KEY = 'selected_lodge_icon';

// Global reference to PWA install prompt event
let deferredPrompt: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-installable', { detail: e }));
  });
}

export function getDeferredInstallPrompt(): any {
  return deferredPrompt;
}

export function clearDeferredInstallPrompt() {
  deferredPrompt = null;
}

export function getSelectedLodgeIcon(): LodgeIconOption {
  if (typeof window === 'undefined') return 'emblem';
  const saved = localStorage.getItem(STORAGE_KEY) as LodgeIconOption;
  if (saved === 'emblem' || saved === 'monogram') {
    return saved;
  }
  return 'emblem';
}

export function getLodgeIconPath(iconId?: LodgeIconOption): string {
  const selected = iconId || getSelectedLodgeIcon();
  return LODGE_ICONS[selected].imageSrc;
}

export function applyLodgeIcon(iconId: LodgeIconOption) {
  if (typeof window === 'undefined') return;

  localStorage.setItem(STORAGE_KEY, iconId);
  const iconPath = LODGE_ICONS[iconId].imageSrc;

  // 1. Update Apple Touch Icon
  let appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (!appleIcon) {
    appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    document.head.appendChild(appleIcon);
  }
  appleIcon.href = iconPath;

  // 2. Update Favicon
  let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }
  favicon.href = iconPath;

  // 3. Dynamically update Web App Manifest with chosen icon
  const manifestData = {
    name: 'Logia Unión Fraternal No. 21',
    short_name: 'UF No. 21',
    description: 'Sistema Oficial de Gestión y Archivo Masónico - Unión Fraternal No. 21',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d1117',
    theme_color: '#990000',
    icons: [
      {
        src: iconPath,
        sizes: '192x192',
        type: 'image/jpeg',
        purpose: 'any maskable',
      },
      {
        src: iconPath,
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'any maskable',
      },
    ],
  };

  const stringManifest = JSON.stringify(manifestData);
  const blob = new Blob([stringManifest], { type: 'application/json' });
  const manifestURL = URL.createObjectURL(blob);

  let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!manifestLink) {
    manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    document.head.appendChild(manifestLink);
  }
  manifestLink.href = manifestURL;

  // Dispatch custom event so UI components can re-render if needed
  window.dispatchEvent(new CustomEvent('lodge-icon-changed', { detail: iconId }));
}
