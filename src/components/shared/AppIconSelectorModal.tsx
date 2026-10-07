import React, { useState, useEffect } from 'react';
import {
  LODGE_ICONS,
  LodgeIconOption,
  getSelectedLodgeIcon,
  applyLodgeIcon,
  getDeferredInstallPrompt,
  clearDeferredInstallPrompt,
} from '@/services/pwaIconService';
import {
  Check,
  Download,
  Smartphone,
  X,
  Share2,
  PlusSquare,
} from 'lucide-react';

interface AppIconSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function getInstallFallbackMessage(): string {
  if (typeof navigator === 'undefined') return '';
  const userAgent = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent) || (userAgent.includes('macintosh') && navigator.maxTouchPoints > 1);

  if (isIOS) {
    return 'En iPhone o iPad: abre esta página en Safari, toca Compartir y selecciona “Añadir a la pantalla de inicio”. Apple no permite que una web confirme esa instalación automáticamente.';
  }
  if (userAgent.includes('android')) {
    return 'En Android: abre el menú del navegador y selecciona “Instalar aplicación” o “Añadir a pantalla de inicio”. Chrome y Edge mostrarán el diálogo automáticamente cuando el dispositivo cumpla los requisitos de instalación.';
  }
  if (userAgent.includes('firefox')) {
    return 'En Firefox: abre el menú del navegador y selecciona “Instalar” o “Añadir a la pantalla de inicio”, según tu dispositivo.';
  }
  if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
    return 'En Safari: usa el menú Compartir y selecciona “Añadir al Dock” o “Añadir a la pantalla de inicio”, según el dispositivo.';
  }
  return 'Este navegador no habilitó el instalador automático. Abre su menú y selecciona “Instalar aplicación” o “Añadir a pantalla de inicio”.';
}

export const AppIconSelectorModal: React.FC<AppIconSelectorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedIcon, setSelectedIcon] = useState<LodgeIconOption>(getSelectedLodgeIcon());
  const [installPrompt, setInstallPrompt] = useState<ReturnType<typeof getDeferredInstallPrompt>>(getDeferredInstallPrompt());
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installMessage, setInstallMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedIcon(getSelectedLodgeIcon());
      setInstallPrompt(getDeferredInstallPrompt());
      const userAgent = window.navigator.userAgent.toLowerCase();
      setIsIOS(/iphone|ipad|ipod/.test(userAgent) || (userAgent.includes('macintosh') && navigator.maxTouchPoints > 1));
      setIsInstalled(window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    }
  }, [isOpen]);

  useEffect(() => {
    const handleInstallable = (e: Event) => {
      setInstallPrompt((e as CustomEvent<ReturnType<typeof getDeferredInstallPrompt>>).detail);
    };
    window.addEventListener('pwa-installable', handleInstallable);
    return () => window.removeEventListener('pwa-installable', handleInstallable);
  }, []);

  useEffect(() => {
    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallMessage('La aplicación fue instalada correctamente.');
      clearDeferredInstallPrompt();
      setInstallPrompt(null);
    };
    window.addEventListener('appinstalled', handleInstalled);
    return () => window.removeEventListener('appinstalled', handleInstalled);
  }, []);

  if (!isOpen) return null;

  const handleSelectIcon = (iconId: LodgeIconOption) => {
    setSelectedIcon(iconId);
    applyLodgeIcon(iconId);
  };

  const handleSaveAndInstall = async () => {
    applyLodgeIcon(selectedIcon);

    if (isInstalled) {
      setInstallMessage('La plataforma ya está instalada como aplicación en este dispositivo.');
      return;
    }

    if (installPrompt) {
      try {
        installPrompt.prompt();
        const choiceResult = await installPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setInstallMessage('Aplicación instalada correctamente. Puedes abrirla desde la pantalla de inicio.');
          clearDeferredInstallPrompt();
          setInstallPrompt(null);
          setTimeout(() => {
            onClose();
          }, 2000);
        }
      } catch (err) {
        console.warn('Error launching install prompt:', err);
      }
    } else {
      setInstallMessage(getInstallFallbackMessage());
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/80 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md animate-fade-in">
      <div className="relative my-auto flex min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gold-500/40 bg-navy-900 shadow-2xl max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1.5rem)]">
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-gold-500/20 bg-gradient-to-r from-crimson-950/60 via-navy-900 to-navy-950 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-cream-100 font-serif">
                Ícono de la Aplicación
              </h3>
              <p className="text-xs text-cream-400">
                Selecciona tu logo preferido para la pantalla de inicio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-cream-400 hover:text-cream-100 hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 space-y-6">
          <p className="text-sm text-cream-300 leading-relaxed">
            Puedes elegir con cuál de los dos emblemas oficiales deseas guardar o instalar la plataforma en tu teléfono móvil o computadora:
          </p>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Option 1: Emblem */}
            <div
              onClick={() => handleSelectIcon('emblem')}
              className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all duration-200 flex flex-col items-center text-center ${
                selectedIcon === 'emblem'
                  ? 'border-gold-400 bg-gold-500/10 shadow-lg shadow-gold-500/10 scale-[1.02]'
                  : 'border-white/10 bg-navy-800/60 hover:border-gold-500/40 hover:bg-navy-800'
              }`}
            >
              {selectedIcon === 'emblem' && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gold-500 text-navy-950 flex items-center justify-center font-bold shadow">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
              )}
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-gold-500/40 shadow-md mb-3 bg-black flex items-center justify-center">
                <img
                  src={LODGE_ICONS.emblem.imageSrc}
                  alt={LODGE_ICONS.emblem.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <h4 className="text-sm font-bold text-cream-100 font-serif mb-1">
                {LODGE_ICONS.emblem.name}
              </h4>
              <span className="text-[11px] font-medium text-gold-400 mb-2">
                {LODGE_ICONS.emblem.subtitle}
              </span>
              <p className="text-[11px] text-cream-400 leading-snug line-clamp-3">
                {LODGE_ICONS.emblem.description}
              </p>
            </div>

            {/* Option 2: Monogram */}
            <div
              onClick={() => handleSelectIcon('monogram')}
              className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all duration-200 flex flex-col items-center text-center ${
                selectedIcon === 'monogram'
                  ? 'border-gold-400 bg-gold-500/10 shadow-lg shadow-gold-500/10 scale-[1.02]'
                  : 'border-white/10 bg-navy-800/60 hover:border-gold-500/40 hover:bg-navy-800'
              }`}
            >
              {selectedIcon === 'monogram' && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gold-500 text-navy-950 flex items-center justify-center font-bold shadow">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
              )}
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-gold-500/40 shadow-md mb-3 bg-black flex items-center justify-center">
                <img
                  src={LODGE_ICONS.monogram.imageSrc}
                  alt={LODGE_ICONS.monogram.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <h4 className="text-sm font-bold text-cream-100 font-serif mb-1">
                {LODGE_ICONS.monogram.name}
              </h4>
              <span className="text-[11px] font-medium text-gold-400 mb-2">
                {LODGE_ICONS.monogram.subtitle}
              </span>
              <p className="text-[11px] text-cream-400 leading-snug line-clamp-3">
                {LODGE_ICONS.monogram.description}
              </p>
            </div>
          </div>

          {/* Instructions for iOS if applicable */}
          {isIOS && (
            <div className="p-3.5 bg-gold-500/10 border border-gold-500/20 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-xs font-semibold text-gold-300">
                <Share2 className="w-4 h-4" />
                <span>Instrucciones para iPhone / iPad (Safari):</span>
              </div>
              <p className="text-xs text-cream-300">
                1. Toca el botón <strong>Compartir</strong> en la barra inferior de Safari.<br />
                2. Selecciona <strong>"Añadir a la pantalla de inicio"</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-1" />.<br />
                3. Se guardará inmediatamente con el logo seleccionado.
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-navy-950/80 border-t border-white/5">
          {installMessage && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/80 p-3 text-xs leading-relaxed text-emerald-100" role="status" aria-live="polite">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <span>{installMessage}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-white/10 text-cream-300 text-xs font-medium hover:bg-white/5 transition-colors"
          >
            Cerrar
          </button>

          <button
            type="button"
            onClick={handleSaveAndInstall}
            className="flex-1 flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 text-navy-950 font-bold text-xs shadow-lg shadow-gold-500/20 hover:from-gold-400 hover:to-gold-300 transition-all"
          >
            {isInstalled ? (
              <>
                <Check className="w-4 h-4" />
                <span>Aplicación ya instalada</span>
              </>
            ) : installPrompt ? (
              <>
                <Download className="w-4 h-4" />
                <span>Instalar con este Ícono</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>{isIOS ? 'Guardar y ver instrucciones' : 'Instalar aplicación'}</span>
              </>
            )}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
};
