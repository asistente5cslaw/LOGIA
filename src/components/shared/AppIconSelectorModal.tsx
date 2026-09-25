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
  Sparkles,
  X,
  Share2,
  PlusSquare,
  Shield,
  Layers,
} from 'lucide-react';

interface AppIconSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoInstallOnSelect?: boolean;
}

export const AppIconSelectorModal: React.FC<AppIconSelectorModalProps> = ({
  isOpen,
  onClose,
  autoInstallOnSelect = false,
}) => {
  const [selectedIcon, setSelectedIcon] = useState<LodgeIconOption>(getSelectedLodgeIcon());
  const [installPrompt, setInstallPrompt] = useState<any>(getDeferredInstallPrompt());
  const [installedSuccess, setInstalledSuccess] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedIcon(getSelectedLodgeIcon());
      setInstallPrompt(getDeferredInstallPrompt());
      const userAgent = window.navigator.userAgent.toLowerCase();
      setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    }
  }, [isOpen]);

  useEffect(() => {
    const handleInstallable = (e: any) => {
      setInstallPrompt(e.detail);
    };
    window.addEventListener('pwa-installable', handleInstallable);
    return () => window.removeEventListener('pwa-installable', handleInstallable);
  }, []);

  if (!isOpen) return null;

  const handleSelectIcon = (iconId: LodgeIconOption) => {
    setSelectedIcon(iconId);
    applyLodgeIcon(iconId);
  };

  const handleSaveAndInstall = async () => {
    applyLodgeIcon(selectedIcon);

    if (installPrompt) {
      try {
        installPrompt.prompt();
        const choiceResult = await installPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setInstalledSuccess(true);
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
      setInstalledSuccess(true);
      setTimeout(() => {
        setInstalledSuccess(false);
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-navy-900 border border-gold-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
        <div className="p-6 overflow-y-auto space-y-6">
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

          {installedSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-center text-xs text-emerald-300 flex items-center justify-center space-x-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Ícono aplicado exitosamente a la configuración de la App.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-navy-950/80 border-t border-white/5 flex items-center justify-between gap-3">
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
            {installPrompt ? (
              <>
                <Download className="w-4 h-4" />
                <span>Instalar con este Ícono</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Guardar Ícono Seleccionado</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
