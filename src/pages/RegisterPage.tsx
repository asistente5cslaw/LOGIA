import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { User, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { LodgeLogo } from '@/components/shared/LodgeLogo';

const registerSchema = z
  .object({
    firstName: z.string().min(2, 'Ingresa tus nombres completos'),
    lastName: z.string().min(2, 'Ingresa tus apellidos'),
    email: z.string().email('Ingresa un correo electrónico válido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    confirmPassword: z.string().min(6, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

import { useAppleDialog } from '@/components/shared/AppleDialog';

export function RegisterPage() {
  const navigate = useNavigate();
  const { showAlert } = useAppleDialog();
  const [showPasswords, setShowPasswords] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onError = (formErrors: any) => {
    const firstError = Object.values(formErrors)[0] as any;
    if (firstError?.message) {
      showAlert({
        title: 'Verifica los Datos Ingresados',
        message: firstError.message,
        type: 'warning',
        confirmText: 'Entendido',
      });
    }
  };

  const onSubmit = (values: RegisterFormValues) => {
    // Guardar temporalmente en sessionStorage para la validación con selfie
    sessionStorage.setItem(
      'logia_reg_pending',
      JSON.stringify({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        password: values.password,
      })
    );
    navigate('/registro/identidad');
  };

  return (
    <div className="w-full">
      <div className="flex flex-col items-center text-center">
        <LodgeLogo className="mx-auto mb-6 h-24 w-24" />
        <h1 className="font-serif text-3xl text-ink">Crear Cuenta</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Ingresa tus datos personales para registrarte. Luego realizaremos la validación de identidad con selfie.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onError)} noValidate className="mt-6 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="firstName" className="text-sm font-medium text-ink flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-ink-muted" /> Nombres
            </label>
            <input
              id="firstName"
              {...register('firstName')}
              placeholder="Ej. Juan Carlos"
              className="min-h-[44px] rounded-lg border border-border bg-surface px-3 text-sm text-ink shadow-card outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            {errors.firstName && (
              <p className="text-xs text-destructive">{errors.firstName.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="lastName" className="text-sm font-medium text-ink flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-ink-muted" /> Apellidos
            </label>
            <input
              id="lastName"
              {...register('lastName')}
              placeholder="Ej. Pérez González"
              className="min-h-[44px] rounded-lg border border-border bg-surface px-3 text-sm text-ink shadow-card outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            {errors.lastName && (
              <p className="text-xs text-destructive">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-ink flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-ink-muted" /> Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            placeholder="hermano@correo.org"
            className="min-h-[44px] rounded-lg border border-border bg-surface px-3 text-sm text-ink shadow-card outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Campo Contraseña */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-ink flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-ink-muted" /> Contraseña
              </label>
              <input
                id="password"
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('password')}
                placeholder="••••••••"
                className="min-h-[44px] w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink shadow-card outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {/* Campo Confirmar Contraseña */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-ink flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-ink-muted" /> Confirmar
              </label>
              <input
                id="confirmPassword"
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('confirmPassword')}
                placeholder="••••••••"
                className="min-h-[44px] w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink shadow-card outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          {/* Un solo botón para mostrar u ocultar ambas contraseñas */}
          <div className="flex justify-end pt-0.5">
            <button
              type="button"
              onClick={() => setShowPasswords(!showPasswords)}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary-pressed transition-colors cursor-pointer"
            >
              {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span>{showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}</span>
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-pressed disabled:opacity-60 cursor-pointer"
        >
          Continuar a Validación Facial (Selfie)
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      <div className="mt-8 flex flex-col items-center gap-3 border-t border-border pt-6 text-sm">
        <Link to="/login" className="font-medium text-primary hover:underline">
          ¿Ya tienes cuenta activa? Iniciar sesión
        </Link>
      </div>
    </div>
  );
}
