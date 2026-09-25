import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface AuthLayoutProps {
  children: ReactNode;
  showBack?: boolean;
  backTo?: string;
  onBack?: () => void;
}

export function AuthLayout({ children, showBack = true, backTo = '/', onBack }: AuthLayoutProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    // Si hay historial de navegación previo en la aplicación, retroceder
    if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
      navigate(-1);
      return;
    }
    // De lo contrario, ir a la ruta de retorno configurada o al inicio
    navigate(backTo || '/');
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex h-16 items-center px-4">
        {showBack ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Regresar"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-container transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <span className="w-11" />
        )}
      </header>
      <main className="flex flex-1 flex-col px-6 pb-12 sm:mx-auto sm:w-full sm:max-w-md sm:px-0">
        {children}
      </main>
    </div>
  );
}
