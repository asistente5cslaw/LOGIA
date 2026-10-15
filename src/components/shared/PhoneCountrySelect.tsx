import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { panamaPhoneCountry, phoneCountries, type PhoneCountry } from '@/data/phoneCountries';

interface PhoneCountrySelectProps {
  value: string;
  onChange: (countryCode: string) => void;
  disabled?: boolean;
}

export function PhoneCountrySelect({ value, onChange, disabled = false }: PhoneCountrySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = phoneCountries.find((country) => country.code === value) || panamaPhoneCountry;
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredCountries = normalizedSearch
    ? phoneCountries.filter((country) => `${country.name} ${country.dialCode} ${country.code}`.toLocaleLowerCase().includes(normalizedSearch))
    : phoneCountries;

  const updateMenuPosition = () => {
    const trigger = containerRef.current?.getBoundingClientRect();
    if (!trigger) return;
    const width = Math.min(Math.max(trigger.width, 300), window.innerWidth - 16);
    const left = Math.min(Math.max(trigger.left, 8), window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - trigger.bottom - 8;
    const opensUp = spaceBelow < 280 && trigger.top > spaceBelow;
    setMenuStyle({
      left,
      width,
      maxHeight: Math.min(340, window.innerHeight - 16),
      ...(opensUp ? { bottom: window.innerHeight - trigger.top + 6 } : { top: trigger.bottom + 6 }),
    });
  };

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    const handleViewportChange = () => updateMenuPosition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen]);

  const chooseCountry = (country: PhoneCountry) => {
    onChange(country.code);
    setSearch('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="País del teléfono"
        onClick={() => {
          setIsOpen((open) => !open);
          window.requestAnimationFrame(updateMenuPosition);
        }}
        className="flex min-h-[46px] w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 text-left text-sm text-ink outline-none transition-all hover:border-primary focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Flag country={selected} />
        <span className="min-w-0 flex-1 truncate">{selected.name}</span>
        <span className="shrink-0 text-ink-secondary">{selected.dialCode}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <div ref={menuRef} style={menuStyle} className="fixed z-[120] overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          <div className="border-b border-border p-2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5">
              <Search className="h-4 w-4 shrink-0 text-ink-muted" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                autoFocus
                placeholder="Buscar país o prefijo"
                className="min-h-[38px] min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
              />
            </div>
          </div>
          <div role="listbox" aria-label="Países y prefijos telefónicos" className="max-h-64 overflow-y-auto p-1">
            {filteredCountries.map((country) => {
              const isSelected = country.code === selected.code;
              return (
                <button
                  key={country.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => chooseCountry(country)}
                  className={`flex min-h-[42px] w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm transition-colors hover:bg-primary/10 ${isSelected ? 'bg-primary/10 text-primary' : 'text-ink'}`}
                >
                  <Flag country={country} />
                  <span className="min-w-0 flex-1 truncate">{country.name}</span>
                  <span className="shrink-0 text-ink-secondary">{country.dialCode}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })}
            {filteredCountries.length === 0 && <p className="px-3 py-5 text-center text-sm text-ink-secondary">No se encontró ese país.</p>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function Flag({ country }: { country: PhoneCountry }) {
  return (
    <span className="relative inline-flex h-5 w-7 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface-container text-sm leading-none" aria-label={`Bandera de ${country.name}`}>
      <span aria-hidden="true">{country.flag}</span>
      <img src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
    </span>
  );
}
