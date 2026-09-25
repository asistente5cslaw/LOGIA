import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Clock, ArrowRight } from 'lucide-react';

export function RegisterConfirmationPage() {
  const [status, setStatus] = useState<string>('pending');

  useEffect(() => {
    const s = sessionStorage.getItem('logia_reg_result_status') || 'pending';
    setStatus(s);
  }, []);

  const isApproved = status === 'approved';

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center px-4 py-8">
      <div
        className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl shadow-md ${
          isApproved ? 'bg-success text-white' : 'bg-gold/20 text-gold-dark text-amber-700'
        }`}
      >
        {isApproved ? <ShieldCheck className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
      </div>

      <h1 className="font-serif text-3xl text-ink">
        {isApproved ? 'Identidad Verificada' : 'Validación Pendiente'}
      </h1>

      <p className="mt-3 max-w-sm text-sm text-ink-secondary leading-relaxed">
        {isApproved
          ? 'Tu cuenta ha sido confirmada y tu identidad ha sido verificada. Ya puedes ingresar al portal de la logia.'
          : 'Tu solicitud de ingreso ha sido registrada. De conformidad con las normas de seguridad del taller, el Secretario revisará tu comprobación facial y confirmará tu acceso definitivo.'}
      </p>

      <div className="mt-4 rounded-xl border border-border bg-surface p-4 text-xs text-ink-secondary max-w-sm text-left">
        <p className="font-medium text-ink">Próximos pasos:</p>
        <ul className="mt-1 list-disc list-inside space-y-1">
          <li>Revisa tu correo electrónico para confirmar el enlace de activación si aplica.</li>
          <li>Comunícate con el Secretario de tu taller para la habilitación de permisos.</li>
        </ul>
      </div>

      <Link
        to="/login"
        className="mt-8 flex min-h-[44px] w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-pressed"
      >
        Ir a Iniciar Sesión
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
