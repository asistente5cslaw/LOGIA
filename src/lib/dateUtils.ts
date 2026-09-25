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
