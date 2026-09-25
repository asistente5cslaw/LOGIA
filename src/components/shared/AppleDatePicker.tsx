import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AppleDatePickerProps {
  value: string; // Formato 'YYYY-MM-DD'
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  error?: string;
  helperText?: string;
  className?: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEKDAY_NAMES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export function AppleDatePicker({
  value,
  onChange,
  label,
  placeholder = 'Seleccionar fecha...',
  required = false,
  disabled = false,
  minDate,
  maxDate,
  error,
  helperText,
  className,
}: AppleDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  // Fecha para navegación en el calendario
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (value) {
      const [y, m, d] = value.split('-').map(Number);
      if (y && m && d) return new Date(y, m - 1, d);
    }
    return new Date();
  });

  // Si cambia el value desde fuera, sincronizar viewDate
  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split('-').map(Number);
      if (y && m && d) {
        setViewDate(new Date(y, m - 1, d));
      }
    }
  }, [value]);

  // Actualizar posición del popover
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(300, window.innerWidth - 24);
    const popoverHeight = 320;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < popoverHeight && rect.top > popoverHeight;
    const topPos = openUpwards ? rect.top - popoverHeight - 6 : rect.bottom + 6;

    const left = Math.max(12, Math.min(rect.left, window.innerWidth - popoverWidth - 12));

    setPopoverStyle({
      position: 'fixed',
      top: `${Math.max(10, topPos)}px`,
      left: `${left}px`,
      width: `${popoverWidth}px`,
      zIndex: 9999,
      backgroundColor: '#ffffff',
    });
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleResize = () => updatePosition();
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleResize, true);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleResize, true);
      };
    }
  }, [isOpen]);

  // Cerrar al hacer clic fuera o presionar escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Formato para mostrar en el botón
  const formatDisplay = (val: string) => {
    if (!val) return null;
    const [y, m, d] = val.split('-').map(Number);
    if (!y || !m || !d) return val;
    const month = MONTH_NAMES[m - 1]?.slice(0, 3).toLowerCase();
    return `${d} ${month} ${y}`;
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const y = viewDate.getFullYear();
    const m = String(viewDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  // Cálculo de la cuadrícula del mes
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Domingo

  // Determinar hoy
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  // Determinar seleccionado
  let selectedDay: number | null = null;
  if (value) {
    const [vy, vm, vd] = value.split('-').map(Number);
    if (vy === year && vm === month + 1) {
      selectedDay = vd;
    }
  }

  return (
    <div className={cn('flex flex-col gap-1 w-full', className)}>
      {label && (
        <label className="text-[11px] font-semibold tracking-wider uppercase text-ink-secondary">
          {label} {required && <span className="text-primary">*</span>}
        </label>
      )}

      {/* Disparador estilo Apple Input */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        className={cn(
          'flex h-11 w-full items-center justify-between rounded-xl border px-3 text-xs sm:text-sm font-medium transition-all text-left select-none cursor-pointer',
          'bg-surface-container-low/60 hover:bg-surface-container-low focus:bg-surface shadow-2xs',
          isOpen
            ? 'border-primary ring-3 ring-primary/15 bg-white'
            : error
            ? 'border-destructive ring-2 ring-destructive/15'
            : 'border-border/80 hover:border-ink-muted/40',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <CalendarIcon className="h-4 w-4 text-ink-muted shrink-0" />
          <span className={cn('truncate', !value && 'text-ink-muted')}>
            {value ? formatDisplay(value) : placeholder}
          </span>
        </div>

        {value && !required && (
          <span
            onClick={handleClear}
            className="flex h-5 w-5 items-center justify-center rounded-full text-ink-muted hover:bg-surface-container hover:text-ink cursor-pointer shrink-0"
            title="Borrar fecha"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {error && <span className="text-[11px] text-destructive font-medium">{error}</span>}
      {helperText && !error && <span className="text-[10px] text-ink-muted">{helperText}</span>}

      {/* Popover Calendario estilo Apple */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={popoverStyle}
            className="rounded-2xl border border-border bg-white shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150 select-none overflow-hidden"
          >
            {/* Cabecera del Mes y Año */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-container hover:text-ink transition-colors cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="text-xs font-semibold text-ink">
                {MONTH_NAMES[month]} {year}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-container hover:text-ink transition-colors cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Días de la semana */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {WEEKDAY_NAMES.map((d, i) => (
                <span key={i} className="text-[10px] font-semibold text-ink-muted">
                  {d}
                </span>
              ))}
            </div>

            {/* Cuadrícula de días */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {/* Espacios vacíos antes del 1er día */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-8 w-8" />
              ))}

              {/* Días del mes */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const isSelected = selectedDay === day;
                const isToday = isCurrentMonth && todayDate === day;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleSelectDay(day)}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors cursor-pointer mx-auto',
                      isSelected
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : isToday
                        ? 'border border-primary text-primary font-semibold hover:bg-primary/10'
                        : 'text-ink hover:bg-surface-container'
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Pie con botón Hoy */}
            <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleSelectToday}
                className="text-primary font-semibold hover:underline cursor-pointer text-[11px]"
              >
                Seleccionar Hoy
              </button>
              {value && !required && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-ink-muted hover:text-ink cursor-pointer text-[11px]"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
