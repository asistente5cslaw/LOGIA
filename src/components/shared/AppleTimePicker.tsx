import { useState, useRef, useEffect } from 'react';
import { Clock, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AppleTimePickerProps {
  label?: string;
  value: string; // formato "HH:mm" (24h) e.g. "19:30"
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

// Convertir "19:30" a { hour12: "07", minute: "30", period: "PM" }
function parse24to12(time24: string) {
  if (!time24) return { hour12: '07', minute: '30', period: 'PM' };
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ? mStr.padStart(2, '0') : '00';
  if (isNaN(h)) h = 19;
  const period = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return {
    hour12: String(h12).padStart(2, '0'),
    minute: m,
    period,
  };
}

// Convertir { hour12: "07", minute: "30", period: "PM" } a "19:30"
function format12to24(hour12Str: string, minuteStr: string, period: string) {
  let h = parseInt(hour12Str, 10);
  if (isNaN(h)) h = 12;
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${minuteStr.padStart(2, '0')}`;
}

const HOURS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

const PRESET_TIMES = [
  { label: '07:00 PM', value: '19:00' },
  { label: '07:30 PM', value: '19:30' },
  { label: '08:00 PM', value: '20:00' },
  { label: '08:30 PM', value: '20:30' },
  { label: '09:00 PM', value: '21:00' },
  { label: '10:00 AM', value: '10:00' },
];

export function AppleTimePicker({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  className,
}: AppleTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { hour12, minute, period } = parse24to12(value);

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleHourChange = (newHour: string) => {
    const time24 = format12to24(newHour, minute, period);
    onChange(time24);
  };

  const handleMinuteChange = (newMinute: string) => {
    const time24 = format12to24(hour12, newMinute, period);
    onChange(time24);
  };

  const handlePeriodChange = (newPeriod: 'AM' | 'PM') => {
    const time24 = format12to24(hour12, minute, newPeriod);
    onChange(time24);
  };

  const displayFormatted = `${hour12}:${minute} ${period}`;

  return (
    <div ref={containerRef} className={cn('relative flex flex-col gap-1 w-full', className)}>
      {label && (
        <label className="text-[11px] font-semibold tracking-wider uppercase text-ink-secondary flex items-center justify-between">
          <span>
            {label} {required && <span className="text-destructive">*</span>}
          </span>
        </label>
      )}

      {/* Botón Trigger elegante estilo Apple */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'h-11 w-full flex items-center justify-between rounded-xl border px-3.5 transition-all text-left select-none cursor-pointer',
          'bg-surface-container-low/60 hover:bg-surface-container-low',
          isOpen
            ? 'border-primary ring-3 ring-primary/15 bg-white shadow-xs'
            : 'border-border/80 text-ink',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex items-center gap-2.5">
          <Clock className={cn('h-4 w-4 shrink-0 transition-colors', isOpen ? 'text-primary' : 'text-ink-muted')} />
          <span className="text-xs sm:text-sm font-semibold text-ink font-mono tracking-tight">
            {displayFormatted}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-ink-muted transition-transform duration-200 shrink-0',
            isOpen && 'rotate-180 text-primary'
          )}
        />
      </button>

      {/* Popover / Menú desplegable Apple Style */}
      {isOpen && (
        <div className="absolute z-50 left-0 top-[calc(100%+4px)] w-72 sm:w-80 rounded-2xl border border-border bg-white p-3.5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
          {/* Header con vista actual y selector AM / PM */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/70">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-ink tracking-tight">
                {hour12}:{minute}
              </span>
              <span className="text-xs font-semibold text-primary">{period}</span>
            </div>

            {/* Switch AM / PM Pills */}
            <div className="flex p-0.5 rounded-lg bg-surface-container border border-border/60">
              <button
                type="button"
                onClick={() => handlePeriodChange('AM')}
                className={cn(
                  'px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer',
                  period === 'AM'
                    ? 'bg-white text-primary shadow-2xs'
                    : 'text-ink-muted hover:text-ink'
                )}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => handlePeriodChange('PM')}
                className={cn(
                  'px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer',
                  period === 'PM'
                    ? 'bg-white text-primary shadow-2xs'
                    : 'text-ink-muted hover:text-ink'
                )}
              >
                PM
              </button>
            </div>
          </div>

          {/* Horas y Minutos en Columnas Limpias */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Columna Horas */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1.5 px-1">
                Hora
              </div>
              <div className="grid grid-cols-3 gap-1 max-h-36 overflow-y-auto pr-1">
                {HOURS.map((h) => {
                  const isSelected = hour12 === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleHourChange(h)}
                      className={cn(
                        'h-8 rounded-lg text-xs font-medium font-mono transition-colors cursor-pointer flex items-center justify-center',
                        isSelected
                          ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                          : 'bg-surface-container-low text-ink hover:bg-surface-container-high'
                      )}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Columna Minutos */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1.5 px-1">
                Minuto
              </div>
              <div className="grid grid-cols-3 gap-1 max-h-36 overflow-y-auto pr-1">
                {MINUTES.map((m) => {
                  const isSelected = minute === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMinuteChange(m)}
                      className={cn(
                        'h-8 rounded-lg text-xs font-medium font-mono transition-colors cursor-pointer flex items-center justify-center',
                        isSelected
                          ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                          : 'bg-surface-container-low text-ink hover:bg-surface-container-high'
                      )}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Horarios Frecuentes / Rápidos */}
          <div className="pt-2.5 border-t border-border/70">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1.5">
              Horas Frecuentes de Tenida
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_TIMES.map((preset) => {
                const isSelected = value === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      onChange(preset.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'px-2 py-1 rounded-lg text-[11px] font-mono transition-colors cursor-pointer flex items-center gap-1',
                      isSelected
                        ? 'bg-primary/15 text-primary font-bold border border-primary/30'
                        : 'bg-surface-container-low text-ink-secondary hover:bg-surface-container border border-transparent'
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3 text-primary" />}
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Botón Listo */}
          <div className="mt-3 pt-2 border-t border-border flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-pressed transition-colors cursor-pointer shadow-2xs"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
