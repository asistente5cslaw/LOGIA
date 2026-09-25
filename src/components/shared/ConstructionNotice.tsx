import { Hammer } from 'lucide-react';

export function ConstructionNotice({ message = 'Módulo en construcción' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface px-6 py-12 text-center shadow-card">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-gold">
        <Hammer className="h-6 w-6" />
      </div>
      <p className="text-sm text-ink-secondary">{message}</p>
    </div>
  );
}
