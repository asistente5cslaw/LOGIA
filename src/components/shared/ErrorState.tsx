import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'No pudimos cargar esta información', description, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-destructive">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-destructive/80">{description}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-destructive/25 bg-white px-3 text-xs font-semibold text-destructive hover:bg-destructive/10">
              <RefreshCw className="h-3.5 w-3.5" /> Reintentar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
