import React, { useState, useEffect } from 'react';
import { getSelectedLodgeIcon, getLodgeIconPath, LodgeIconOption } from '@/services/pwaIconService';

interface LodgeLogoProps {
  className?: string;
  variant?: LodgeIconOption | 'selected';
}

export function LodgeLogo({ className = '', variant = 'selected' }: LodgeLogoProps) {
  const [selectedIcon, setSelectedIcon] = useState<LodgeIconOption>(getSelectedLodgeIcon());

  useEffect(() => {
    const handleIconChange = (e: any) => {
      setSelectedIcon(e.detail || getSelectedLodgeIcon());
    };
    window.addEventListener('lodge-icon-changed', handleIconChange);
    return () => window.removeEventListener('lodge-icon-changed', handleIconChange);
  }, []);

  const imageSrc = variant === 'selected' ? getLodgeIconPath(selectedIcon) : getLodgeIconPath(variant);

  return (
    <img
      src={imageSrc}
      alt="Escudo oficial de la Resp.·. Log.·. Unión Fraternal No. 21"
      className={`block object-contain rounded-lg ${className}`}
    />
  );
}
