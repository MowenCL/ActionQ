/**
 * ActionQ - Servicio de Configuración del Sistema
 * 
 * Maneja la configuración global del sistema almacenada en system_config.
 */

import { DEFAULT_SESSION_TIMEOUT_MINUTES } from '../config/constants';

export interface SystemConfig {
  timezone: string;
  sessionTimeoutMinutes: number;
}

/**
 * Obtiene la configuración del sistema
 */
export async function getSystemConfig(db: D1Database): Promise<SystemConfig> {
  try {
    const configs = await db
      .prepare("SELECT key, value FROM system_config WHERE key IN ('timezone', 'session_timeout_minutes')")
      .all<{ key: string; value: string }>();
    
    const configMap = new Map(configs.results?.map(r => [r.key, r.value]) || []);
    
    return {
      timezone: configMap.get('timezone') || 'UTC',
      sessionTimeoutMinutes: parseInt(
        configMap.get('session_timeout_minutes') || String(DEFAULT_SESSION_TIMEOUT_MINUTES), 
        10
      )
    };
  } catch {
    return {
      timezone: 'UTC',
      sessionTimeoutMinutes: DEFAULT_SESSION_TIMEOUT_MINUTES
    };
  }
}

/**
 * Guarda una configuración del sistema
 */
export async function setSystemConfig(
  db: D1Database, 
  key: string, 
  value: string
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO system_config (key, value, updated_at) 
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
    `)
    .bind(key, value, value)
    .run();
}

/**
 * Guarda la zona horaria del sistema
 */
export async function setTimezone(db: D1Database, timezone: string): Promise<void> {
  // Validar que la zona horaria sea válida
  try {
    new Date().toLocaleString('es-ES', { timeZone: timezone });
  } catch {
    throw new Error('Zona horaria inválida');
  }
  
  await setSystemConfig(db, 'timezone', timezone);
}

/**
 * Guarda el tiempo de inactividad de sesión
 */
export async function setSessionTimeout(db: D1Database, minutes: number): Promise<void> {
  if (minutes < 1 || minutes > 480) {
    throw new Error('Tiempo de inactividad inválido (1-480 minutos)');
  }
  
  await setSystemConfig(db, 'session_timeout_minutes', minutes.toString());
}
