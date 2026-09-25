import { Link } from 'react-router-dom';
import { LodgeLogo } from '@/components/shared/LodgeLogo';

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 text-center">
        <LodgeLogo className="mb-6 h-36 w-36 sm:h-44 sm:w-44" />
        <h1 className="font-serif text-4xl text-ink md:text-5xl">Unión Fraternal No. 21</h1>
        <p className="mt-3 text-base text-ink-secondary md:text-lg">
          Gestión privada para la logia masónica
        </p>

        <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
          <Link
            to="/login"
            className="flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-pressed"
          >
            Iniciar sesión
          </Link>
          <Link
            to="/registro"
            className="flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-container"
          >
            Registrarse
          </Link>
        </div>
      </main>
      <footer className="px-6 py-8 text-center text-xs text-ink-muted">
        Acceso restringido a miembros activos
      </footer>
    </div>
  );
}
