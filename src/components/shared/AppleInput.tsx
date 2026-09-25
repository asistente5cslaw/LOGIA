import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface AppleInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: ReactNode;
  error?: string;
  helperText?: string;
}

export const AppleInput = forwardRef<HTMLInputElement, AppleInputProps>(
  ({ label, icon, error, helperText, className, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label htmlFor={id} className="text-[11px] font-semibold tracking-wider uppercase text-ink-secondary">
            {label}
          </label>
        )}

        <div
          className={cn(
            'relative flex items-center rounded-xl border transition-all duration-150',
            'bg-surface-container-low/60 hover:bg-surface-container-low focus-within:bg-surface',
            error
              ? 'border-destructive ring-2 ring-destructive/15'
              : 'border-border/80 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15',
            className
          )}
        >
          {icon && (
            <div className="pl-3.5 pr-1 flex items-center justify-center text-ink-muted shrink-0 pointer-events-none">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            className={cn(
              'h-11 w-full bg-transparent text-xs sm:text-sm text-ink placeholder:text-ink-muted/60 outline-none transition-colors',
              icon ? 'pl-2 pr-3.5' : 'px-3.5'
            )}
            {...props}
          />
        </div>

        {error && <span className="text-[11px] text-destructive font-medium">{error}</span>}
        {helperText && !error && <span className="text-[10px] text-ink-muted">{helperText}</span>}
      </div>
    );
  }
);
AppleInput.displayName = 'AppleInput';

export interface AppleTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const AppleTextarea = forwardRef<HTMLTextAreaElement, AppleTextareaProps>(
  ({ label, error, className, id, rows = 4, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label htmlFor={id} className="text-[11px] font-semibold tracking-wider uppercase text-ink-secondary">
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={id}
          rows={rows}
          className={cn(
            'w-full rounded-xl border p-3 text-xs sm:text-sm text-ink placeholder:text-ink-muted/60 outline-none transition-all duration-150',
            'bg-surface-container-low/60 hover:bg-surface-container-low focus:bg-surface',
            error
              ? 'border-destructive ring-2 ring-destructive/15'
              : 'border-border/80 focus:border-primary focus:ring-3 focus:ring-primary/15',
            className
          )}
          {...props}
        />

        {error && <span className="text-[11px] text-destructive font-medium">{error}</span>}
      </div>
    );
  }
);
AppleTextarea.displayName = 'AppleTextarea';
