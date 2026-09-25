import { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, AlertCircle, Loader2, ShieldCheck, Sun } from 'lucide-react';
import { identityService, type BiometricValidationResult } from '@/services/identityService';

export type CameraStatus =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'captured'
  | 'validating'
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'denied'
  | 'unavailable';

interface CameraCaptureProps {
  onValidated?: (result: BiometricValidationResult) => void;
}

export function CameraCapture({ onValidated }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<CameraStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [consentGiven, setConsentGiven] = useState<boolean>(true);
  const [validationResult, setValidationResult] = useState<BiometricValidationResult | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('unavailable');
      setErrorMessage('Tu navegador o dispositivo no admite acceso a la cámara frontal.');
      return;
    }

    setStatus('requesting');
    setErrorMessage('');

    try {
      // Obligatorio: Cámara frontal facingMode: "user"
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setStatus('active');
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setStatus('denied');
        setErrorMessage('El permiso para usar la cámara frontal fue rechazado.');
      } else {
        setStatus('unavailable');
        setErrorMessage('No se encontró una cámara frontal disponible o está en uso por otra app.');
      }
    }
  }, []);

  const captureAndValidate = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (!consentGiven) {
      setErrorMessage('Debes aceptar el consentimiento de tratamiento biométrico según la Ley 81.');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;

    // Tomar fotograma 1
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame1 = ctx.getImageData(0, 0, canvas.width, canvas.height);

    setStatus('validating');

    // Pausa breve para capturar micro-movimiento o parpadeo del usuario
    await new Promise((resolve) => setTimeout(resolve, 350));

    // Tomar fotograma 2
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame2 = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const selfieDataUrl = canvas.toDataURL('image/jpeg', 0.85);

    // Detener la cámara inmediatamente para no mantener streaming
    stopCamera();

    // Validar liveness y políticas de identidad
    const result = await identityService.validateSelfie(frame1, frame2, consentGiven);
    result.selfieUrl = selfieDataUrl;
    setValidationResult(result);

    if (result.status === 'approved') {
      setStatus('approved');
    } else if (result.status === 'pending') {
      // Estado honesto si el proveedor no está configurado
      setStatus('pending');
    } else {
      setStatus('rejected');
      setErrorMessage(result.message);
    }

    if (onValidated) {
      onValidated(result);
    }
  }, [consentGiven, stopCamera, onValidated]);

  const reset = useCallback(() => {
    stopCamera();
    setStatus('idle');
    setErrorMessage('');
    setValidationResult(null);
  }, [stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto">
      {/* Marco de Captura de Cámara */}
      <div className="relative aspect-square w-full max-w-[280px] sm:max-w-xs overflow-hidden rounded-2xl border-2 border-border bg-surface shadow-card flex items-center justify-center">
        {/* Streaming en vivo (únicamente cámara frontal activa) */}
        {(status === 'active' || status === 'requesting') && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
        )}

        {/* Guía facial ovalada */}
        {(status === 'active' || status === 'requesting') && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="h-48 w-36 sm:h-52 sm:w-40 rounded-[50%] border-2 border-dashed border-gold/90 shadow-[0_0_0_9999px_rgba(30,30,36,0.35)]" />
            <span className="mt-2 text-xs font-medium text-white drop-shadow">Alinea tu rostro</span>
          </div>
        )}

        {/* Estado Idle */}
        {status === 'idle' && (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-ink-muted">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
              <Camera className="h-8 w-8 text-primary" />
            </div>
            <p className="text-xs text-ink-secondary">
              Se activará la cámara frontal para comprobación de presencia real.
            </p>
          </div>
        )}

        {/* Solicitando Permiso */}
        {status === 'requesting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/90 p-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-ink">Iniciando cámara frontal…</p>
            <p className="text-xs text-ink-muted">Por favor autoriza el permiso en tu navegador.</p>
          </div>
        )}

        {/* Validando Liveness */}
        {status === 'validating' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/95 p-4 text-center">
            <Loader2 className="h-9 w-9 animate-spin text-gold" />
            <p className="text-sm font-medium text-ink">Comprobando presencia facial…</p>
            <p className="text-xs text-ink-muted">Analizando iluminación y micro-movimiento.</p>
          </div>
        )}

        {/* Aprobado (Solo si proveedor externo dio visto bueno) */}
        {status === 'approved' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-success/15 p-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success text-white shadow-md">
              <Check className="h-8 w-8" />
            </div>
            <p className="text-base font-serif font-semibold text-success">Identidad Verificada</p>
            <p className="text-xs text-ink-secondary">Verificación biométrica aprobada con éxito.</p>
          </div>
        )}

        {/* Validación Pendiente (Proveedor externo no configurado) */}
        {status === 'pending' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-amber-500/10 p-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-md">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <p className="text-base font-serif font-semibold text-amber-800">Validación Pendiente</p>
            <p className="text-xs text-ink-secondary px-2">
              Presencia facial comprobada. La cuenta queda sujeta a confirmación por el Secretario.
            </p>
          </div>
        )}

        {/* Rechazado / Fallo de Liveness */}
        {status === 'rejected' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-destructive/15 p-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-white shadow-md">
              <X className="h-8 w-8" />
            </div>
            <p className="text-base font-serif font-semibold text-destructive">No se pudo verificar</p>
            <p className="text-xs text-destructive px-2">{errorMessage || 'Comprobación no superada.'}</p>
          </div>
        )}

        {/* Permiso Denegado / Cámara no disponible */}
        {(status === 'denied' || status === 'unavailable') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface p-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-xs text-destructive">{errorMessage}</p>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Requisitos de iluminación y postura */}
      {(status === 'idle' || status === 'active' || status === 'requesting') && (
        <div className="mt-4 w-full rounded-lg bg-surface border border-border p-3 text-xs text-ink-secondary space-y-1.5">
          <div className="flex items-center gap-2 font-medium text-ink">
            <Sun className="h-4 w-4 text-gold" />
            Requisitos de captura:
          </div>
          <p>• Ubícate de frente con buena iluminación natural o artificial.</p>
          <p>• No uses lentes de sol, gorras ni prendas que cubran el rostro.</p>
          <p>• Mantén una expresión neutral y mira hacia la cámara frontal.</p>
        </div>
      )}

      {/* Acciones de control */}
      <div className="mt-6 flex w-full flex-col gap-2.5">
        {status === 'idle' && (
          <button
            type="button"
            onClick={startCamera}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-pressed cursor-pointer active:scale-95"
          >
            <Camera className="h-5 w-5" />
            Activar cámara frontal
          </button>
        )}

        {status === 'active' && (
          <button
            type="button"
            onClick={captureAndValidate}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-pressed cursor-pointer"
          >
            <Camera className="h-5 w-5" />
            Tomar selfie y verificar
          </button>
        )}

        {(status === 'rejected' || status === 'denied' || status === 'unavailable') && (
          <button
            type="button"
            onClick={reset}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-container cursor-pointer"
          >
            <RefreshCw className="h-5 w-5" />
            Reintentar selfie
          </button>
        )}

        {(status === 'approved' || status === 'pending') && (
          <div className="w-full text-center py-2 text-xs text-ink-secondary">
            {validationResult?.message}
          </div>
        )}
      </div>
    </div>
  );
}
