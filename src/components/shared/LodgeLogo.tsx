interface LodgeLogoProps {
  className?: string;
}

export function LodgeLogo({ className = '' }: LodgeLogoProps) {
  return (
    <img
      src="/logo-uf21.png"
      alt="Escudo oficial de la Resp.·. Log.·. Unión Fraternal No. 21"
      className={`block object-contain ${className}`}
    />
  );
}
