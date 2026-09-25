import { ConstructionNotice } from '@/components/shared/ConstructionNotice';

interface ModulePlaceholderProps {
  title: string;
  description?: string;
}

export function ModulePlaceholder({ title, description }: ModulePlaceholderProps) {
  return (
    <div className="px-6 pt-6 md:px-8">
      <h1 className="font-serif text-2xl text-ink md:text-3xl">{title}</h1>
      <div className="mt-6">
        <ConstructionNotice message={description ?? 'Módulo en construcción'} />
      </div>
    </div>
  );
}
