import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Loader, X, Navigation, Layers, ZoomIn, ZoomOut, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LocationCoords {
  lat: number;
  lng: number;
}

export interface GoogleMapsLocationPickerProps {
  label?: string;
  required?: boolean;
  value: string;
  latitude?: number | null;
  longitude?: number | null;
  onChange: (address: string, coords?: LocationCoords, placeName?: string) => void;
  placeholder?: string;
  hideSearchInput?: boolean;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

const DEFAULT_KEY = 'AIzaSyBYMOjwcvEAlvBylxBm1rdNyRtgA8rIxk4';
const DEFAULT_CENTER = { lat: 8.985099335363468, lng: -79.51736755768471 }; // Panamá

// 🛠️ Hook oficial de TaskLoop para cargar Google Maps API con places
export function useGoogleMapsLoader() {
  const [googleLoaded, setGoogleLoaded] = useState(() => {
    return !!(typeof window !== 'undefined' && window.google?.maps?.places);
  });

  useEffect(() => {
    const id = 'google-maps-script';

    if (window.google?.maps?.places) {
      setGoogleLoaded(true);
      return;
    }

    let script = document.getElementById(id) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = id;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${DEFAULT_KEY}&libraries=places&callback=initMap&v=weekly`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    window.initMap = () => {
      setGoogleLoaded(true);
    };

    const checkInterval = setInterval(() => {
      if (window.google?.maps?.places) {
        setGoogleLoaded(true);
        clearInterval(checkInterval);
      }
    }, 250);

    return () => clearInterval(checkInterval);
  }, []);

  return googleLoaded;
}

export const GoogleMapsLocationPicker = React.memo(function GoogleMapsLocationPicker({
  label = 'Lugar del Templo / Encuentro',
  required = false,
  value,
  latitude,
  longitude,
  onChange,
  placeholder = 'Busca cualquier ubicación en Google Maps (Ej: Hotel El Panamá, Costa del Este, Bella Vista)...',
  hideSearchInput = false,
}: GoogleMapsLocationPickerProps) {
  const googleLoaded = useGoogleMapsLoader();
  const [searchQuery, setSearchQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');

  const [selectedLocation, setSelectedLocation] = useState<{ address: string; lat: number; lng: number } | null>(
    latitude && longitude ? { address: value || '', lat: latitude, lng: longitude } : null
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);
  const autocompleteService = useRef<any>(null);
  const geocoder = useRef<any>(null);

  // Inicializar AutocompleteService y Geocoder
  useEffect(() => {
    if (googleLoaded && window.google?.maps) {
      if (!autocompleteService.current && window.google.maps.places) {
        autocompleteService.current = new window.google.maps.places.AutocompleteService();
      }
      if (!geocoder.current) {
        geocoder.current = new window.google.maps.Geocoder();
      }
    }
  }, [googleLoaded]);

  // Inicializar Mapa
  useEffect(() => {
    if (!googleLoaded || !mapRef.current || !window.google?.maps) return;

    try {
      const initialCenter = selectedLocation
        ? { lat: selectedLocation.lat, lng: selectedLocation.lng }
        : DEFAULT_CENTER;

      if (!mapInstance.current) {
        mapInstance.current = new window.google.maps.Map(mapRef.current, {
          center: initialCenter,
          zoom: selectedLocation ? 17 : 13,
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeId: mapType,
          styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'on' }] },
            { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          ],
        });

        mapInstance.current.addListener('click', (e: any) => {
          if (e.latLng) {
            reverseGeocode(e.latLng.lat(), e.latLng.lng());
          }
        });

        if (selectedLocation) {
          addMarker(selectedLocation.lat, selectedLocation.lng);
        }
      }
    } catch (err) {
      console.error('Error initializing Google Maps:', err);
    }
  }, [googleLoaded]);

  // Sincronizar cambios de props externos
  useEffect(() => {
    if (value && value !== searchQuery) {
      setSearchQuery(value);
    }
    if (latitude && longitude) {
      setSelectedLocation({ address: value || '', lat: latitude, lng: longitude });
      if (mapInstance.current) {
        mapInstance.current.panTo({ lat: latitude, lng: longitude });
        mapInstance.current.setZoom(17);
        addMarker(latitude, longitude);
      }
    }
  }, [value, latitude, longitude]);

  // Cerrar lista al hacer click afuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addMarker = (lat: number, lng: number) => {
    const google = window.google;
    if (!google || !mapInstance.current) return;

    if (markerInstance.current) markerInstance.current.setMap(null);

    markerInstance.current = new google.maps.Marker({
      position: { lat, lng },
      map: mapInstance.current,
      draggable: true,
      animation: google.maps.Animation.DROP,
    });

    markerInstance.current.addListener('dragend', (e: any) => {
      reverseGeocode(e.latLng.lat(), e.latLng.lng());
    });
  };

  const reverseGeocode = (lat: number, lng: number) => {
    if (!geocoder.current && window.google?.maps) {
      geocoder.current = new window.google.maps.Geocoder();
    }
    if (!geocoder.current) return;

    geocoder.current.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
      if (status === 'OK' && results && results[0]) {
        updateLocation(results[0].formatted_address, lat, lng, false);
      }
    });
  };

  const updateLocation = (
    addr: string,
    lat: number,
    lng: number,
    updateMap: boolean,
    placeName?: string
  ) => {
    setSelectedLocation({ address: addr, lat, lng });
    const finalName = placeName || addr;
    setSearchQuery(finalName);
    onChange(finalName, { lat, lng }, placeName);
    setSuggestions([]);
    setShowSuggestions(false);

    if (updateMap && mapInstance.current) {
      mapInstance.current.panTo({ lat, lng });
      mapInstance.current.setZoom(17);
    }

    addMarker(lat, lng);
  };

  // Buscar directamente en toda la base de Google Maps (sin restricciones bloqueantes)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    onChange(val, selectedLocation ? { lat: selectedLocation.lat, lng: selectedLocation.lng } : undefined);

    if (!autocompleteService.current && window.google?.maps?.places) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
    }

    if (val.trim().length > 1 && autocompleteService.current) {
      setIsSearching(true);
      autocompleteService.current.getPlacePredictions(
        {
          input: val,
          componentRestrictions: { country: 'pa' },
        },
        (predictions: any[], status: any) => {
          setIsSearching(false);
          if (status === 'OK' && predictions && predictions.length > 0) {
            setSuggestions(predictions);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
          }
        }
      );
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
    }
  };

  const handleSuggestionClick = (prediction: any) => {
    if (!geocoder.current && window.google?.maps) {
      geocoder.current = new window.google.maps.Geocoder();
    }
    if (!geocoder.current) return;

    const mainText = prediction.structured_formatting?.main_text || prediction.description;

    geocoder.current.geocode({ placeId: prediction.place_id }, (results: any[], status: string) => {
      if (status === 'OK' && results && results[0]) {
        const { lat, lng } = results[0].geometry.location;
        const addr = results[0].formatted_address;
        updateLocation(addr, typeof lat === 'function' ? lat() : lat, typeof lng === 'function' ? lng() : lng, true, mainText);
      }
    });
  };

  const handleZoomIn = () => {
    if (mapInstance.current) {
      const currentZoom = mapInstance.current.getZoom() || 16;
      mapInstance.current.setZoom(currentZoom + 1);
    }
  };

  const handleZoomOut = () => {
    if (mapInstance.current) {
      const currentZoom = mapInstance.current.getZoom() || 16;
      mapInstance.current.setZoom(currentZoom - 1);
    }
  };

  const handleToggleMapType = () => {
    const nextType = mapType === 'roadmap' ? 'satellite' : 'roadmap';
    setMapType(nextType);
    if (mapInstance.current) {
      mapInstance.current.setMapTypeId(nextType);
    }
  };

  const handleRecenter = () => {
    if (mapInstance.current) {
      const center = selectedLocation || DEFAULT_CENTER;
      mapInstance.current.panTo(center);
      mapInstance.current.setZoom(17);
      addMarker(center.lat, center.lng);
    }
  };

  return (
    <div ref={containerRef} className="space-y-2.5 text-left">
      {/* Etiqueta */}
      {label && (
        <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span>{label}</span>
          {required && <span className="text-destructive">*</span>}
        </label>
      )}

      {/* Buscador de Cualquier Lugar en Google Maps */}
      {!hideSearchInput && (
        <div className={`relative ${showSuggestions ? 'z-[1000]' : 'z-0'}`}>
          <div className="relative flex items-center group">
            <div className="absolute left-3 text-ink-muted group-focus-within:text-primary transition-colors pointer-events-none">
              {isSearching ? (
                <Loader size={16} className="animate-spin text-primary" />
              ) : (
                <Search size={16} />
              )}
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder={placeholder}
              className="w-full pl-9 pr-9 h-11 bg-white border border-border rounded-xl text-xs sm:text-sm focus:ring-3 focus:ring-primary/15 focus:border-primary outline-none transition-all font-medium text-ink placeholder:text-ink-muted/60 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedLocation(null);
                  setSuggestions([]);
                  setShowSuggestions(false);
                  if (markerInstance.current) markerInstance.current.setMap(null);
                  onChange('', undefined);
                }}
                className="absolute right-2.5 p-1 text-ink-muted hover:text-ink rounded-full hover:bg-surface-container transition-colors cursor-pointer"
                title="Borrar ubicación"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Lista de Sugerencias en Vivo de Google Maps */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-[1010] left-0 right-0 mt-1.5 bg-white border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 max-h-64 overflow-y-auto p-1.5 divide-y divide-border/40">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted flex items-center justify-between">
                <span>Resultados de Google Maps</span>
                <span className="text-[9px] text-primary font-semibold">Google Places</span>
              </div>
              {suggestions.map((prediction) => {
                const mainText =
                  prediction.structured_formatting?.main_text ||
                  prediction.description;
                const secondaryText =
                  prediction.structured_formatting?.secondary_text || '';

                return (
                  <button
                    key={prediction.place_id}
                    type="button"
                    onClick={() => handleSuggestionClick(prediction)}
                    className="w-full px-3 py-2.5 text-left hover:bg-primary/5 flex items-start gap-2.5 rounded-xl transition-colors group cursor-pointer"
                  >
                    <div className="mt-0.5 p-1.5 bg-surface-container rounded-lg group-hover:bg-primary group-hover:text-white text-ink-muted transition-colors shrink-0">
                      <MapPin size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-ink truncate group-hover:text-primary transition-colors">
                        {mainText}
                      </p>
                      {secondaryText && (
                        <p className="text-[11px] text-ink-muted truncate mt-0.5">
                          {secondaryText}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Contenedor del Mapa Interactivo */}
      <div className="rounded-2xl border border-border/80 bg-surface-container-low/40 p-2.5 space-y-2 shadow-2xs">
        <div className="flex items-center justify-between text-xs font-semibold px-0.5">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-ink">
            <Navigation className="h-3.5 w-3.5 text-primary" />
            Visor del Mapa
          </span>
          {selectedLocation && (
            <span className="text-[10px] text-ink-muted font-mono">
              {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
            </span>
          )}
        </div>

        <div className="h-48 sm:h-56 rounded-xl overflow-hidden border border-border relative bg-slate-100 shadow-inner z-0 [&_.gm-style-cc]:!hidden [&_.gmnoprint]:!hidden [&_a[href*='maps']]:!hidden [&_.gm-style_a]:!hidden">
          {!googleLoaded ? (
            <div className="h-full w-full flex flex-col items-center justify-center bg-surface-container-low">
              <Loader className="animate-spin text-primary mb-2" size={24} />
              <p className="text-xs text-ink-muted font-medium">Cargando Google Maps...</p>
            </div>
          ) : (
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          )}

          {/* Controles Flotantes del Mapa */}
          {googleLoaded && (
            <div className="absolute right-2.5 top-2.5 z-20 flex flex-col gap-1 rounded-xl bg-white/95 p-1 backdrop-blur-xs shadow-md border border-border/80">
              <button
                type="button"
                onClick={handleZoomIn}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-container text-ink transition-colors cursor-pointer"
                title="Acercar mapa"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-container text-ink transition-colors cursor-pointer"
                title="Alejar mapa"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <div className="h-px bg-border my-0.5" />
              <button
                type="button"
                onClick={handleToggleMapType}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-lg transition-colors cursor-pointer',
                  mapType === 'satellite' ? 'bg-primary text-white' : 'hover:bg-surface-container text-ink'
                )}
                title="Alternar Satélite / Mapa"
              >
                <Layers className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRecenter}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-container text-ink transition-colors cursor-pointer"
                title="Centrar en la ubicación seleccionada"
              >
                <Navigation className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Tarjeta de Ubicación Confirmada */}
        {selectedLocation && (
          <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-2.5 animate-in slide-in-from-bottom-2 duration-200">
            <div className="bg-primary p-2 rounded-lg text-white shadow-xs shrink-0">
              <MapPin size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                Ubicación Confirmada
              </p>
              <p className="text-xs text-ink font-semibold truncate mt-0.5">
                {selectedLocation.address || searchQuery}
              </p>
            </div>
            <Check className="h-4 w-4 text-primary shrink-0 mr-1" />
          </div>
        )}
      </div>
    </div>
  );
});

export const GooglePlacesInput = GoogleMapsLocationPicker;
export const MapLocationPicker = GoogleMapsLocationPicker;
