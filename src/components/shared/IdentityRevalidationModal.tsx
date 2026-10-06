import { useEffect, useState } from 'react';
import { Camera, Loader2, ShieldAlert } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { CameraCapture } from '@/components/shared/CameraCapture';
import { useAuth } from '@/hooks/useAuth';
import { memberService } from '@/services/memberService';
import type { BiometricValidationResult } from '@/services/identityService';
import type { Member } from '@/types';
import { toast } from 'sonner';

export function IdentityRevalidationModal() {
  const { user, refreshUser } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadIdentity = async () => {
      if (!user?.memberId) {
        setIsLoading(false);
        return;
      }

      try {
        const currentMember = await memberService.getMemberById(user.memberId);
        if (!cancelled) setMember(currentMember || null);
      } catch (error) {
        console.error('Error cargando estado de identidad:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadIdentity();
    return () => {
      cancelled = true;
    };
  }, [user?.memberId]);

  const needsSelfie = Boolean(member && (!member.selfieUrl || member.identityStatus === 'rejected'));

  const handleValidated = async (result: BiometricValidationResult) => {
    if (!user?.memberId || result.status === 'rejected' || !result.selfieUrl) return;

    setIsSaving(true);
    try {
      await memberService.saveRegistrationIdentity(user.memberId, {
        identityVerified: result.status === 'approved',
        identityStatus: result.status === 'approved' ? 'verified' : 'pending',
        selfieUrl: result.selfieUrl,
        identityValidatedAt: new Date().toISOString(),
      });
      await refreshUser();
      setMember((current) => current ? {
        ...current,
        selfieUrl: result.selfieUrl,
        identityStatus: result.status === 'approved' ? 'verified' : 'pending',
        identityVerified: result.status === 'approved',
      } : current);
      toast.success('Selfie guardada correctamente.');
    } catch (error) {
      console.error('Error guardando nueva selfie:', error);
      toast.error('No se pudo guardar la selfie. Inténtalo nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !needsSelfie) return null;

  return (
    <Modal
      isOpen
      onClose={() => undefined}
      title="Nueva selfie requerida"
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Secretaría solicitó una nueva selfie. Debes completar esta captura para actualizar tu registro de identidad.
          </p>
        </div>
        {isSaving ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-ink-secondary">Guardando tu selfie en Supabase…</p>
          </div>
        ) : (
          <CameraCapture onValidated={handleValidated} />
        )}
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-muted">
          <Camera className="h-3.5 w-3.5" /> La captura se guarda en tu ficha de miembro.
        </p>
      </div>
    </Modal>
  );
}
