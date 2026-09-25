import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraCapture } from '@/components/shared/CameraCapture';
import { authService } from '@/services/authService';
import { useAuth } from '@/hooks/useAuth';
import type { BiometricValidationResult } from '@/services/identityService';
import { memberService } from '@/services/memberService';
import { Shield, AlertCircle, Loader2 } from 'lucide-react';

interface PendingRegistration {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  invitationCode?: string;
}

export function RegisterIdentityPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [pendingData, setPendingData] = useState<PendingRegistration | null>(null);
  const [registrationError, setRegistrationError] = useState<string>('');
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('logia_reg_pending');
    if (!raw) {
      navigate('/registro', { replace: true });
      return;
    }
    try {
      setPendingData(JSON.parse(raw));
    } catch {
      navigate('/registro', { replace: true });
    }
  }, [navigate]);

  const handleValidated = async (result: BiometricValidationResult) => {
    if (!pendingData) return;
    if (result.status === 'rejected') return;

    setIsFinalizing(true);
    setRegistrationError('');

    try {
      // 1. Crear el usuario en el sistema de autenticación
      await authService.register(
        pendingData.email,
        pendingData.password,
        pendingData.firstName,
        pendingData.lastName,
        pendingData.invitationCode
      );

      // 2. Registrar la ficha del hermano con su selfie biométrica para revisión
      const identityStatus = result.status === 'approved' ? 'verified' : 'pending';
      try {
        await memberService.saveMember(
          {
            firstName: pendingData.firstName,
            lastName: pendingData.lastName,
            email: pendingData.email,
            roleId: 'her',
            degree: 'aprendiz',
            condition: 'activo',
            motherLodge: 'Resp.·. Log.·. Unión Fraternal No. 21',
            isActive: true,
            identityVerified: identityStatus === 'verified',
            identityStatus,
            selfieUrl: result.selfieUrl,
            identityValidatedAt: new Date().toISOString(),
          },
          { email: pendingData.email }
        );
      } catch (saveErr) {
        console.warn('Error al guardar ficha de miembro con selfie:', saveErr);
      }

      // 3. Iniciar sesión automáticamente
      await login(pendingData.email, pendingData.password);

      // 4. Limpiar datos temporales
      sessionStorage.removeItem('logia_reg_pending');

      // 5. Redirigir de inmediato al interior de la aplicación
      navigate('/app', { replace: true });
    } catch (err: unknown) {
      setRegistrationError(err instanceof Error ? err.message : 'Error al completar el registro.');
      setIsFinalizing(false);
    }
  };

  if (!pendingData) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs text-ink-muted">Paso 2 de 2</span>
        <div className="flex items-center gap-1 text-xs text-primary font-medium">
          <Shield className="h-3.5 w-3.5" />
          Seguridad Biométrica
        </div>
      </div>

      <div className="flex flex-col items-center text-center">
        <h1 className="font-serif text-3xl text-ink">Comprobación Facial</h1>
        <p className="mt-1 text-sm text-ink-secondary max-w-md">
          Hola, <strong>{pendingData.firstName}</strong>. Para prevenir usurpaciones de identidad en este ambiente de logia virtual, Tómate una selfie para verificar tu pertenencia a la logia y acceder directamente.
        </p>
      </div>

      {registrationError && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{registrationError}</span>
        </div>
      )}

      {isFinalizing && (
        <div className="mt-6 flex flex-col items-center justify-center p-8 text-center">
          <Loader2 className="h-9 w-9 animate-spin text-primary" />
          <p className="mt-4 text-sm font-semibold text-ink">Comprobación exitosa</p>
          <p className="text-xs text-ink-secondary">Iniciando sesión en la logia…</p>
        </div>
      )}

      {!isFinalizing && (
        <div className="mt-6">
          <CameraCapture onValidated={handleValidated} />
        </div>
      )}
    </div>
  );
}
