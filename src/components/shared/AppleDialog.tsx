import { createContext, useContext, useState, type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, HelpCircle, Info, X } from 'lucide-react';
import { AppleEmoji } from '@/components/shared/AppleEmoji';

export interface AppleDialogOptions {
  title: string;
  message: string;
  type?: 'error' | 'warning' | 'info' | 'success' | 'confirm';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AppleDialogContextType {
  showAlert: (options: AppleDialogOptions) => void;
  showConfirm: (options: AppleDialogOptions) => Promise<boolean>;
  closeDialog: () => void;
}

const AppleDialogContext = createContext<AppleDialogContextType | undefined>(undefined);

export function AppleDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<(AppleDialogOptions & { isOpen: boolean; resolve?: (val: boolean) => void }) | null>(null);

  const showAlert = (options: AppleDialogOptions) => {
    setDialog({ ...options, isOpen: true });
  };

  const showConfirm = (options: AppleDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        ...options,
        isOpen: true,
        type: options.type || 'confirm',
        confirmText: options.confirmText || 'Continuar',
        cancelText: options.cancelText || 'Cancelar',
        resolve,
      });
    });
  };

  const closeDialog = () => {
    if (dialog?.resolve) {
      dialog.resolve(false);
    }
    setDialog(null);
  };

  const handleConfirm = () => {
    if (dialog?.onConfirm) dialog.onConfirm();
    if (dialog?.resolve) dialog.resolve(true);
    setDialog(null);
  };

  const handleCancel = () => {
    if (dialog?.onCancel) dialog.onCancel();
    if (dialog?.resolve) dialog.resolve(false);
    setDialog(null);
  };

  const type = dialog?.type || 'info';

  const getIcon = () => {
    switch (type) {
      case 'error':
        return (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-xs">
            <AlertCircle className="h-6 w-6 stroke-[2.2]" />
          </div>
        );
      case 'warning':
        return (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 shadow-xs">
            <AlertTriangle className="h-6 w-6 stroke-[2.2]" />
          </div>
        );
      case 'success':
        return (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 shadow-xs">
            <CheckCircle2 className="h-6 w-6 stroke-[2.2]" />
          </div>
        );
      case 'confirm':
        return (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
            <AppleEmoji name="temple" size={26} />
          </div>
        );
      default:
        return (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
            <Info className="h-6 w-6 stroke-[2.2]" />
          </div>
        );
    }
  };

  return (
    <AppleDialogContext.Provider value={{ showAlert, showConfirm, closeDialog }}>
      {children}

      {/* Modal Cuadro de Notificación estilo Apple / macOS */}
      {dialog?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Fondo oscuro con difuminado suave */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
            onClick={closeDialog}
          />

          {/* Recuadro de diálogo nativo */}
          <div
            style={{ backgroundColor: '#ffffff' }}
            className="relative z-10 w-full max-w-sm sm:max-w-md rounded-3xl border border-border bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-center flex flex-col items-center"
          >
            {/* Botón cerrar sutil */}
            <button
              onClick={closeDialog}
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-surface-container hover:text-ink transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Ícono de estado Apple */}
            <div className="mb-3.5 flex justify-center">{getIcon()}</div>

            {/* Título de la notificación */}
            <h3 className="font-serif text-lg font-bold text-ink leading-snug px-2">
              {dialog.title}
            </h3>

            {/* Mensaje descriptivo */}
            <p className="mt-2 text-xs sm:text-sm text-ink-secondary leading-relaxed max-w-xs sm:max-w-sm px-1">
              {dialog.message}
            </p>

            {/* Botones de Acción estilo Apple */}
            <div className="mt-6 flex w-full gap-2.5">
              {dialog.resolve ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 min-h-[42px] items-center justify-center rounded-xl border border-border bg-white px-4 text-xs font-semibold text-ink-secondary hover:bg-surface-container transition-all cursor-pointer active:scale-95"
                  >
                    {dialog.cancelText || 'Cancelar'}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="flex-1 min-h-[42px] items-center justify-center rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-pressed transition-all cursor-pointer active:scale-95"
                  >
                    {dialog.confirmText || 'Aceptar'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="w-full min-h-[42px] items-center justify-center rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-pressed transition-all cursor-pointer active:scale-95"
                >
                  {dialog.confirmText || 'Entendido'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AppleDialogContext.Provider>
  );
}

export function useAppleDialog() {
  const context = useContext(AppleDialogContext);
  if (!context) {
    throw new Error('useAppleDialog debe usarse dentro de AppleDialogProvider');
  }
  return context;
}
