import { useEffect, useState } from 'react';
import { Phone, Save } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { useAuth } from '@/hooks/useAuth';
import { memberService } from '@/services/memberService';
import { panamaPhoneCountry, phoneCountries } from '@/data/phoneCountries';
import { PhoneCountrySelect } from '@/components/shared/PhoneCountrySelect';
import { toast } from 'sonner';

export function PhoneCaptureModal() {
  const { user, refreshUser } = useAuth();
  const [needsPhone, setNeedsPhone] = useState(false);
  const [countryCode, setCountryCode] = useState(panamaPhoneCountry.code);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadMember = async () => {
      if (!user?.memberId) {
        setIsLoading(false);
        return;
      }
      try {
        const member = await memberService.getMemberById(user.memberId);
        if (!cancelled) setNeedsPhone(!member?.phone?.trim());
      } catch (error) {
        console.error('No se pudo revisar el teléfono del usuario:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void loadMember();
    return () => { cancelled = true; };
  }, [user?.memberId]);

  const handleSave = async () => {
    if (!user?.memberId) return;
    const country = phoneCountries.find((item) => item.code === countryCode) || panamaPhoneCountry;
    if (!/^\d{6,15}$/.test(phoneNumber)) {
      toast.error('Ingresa entre 6 y 15 dígitos para tu teléfono.');
      return;
    }
    setIsSaving(true);
    try {
      await memberService.updateOwnPhone(user.memberId, `${country.dialCode}${phoneNumber}`);
      setNeedsPhone(false);
      await refreshUser();
      toast.success('Teléfono guardado correctamente.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el teléfono.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !needsPhone) return null;

  return (
    <Modal isOpen onClose={() => undefined} title="Completa tu teléfono" subtitle="Este dato es necesario para confirmar tu identidad con Secretaría." maxWidth="md">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <Phone className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Registra el celular que tienes informado en Secretaría. No podrás continuar hasta completar este dato.</p>
        </div>
        <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-2">
          <PhoneCountrySelect value={countryCode} onChange={setCountryCode} />
          <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, '').slice(0, 15))} inputMode="numeric" placeholder="61234567" className="min-h-[46px] rounded-xl border border-border bg-surface px-3.5 text-base text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary/15" />
        </div>
        <button type="button" onClick={() => void handleSave()} disabled={isSaving} className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-pressed disabled:opacity-60">
          <Save className="h-4 w-4" /> {isSaving ? 'Guardando…' : 'Guardar teléfono'}
        </button>
      </div>
    </Modal>
  );
}
