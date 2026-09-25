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
    <div className="min-h-screen w-full flex flex-col bg-canvas overflow-y-auto">
      <header className="flex h-16 shrink-0 items-center px-4">
        {showBack ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Regresar"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-container transition-colors cursor-pointer active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <span className="w-11" />
        )}
      </header>
      <main className="flex-1 w-full max-w-md mx-auto px-5 sm:px-6 pb-20 pt-1 flex flex-col justify-start">
        {children}
      </main>
    </div>
  );
}
