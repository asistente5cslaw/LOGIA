import { useState, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AppleSelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
  color?: string;
  badge?: string;
}

export interface AppleSelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: AppleSelectOption<T>[];
  label?: string;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
}

export function AppleSelect<T extends string = string>({
  value,
  onChange,
  options,
  label,
  placeholder = 'Seleccionar...',
  searchable,
  disabled = false,
  className,
}: AppleSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const selectedOption = options.find((opt) => opt.value === value);

  // Activar búsqueda automáticamente si hay más de 5 opciones o si se especifica searchable
  const isSearchEnabled = searchable !== undefined ? searchable : options.length > 5;

  const filteredOptions = isSearchEnabled && searchQuery.trim()
    ? options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (opt.description && opt.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : options;

  // Calcular posición exacta usando portal para que nunca se recorte dentro de modales
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = Math.min(320, options.length * 44 + (isSearchEnabled ? 50 : 0) + 20);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
    const topPos = openUpwards ? rect.top - dropdownHeight - 6 : rect.bottom + 6;

    const width = Math.min(rect.width, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));

    setMenuStyle({
      position: 'fixed',
      top: `${Math.max(10, topPos)}px`,
      left: `${left}px`,
      width: `${width}px`,
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: `${dropdownHeight}px`,
      zIndex: 9999,
      backgroundColor: '#ffffff',
    });
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);

      return () => {
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
      };
    }
  }, [isOpen, options.length]);

  // Cerrar al hacer clic fuera o presionar Escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: T) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label className="text-[11px] font-semibold tracking-wider uppercase text-ink-secondary">
          {label}
        </label>
      )}

      {/* Botón Disparador estilo Apple */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearchQuery('');
          }
        }}
        className={cn(
          'flex h-11 w-full items-center justify-between rounded-xl border px-3 text-xs font-medium transition-all text-left select-none cursor-pointer',
          'bg-white text-ink shadow-2xs',
          isOpen
            ? 'border-primary ring-3 ring-primary/15 bg-white'
            : 'border-border hover:border-ink-muted/40',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden pr-2">
          {selectedOption?.icon && (
            <span className="shrink-0 flex items-center">{selectedOption.icon}</span>
          )}
          {selectedOption?.color && (
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: selectedOption.color }}
            />
          )}
          <span className={cn('truncate', !selectedOption && 'text-ink-muted')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200',
            isOpen && 'rotate-180 text-primary'
          )}
        />
      </button>

      {/* Menú Flotante Inteligente estilo Apple (Portal al body) */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ ...menuStyle, backgroundColor: '#ffffff' }}
            className="flex flex-col rounded-2xl border border-border bg-white shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
          >
            {/* Buscador inteligente si hay muchas opciones */}
            {isSearchEnabled && (
              <div className="relative mb-1.5 border-b border-border/60 pb-1.5 px-1 shrink-0">
                <div className="relative flex items-center">
                  <Search className="absolute left-2.5 h-3.5 w-3.5 text-ink-muted pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrar opción..."
                    className="h-8 w-full rounded-lg bg-surface-container-low pl-8 pr-7 text-xs text-ink placeholder:text-ink-muted outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 text-ink-muted hover:text-ink"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Lista de opciones scrolleable */}
            <div className="flex-1 overflow-y-auto space-y-0.5 overscroll-contain pr-0.5">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-xs text-ink-muted">
                  No se encontraron resultados
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-colors text-left cursor-pointer',
                        isSelected
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'text-ink hover:bg-surface-container hover:text-ink'
                      )}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden min-w-0 flex-1">
                        {opt.icon && (
                          <span className="shrink-0 flex items-center">{opt.icon}</span>
                        )}
                        {opt.color && (
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full shrink-0',
                              isSelected && 'ring-1 ring-primary-foreground'
                            )}
                            style={{ backgroundColor: opt.color }}
                          />
                        )}
                        <div className="truncate min-w-0 flex-1">
                          <div className="truncate">{opt.label}</div>
                          {opt.description && (
                            <div
                              className={cn(
                                'text-[10px] truncate leading-tight mt-0.5',
                                isSelected ? 'text-primary-foreground/80' : 'text-ink-muted'
                              )}
                            >
                              {opt.description}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {opt.badge && (
                          <span
                            className={cn(
                              'rounded-full px-1.5 py-0.5 text-[9px] font-mono',
                              isSelected
                                ? 'bg-primary-foreground/20 text-primary-foreground'
                                : 'bg-surface-container-high text-ink-muted'
                            )}
                          >
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && <Check className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
