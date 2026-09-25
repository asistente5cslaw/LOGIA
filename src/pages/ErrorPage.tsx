import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, AlertTriangle } from 'lucide-react';

export function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  const is404 =
    isRouteErrorResponse(error) && error.status === 404;

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Icono central */}
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-surface border border-border shadow-sm">
            <AlertTriangle className="h-9 w-9 text-amber-500" />
          </div>
        </div>

        {/* Mensaje */}
        <div className="space-y-2">
          <h1 className="font-serif text-2xl font-bold text-ink">
            {is404 ? 'Página no encontrada' : 'Ocurrió un error'}
          </h1>
          <p className="text-sm text-ink-muted max-w-sm mx-auto">
            {is404
              ? 'La sección que buscas no existe o fue removida. Te invitamos a regresar al taller.'
              : 'Se produjo un error inesperado en la aplicación. Por favor regresa al inicio.'}
          </p>
        </div>

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto h-10 px-5 rounded-xl border border-border bg-white text-xs font-semibold text-ink-secondary hover:bg-surface-container transition-colors inline-flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver atrás
          </button>

          <button
            onClick={() => navigate('/app', { replace: true })}
            className="w-full sm:w-auto h-10 px-5 rounded-xl bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary-pressed shadow-sm transition-colors inline-flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Home className="h-4 w-4" />
            Ir al Inicio
          </button>
        </div>
      </div>
    </div>
  );
}
