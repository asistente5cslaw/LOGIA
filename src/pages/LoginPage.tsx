import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Mail, Lock, Loader2, ArrowRight, UserPlus, Eye, EyeOff } from 'lucide-react';
import { LodgeLogo } from '@/components/shared/LodgeLogo';
import { Modal } from '@/components/shared/Modal';

export function LoginPage() {
  const { user, login, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Si ya tiene sesión activa o se autentica en segundo plano, ingresar directo
  useEffect(() => {
    if (user && user.isAuthenticated) {
      navigate('/app', { replace: true });
    }
  }, [user, navigate]);

  // Modal para restablecer contraseña
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [forgotMessage, setForgotMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        setLoading(false);
        setError('El servidor tardó en responder. Por favor reintenta ingresar.');
      }
    }, 9000);

    try {
      await login(email, password);
      finished = true;
      clearTimeout(timer);
      navigate('/app', { replace: true });
    } catch (err: unknown) {
      finished = true;
      clearTimeout(timer);
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotStatus('loading');
    setForgotMessage('');
    try {
      await resetPassword(forgotEmail);
      setForgotStatus('success');
      setForgotMessage('Hemos enviado las instrucciones para restablecer tu contraseña a tu correo.');
    } catch (err: unknown) {
      setForgotStatus('error');
      setForgotMessage(err instanceof Error ? err.message : 'No se pudo procesar la solicitud.');
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col items-center text-center">
        <LodgeLogo className="mx-auto mb-6 h-28 w-28" />
        <h1 className="font-serif text-3xl text-ink">Bienvenido, Hermano</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Ingresa con tu correo registrado y contraseña
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs sm:text-sm font-medium text-ink flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-ink-muted" /> Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-[46px] rounded-xl border border-border bg-surface px-3.5 text-base sm:text-sm text-ink shadow-2xs outline-none focus:border-primary focus:ring-3 focus:ring-primary/15 transition-all"
            placeholder="hermano@logia.org"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-xs sm:text-sm font-medium text-ink flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-ink-muted" /> Contraseña
            </label>
            <button
              type="button"
              onClick={() => {
                setForgotEmail(email);
                setShowForgotModal(true);
              }}
              className="text-xs text-primary hover:underline py-0.5"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          <div className="relative flex items-center">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-[46px] w-full rounded-xl border border-border bg-surface pl-3.5 pr-11 text-base sm:text-sm text-ink shadow-2xs outline-none focus:border-primary focus:ring-3 focus:ring-primary/15 transition-all"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-container hover:text-ink transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary-pressed active:scale-98 disabled:opacity-60 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Ingresando…
            </>
          ) : (
            <>
              Iniciar sesión
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 flex flex-col items-center gap-3 border-t border-border pt-6 text-sm">
        <Link
          to="/registro"
          className="flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          <UserPlus className="h-4 w-4" />
          ¿No tienes una cuenta? Regístrate
        </Link>
      </div>

      {/* Modal de Recuperación de Contraseña */}
      <Modal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        title="Recuperar Contraseña"
        subtitle="Ingresa el correo asociado a tu cuenta para enviarte un enlace de restablecimiento seguro."
        maxWidth="sm"
      >
        {forgotStatus === 'success' ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-success/10 p-3 text-xs text-success">
              {forgotMessage}
            </div>
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Entendido
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgotPassword} noValidate className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="forgotEmail" className="text-xs font-medium text-ink">
                Correo electrónico
              </label>
              <input
                id="forgotEmail"
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="hermano@logia.org"
                className="min-h-[44px] rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>

            {forgotStatus === 'error' && (
              <p className="text-xs text-destructive">{forgotMessage}</p>
            )}

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-border px-3 text-xs font-medium text-ink-secondary hover:bg-surface-container"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={forgotStatus === 'loading'}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-60"
              >
                {forgotStatus === 'loading' ? 'Enviando…' : 'Enviar enlace'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
