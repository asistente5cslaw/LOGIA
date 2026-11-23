import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'lg',
}: ModalProps) {
  // Bloquear scroll de fondo y capturar tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-3xl',
  }[maxWidth];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      {/* Telón de fondo completo de borde a borde */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Contenedor de tarjeta modal */}
      <div
        className={cn(
          'relative z-10 flex flex-col w-full max-h-[92vh] sm:max-h-[88vh] rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden',
          maxWidthClass
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera fija del modal */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5 shrink-0 bg-surface">
          <div className="min-w-0 flex-1 pr-1">
            <h3 className="font-serif text-lg sm:text-xl font-bold text-ink leading-tight break-words [overflow-wrap:anywhere]">
              {title}
            </h3>
            {subtitle && (
              <span className="mt-0.5 block text-xs leading-snug text-ink-secondary break-words [overflow-wrap:anywhere]">
                {subtitle}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-container hover:text-ink transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cuerpo scrolleable del modal */}
        <div className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto scrollbar-none p-4 sm:p-5 overscroll-contain">
          {children}
        </div>

        {/* Pie fijo opcional del modal */}
        {footer && (
          <div className="border-t border-border px-5 py-3.5 shrink-0 bg-surface flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
