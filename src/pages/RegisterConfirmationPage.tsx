import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Clock, ArrowRight } from 'lucide-react';
import { officialVisitService } from '@/services/officialVisitService';
import { convocationService } from '@/services/convocationService';

export function RegisterConfirmationPage() {
  const [status, setStatus] = useState<string>('pending');
  const [contact, setContact] = useState({ name: 'Alexis Castillo Gaona', phone: '+50767471286' });

  useEffect(() => {
    const s = sessionStorage.getItem('logia_reg_result_status') || 'pending';
    setStatus(s);
    void officialVisitService.getRegistrationContact().then(setContact);
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

      <p className="mt-3 max-w-md text-sm text-ink-secondary leading-relaxed">
        {isApproved
          ? 'Tu cuenta ha sido confirmada y tu identidad ha sido verificada. Ya puedes ingresar al portal de la logia.'
          : (
            <>
              <span>Revisión de solicitud. El administrador revisará su solicitud y le otorgará el grado masónico correspondiente. Puede contactar al Secretario del Taller por WhatsApp para agilizar el proceso. Verificación de identidad.</span>
              <span className="mt-4 block">Para evitar la suplantación de identidad, confirmaremos su solicitud con el celular que tenga registrado en Secretaría.</span>
            </>
          )}
      </p>
      {!isApproved && (
        <div className="mt-4 w-full max-w-md rounded-xl border border-border bg-surface p-4 text-left text-sm">
          <p className="font-semibold text-ink">Secretario del Taller</p>
          <p className="mt-1 text-ink-secondary">{contact.name}</p>
          <p className="text-ink-secondary">{contact.phone}</p>
          <a href={convocationService.generateWhatsAppUrl(contact.phone, 'Hola Alexis, acabo de enviar mi solicitud de ingreso a la Logia UF No. 21.')} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-[40px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700">Contactar por WhatsApp</a>
        </div>
      )}

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
