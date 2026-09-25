import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div>
        <h1 className="font-serif text-2xl text-ink md:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-xs sm:text-sm text-ink-secondary">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

