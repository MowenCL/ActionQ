/**
 * ActionQ - Constantes de Configuración
 * 
 * Constantes y configuraciones estáticas del sistema.
 */

// ================================================
// ESTADOS DE TICKETS
// ================================================

/**
 * Etiquetas de estado de tickets en español
 */
export const TICKET_STATUS_LABELS: Record<string, string> = {
  'open': 'Abierto',
  'in_progress': 'En Progreso',
  'pending': 'Validando',
  'resolved': 'Resuelto',
  'closed': 'Cerrado'
};

/**
 * Clases CSS de Tailwind para cada estado de ticket
 */
export const TICKET_STATUS_COLORS: Record<string, string> = {
  'open': 'bg-blue-100 text-blue-800',
  'in_progress': 'bg-yellow-100 text-yellow-800',
  'pending': 'bg-purple-100 text-purple-800',
  'resolved': 'bg-green-100 text-green-800',
  'closed': 'bg-gray-100 text-gray-800'
};

/**
 * Orden de prioridad para ordenar tickets en consultas SQL
 */
export const PRIORITY_ORDER_SQL = `
  CASE t.priority 
    WHEN 'urgent' THEN 1 
    WHEN 'high' THEN 2 
    WHEN 'medium' THEN 3 
    WHEN 'low' THEN 4 
    ELSE 5 
  END
`;

// ================================================
// ZONAS HORARIAS
// ================================================

/**
 * Lista de zonas horarias comunes para el selector de configuración
 */
export const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Tiempo Universal Coordinado)' },
  { value: 'America/New_York', label: 'América/Nueva York (EST/EDT)' },
  { value: 'America/Chicago', label: 'América/Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'América/Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'América/Los Ángeles (PST/PDT)' },
  { value: 'America/Mexico_City', label: 'América/Ciudad de México (CST)' },
  { value: 'America/Bogota', label: 'América/Bogotá (COT)' },
  { value: 'America/Lima', label: 'América/Lima (PET)' },
  { value: 'America/Santiago', label: 'América/Santiago (CLT/CLST)' },
  { value: 'America/Buenos_Aires', label: 'América/Buenos Aires (ART)' },
  { value: 'America/Sao_Paulo', label: 'América/São Paulo (BRT/BRST)' },
  { value: 'America/Caracas', label: 'América/Caracas (VET)' },
  { value: 'Europe/London', label: 'Europa/Londres (GMT/BST)' },
  { value: 'Europe/Madrid', label: 'Europa/Madrid (CET/CEST)' },
  { value: 'Europe/Paris', label: 'Europa/París (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Europa/Berlín (CET/CEST)' },
  { value: 'Europe/Rome', label: 'Europa/Roma (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokio (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghái (CST)' },
  { value: 'Asia/Seoul', label: 'Asia/Seúl (KST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapur (SGT)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubái (GST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sídney (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Pacífico/Auckland (NZST/NZDT)' },
] as const;

// ================================================
// CONFIGURACIÓN DE SESIÓN
// ================================================

/**
 * Opciones de tiempo de inactividad para el selector
 */
export const SESSION_TIMEOUT_OPTIONS = [
  { value: 1, label: '1 minuto (pruebas)' },
  { value: 5, label: '5 minutos' },
  { value: 10, label: '10 minutos' },
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 480, label: '8 horas' },
] as const;

/**
 * Tiempo de inactividad por defecto (minutos)
 */
export const DEFAULT_SESSION_TIMEOUT_MINUTES = 5;

/**
 * Segundos de advertencia antes de cerrar sesión
 */
export const SESSION_WARNING_SECONDS = 30;
