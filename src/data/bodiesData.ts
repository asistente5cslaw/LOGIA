import type { MasonicBody } from '@/types';

export const masonicBodies: MasonicBody[] = [
  {
    id: 'uf21',
    name: 'Resp.·. Log.·. Unión Fraternal No. 21',
    shortName: 'Logia UF21',
    symbol: 'Regla y Compás',
    appleEmoji: 'ruler',
    color: '#78292A', // Rojo oscuro del emblema
    description: 'Taller bajo la jurisdicción de la Gran Logia de Panamá',
  },
  {
    id: 'glp',
    name: 'Muy Resp.·. Gran Logia de Panamá',
    shortName: 'Gran Logia de Panamá',
    symbol: 'Gran Templo',
    appleEmoji: 'temple',
    color: '#2B5B84', // Cerulean
    description: 'Oriente de Panamá, Gran Oriente',
  },
  {
    id: 'interlogias',
    name: 'Relaciones Interlogiales',
    shortName: 'Interlogias',
    symbol: 'Fraternidad',
    appleEmoji: 'handshake',
    color: '#C05621', // Terracotta
    description: 'Encuentros y visitas entre talleres hermanos',
  },
  {
    id: 'york',
    name: 'Cuerpos del Rito York',
    shortName: 'Rito York',
    symbol: 'Cruz Templaria',
    appleEmoji: 'cross',
    color: '#701A75', // Purple
    description: 'Capítulo de Real Arco, Concilio y Encomienda Templaria',
  },
  {
    id: 'supremo_consejo',
    name: 'Supremo Consejo del Grado 33',
    shortName: 'Supremo Consejo',
    symbol: 'Águila Bicéfala',
    appleEmoji: 'eagle',
    color: '#1E1E24', // Black / Gold
    description: 'Rito Escocés Antiguo y Aceptado para la República de Panamá',
  },
  {
    id: 'shriners',
    name: 'Abou Saad Shriners',
    shortName: 'Shriners',
    symbol: 'Media Luna',
    appleEmoji: 'moon',
    color: '#B83A28', // Crimson Red
    description: 'Fraternidad filantrópica Shriner de Panamá',
  },
];

export function getBodyById(id: string): MasonicBody {
  return (
    masonicBodies.find((b) => b.id === id) ?? {
      id: 'uf21',
      name: 'Logia UF21',
      shortName: 'Logia UF21',
      symbol: 'Regla y Compás',
      appleEmoji: 'ruler',
      color: '#78292A',
    }
  );
}
