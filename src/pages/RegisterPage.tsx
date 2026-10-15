import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { User, Mail, Lock, Phone, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { LodgeLogo } from '@/components/shared/LodgeLogo';
import { useAppleDialog } from '@/components/shared/AppleDialog';
import { useAuth } from '@/hooks/useAuth';
import { panamaPhoneCountry, phoneCountries } from '@/data/phoneCountries';

const registerSchema = z.object({
  firstName: z.string().min(2, 'Ingresa tus nombres completos'),
  lastName: z.string().min(2, 'Ingresa tus apellidos'),
  email: z.string().email('Ingresa un correo electrónico válido'),
  phoneCountryCode: z.string().min(1, 'Selecciona el país'),
  phoneNumber: z.string().regex(/^\d{6,15}$/, 'Ingresa entre 6 y 15 dígitos'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string().min(6, 'Confirma tu contraseña'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerAccount, login } = useAuth();
  const { showAlert } = useAppleDialog();
  const [showPasswords, setShowPasswords] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { phoneCountryCode: panamaPhoneCountry.code },
  });

  const onError = (formErrors: FieldErrors<RegisterFormValues>) => {
    const firstError = Object.values(formErrors)[0];
    if (firstError?.message) showAlert({ title: 'Verifica los Datos Ingresados', message: firstError.message, type: 'warning', confirmText: 'Entendido' });
  };

  const onSubmit = async (values: RegisterFormValues) => {
    const country = phoneCountries.find((item) => item.code === values.phoneCountryCode) || panamaPhoneCountry;
    const phone = `${country.dialCode}${values.phoneNumber}`;
    try {
      const user = await registerAccount(values.email, values.password, values.firstName, values.lastName, undefined, phone);
      if (!user.isAuthenticated) await login(values.email, values.password);
      sessionStorage.setItem('logia_reg_result_status', 'pending');
      navigate('/registro/confirmacion', { replace: true });
    } catch (error) {
      showAlert({ title: 'No se pudo completar el registro', message: error instanceof Error ? error.message : 'Inténtalo nuevamente.', type: 'warning', confirmText: 'Entendido' });
    }
  };

  const inputClass = 'min-h-[46px] rounded-xl border border-border bg-surface px-3.5 text-base sm:text-sm text-ink shadow-2xs outline-none focus:border-primary focus:ring-3 focus:ring-primary/15 transition-all';

  return (
    <div className="w-full">
      <div className="flex flex-col items-center text-center">
        <LodgeLogo className="mx-auto mb-6 h-24 w-24" />
        <h1 className="font-serif text-3xl text-ink">Crear Cuenta</h1>
        <p className="mt-1 text-sm text-ink-secondary">Ingresa tus datos para enviar tu solicitud. La identidad quedará pendiente de revisión por Secretaría.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit, onError)} noValidate className="mt-6 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(['firstName', 'lastName'] as const).map((field) => (
            <div key={field} className="flex flex-col gap-1.5">
              <label htmlFor={field} className="text-sm font-medium text-ink flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-ink-muted" /> {field === 'firstName' ? 'Nombres' : 'Apellidos'}</label>
              <input id={field} {...register(field)} placeholder={field === 'firstName' ? 'Ej. Juan Carlos' : 'Ej. Pérez González'} className={inputClass} />
              {errors[field] && <p className="text-xs text-destructive">{errors[field]?.message}</p>}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-ink flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-ink-muted" /> Correo electrónico</label>
          <input id="email" type="email" autoComplete="email" {...register('email')} placeholder="hermano@correo.org" className={inputClass} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="phoneNumber" className="text-sm font-medium text-ink flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-ink-muted" /> Teléfono de contacto</label>
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-2">
            <select {...register('phoneCountryCode')} aria-label="País del teléfono" className="min-h-[46px] rounded-xl border border-border bg-surface px-2 text-sm text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary/15">
              {phoneCountries.map((country) => <option key={country.code} value={country.code}>{country.flag} {country.name} ({country.dialCode})</option>)}
            </select>
            <input id="phoneNumber" type="text" inputMode="numeric" autoComplete="tel-national" {...register('phoneNumber', { onChange: (event) => setValue('phoneNumber', event.target.value.replace(/\D/g, '').slice(0, 15)) })} placeholder="61234567" className={inputClass} />
          </div>
          {errors.phoneNumber && <p className="text-xs text-destructive">{errors.phoneNumber.message}</p>}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(['password', 'confirmPassword'] as const).map((field) => (
            <div key={field} className="flex flex-col gap-1.5">
              <label htmlFor={field} className="text-sm font-medium text-ink flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-ink-muted" /> {field === 'password' ? 'Contraseña' : 'Confirmar'}</label>
              <input id={field} type={showPasswords ? 'text' : 'password'} autoComplete="new-password" {...register(field)} placeholder="••••••••" className={inputClass} />
              {errors[field] && <p className="text-xs text-destructive">{errors[field]?.message}</p>}
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="self-end inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary-pressed py-1">{showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}</button>
        <button type="submit" disabled={isSubmitting} className="mt-2 flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary-pressed disabled:opacity-60">Enviar solicitud <ArrowRight className="h-4 w-4" /></button>
      </form>
      <div className="mt-8 flex flex-col items-center gap-3 border-t border-border pt-6 text-sm"><Link to="/login" className="font-medium text-primary hover:underline">¿Ya tienes cuenta activa? Iniciar sesión</Link></div>
    </div>
  );
}
