/**
 * ActionQ - Utilidades de Fecha
 * 
 * Funciones helper para formateo y manipulación de fechas.
 */

/**
 * Formatea una fecha con la zona horaria especificada
 * @param dateStr - Fecha en formato string (ISO 8601)
 * @param timezone - Zona horaria (ej: 'America/Santiago')
 * @param options - Opciones adicionales
 * @returns Fecha formateada en español
 */
export function formatDate(
  dateStr: string, 
  timezone: string, 
  options?: { dateOnly?: boolean }
): string {
  try {
    const date = new Date(dateStr);
    if (options?.dateOnly) {
      return date.toLocaleDateString('es-ES', { timeZone: timezone });
    }
    return date.toLocaleString('es-ES', { timeZone: timezone });
  } catch {
    return dateStr;
  }
}

/**
 * Obtiene la hora actual formateada en una zona horaria
 * @param timezone - Zona horaria
 * @returns Fecha y hora actual formateada
 */
export function getCurrentTimeInTimezone(timezone: string): string {
  const now = new Date();
  try {
    return now.toLocaleString('es-ES', { 
      timeZone: timezone,
      dateStyle: 'full',
      timeStyle: 'long'
    });
  } catch {
    return now.toISOString();
  }
}
