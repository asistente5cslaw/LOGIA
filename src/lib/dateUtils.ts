const DAYS_OF_WEEK = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

const MONTHS_SPANISH = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const LODGE_TIME_ZONE = 'America/Panama';

/** Devuelve YYYY-MM-DD en la zona horaria operativa de la logia. */
export function getIsoDateInTimeZone(value = new Date(), timeZone = LODGE_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getTodayIsoDate(): string {
  return getIsoDateInTimeZone();
}

/** Normaliza columnas date y timestamps ISO al día calendario, sin conversión UTC. */
export function normalizeDateOnly(value?: string): string {
  return String(value || '').trim().slice(0, 10);
}

/** Interpreta una fecha y hora de la agenda como hora local de Panamá. */
export function parseLodgeDateTime(date: string, time = '00:00:00'): Date {
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  return new Date(`${normalizeDateOnly(date)}T${normalizedTime}-05:00`);
}

/**
 * Formatea una fecha ISO 'YYYY-MM-DD' al formato en español:
 * Ej: "Martes, 29 de Septiembre de 2026"
 */
export function formatDateSpanish(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.trim().split('-');
  if (parts.length < 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12) return dateStr;

  const dateObj = new Date(y, m - 1, d);
  const dayName = DAYS_OF_WEEK[dateObj.getDay()];
  const monthName = MONTHS_SPANISH[m - 1];

  return `${dayName}, ${d} de ${monthName} de ${y}`;
}

/**
 * Formatea una hora 'HH:MM' o 'HH:MM:SS' a formato 12 horas con AM/PM:
 * Ej: "19:30" -> "7:30 PM"
 */
export function formatTime12(timeStr?: string): string {
  if (!timeStr) return '';
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Formatea un rango de horas en formato 12 horas:
 * Ej: "19:30", "21:30" -> "7:30 PM - 9:30 PM"
 */
export function formatTimeRange12(startTime?: string, endTime?: string): string {
  if (!startTime) return '';
  const start = formatTime12(startTime);
  if (!endTime) return start;
  const end = formatTime12(endTime);
  return `${start} - ${end}`;
}

/**
 * Formatea fecha y hora combinadas:
 * Ej: "Martes, 29 de Septiembre de 2026 • 7:30 PM"
 */
export function formatDateTimeSpanish(dateStr?: string, timeStr?: string): string {
  const dateFormatted = formatDateSpanish(dateStr);
  const timeFormatted = formatTime12(timeStr);
  if (dateFormatted && timeFormatted) {
    return `${dateFormatted} • ${timeFormatted}`;
  }
  return dateFormatted || timeFormatted || '';
}
