/**
 * ActionQ - Servicio de Configuración del Sistema
 * 
 * Maneja la configuración global del sistema almacenada en system_config.
 */

import { DEFAULT_SESSION_TIMEOUT_MINUTES } from '../config/constants';

export const DEFAULT_PENDING_AUTO_RESOLVE_DAYS = 3;

export interface SystemConfig {
  timezone: string;
  sessionTimeoutMinutes: number;
  pendingAutoResolveDays: number;
  autoAssignEnabled: boolean;
  emailEnabled: boolean;
  emailProvider: 'smtp' | 'zeptomail' | '';
  emailTestTemplateKey: string;
  otpEnabled: boolean;
}

export interface EmailProviderConfig {
  provider: 'smtp' | 'zeptomail';
  // ZeptoMail template keys
  zeptomail?: {
    testEmailTemplate: string;
    passwordResetTemplate: string;
    ticketNotificationTemplate: string;
  };
  // SMTP config (para futuro)
  smtp?: {
    host: string;
    port: number;
    user: string;
    secure: boolean;
  };
}

/**
 * Obtiene la configuración del sistema
 */
export async function getSystemConfig(db: D1Database): Promise<SystemConfig> {
  try {
    const configs = await db
      .prepare("SELECT key, value FROM system_config WHERE key IN ('timezone', 'session_timeout_minutes', 'pending_auto_resolve_days', 'auto_assign_enabled', 'email_enabled', 'email_provider', 'email_test_template_key', 'otp_enabled')")
      .all<{ key: string; value: string }>();
    
    const configMap = new Map(configs.results?.map(r => [r.key, r.value]) || []);
    
    return {
      timezone: configMap.get('timezone') || 'UTC',
      sessionTimeoutMinutes: parseInt(
        configMap.get('session_timeout_minutes') || String(DEFAULT_SESSION_TIMEOUT_MINUTES), 
        10
      ),
      pendingAutoResolveDays: parseInt(
        configMap.get('pending_auto_resolve_days') || String(DEFAULT_PENDING_AUTO_RESOLVE_DAYS),
        10
      ),
      autoAssignEnabled: configMap.get('auto_assign_enabled') === 'true',
      emailEnabled: configMap.get('email_enabled') === 'true',
      emailProvider: (configMap.get('email_provider') || '') as 'smtp' | 'zeptomail' | '',
      emailTestTemplateKey: configMap.get('email_test_template_key') || '',
      otpEnabled: configMap.get('otp_enabled') === 'true'
    };
  } catch {
    return {
      timezone: 'UTC',
      sessionTimeoutMinutes: DEFAULT_SESSION_TIMEOUT_MINUTES,
      pendingAutoResolveDays: DEFAULT_PENDING_AUTO_RESOLVE_DAYS,
      autoAssignEnabled: false,
      emailEnabled: false,
      emailProvider: '',
      emailTestTemplateKey: '',
      otpEnabled: false
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
export async function setTimezone(
  db: D1Database, 
  timezone: string
): Promise<{ success: boolean; error?: string }> {
  if (!timezone) {
    return { success: false, error: 'Zona horaria requerida' };
  }
  
  // Validar que la zona horaria sea válida
  try {
    new Date().toLocaleString('es-ES', { timeZone: timezone });
  } catch {
    return { success: false, error: 'Zona horaria inválida' };
  }
  
  try {
    await setSystemConfig(db, 'timezone', timezone);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Error al guardar en la base de datos' };
  }
}

/**
 * Guarda el tiempo de inactividad de sesión
 */
export async function setSessionTimeout(
  db: D1Database, 
  minutes: number
): Promise<{ success: boolean; error?: string }> {
  if (!minutes || isNaN(minutes) || minutes < 1 || minutes > 480) {
    return { success: false, error: 'Tiempo de inactividad inválido (1-480 minutos)' };
  }
  
  try {
    await setSystemConfig(db, 'session_timeout_minutes', minutes.toString());
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Error al guardar en la base de datos' };
  }
}

/**
 * Guarda los días para auto-resolver tickets en "Esperando respuesta"
 */
export async function setPendingAutoResolveDays(
  db: D1Database, 
  days: number
): Promise<{ success: boolean; error?: string }> {
  if (!days || isNaN(days) || days < 1 || days > 30) {
    return { success: false, error: 'Días inválidos (1-30 días)' };
  }
  
  try {
    await setSystemConfig(db, 'pending_auto_resolve_days', days.toString());
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Error al guardar en la base de datos' };
  }
}

/**
 * Guarda la configuración de auto-asignación de tickets
 */
export async function setAutoAssignEnabled(
  db: D1Database, 
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await setSystemConfig(db, 'auto_assign_enabled', enabled ? 'true' : 'false');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Error al guardar en la base de datos' };
  }
}

/**
 * Guarda la configuración de envío de emails
 */
export async function setEmailEnabled(
  db: D1Database, 
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await setSystemConfig(db, 'email_enabled', enabled ? 'true' : 'false');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Error al guardar en la base de datos' };
  }
}

/**
 * Establece el proveedor de correo
 */
export async function setEmailProvider(
  db: D1Database, 
  provider: 'smtp' | 'zeptomail' | ''
): Promise<{ success: boolean; error?: string }> {
  try {
    await setSystemConfig(db, 'email_provider', provider);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Error al guardar en la base de datos' };
  }
}

/**
 * Guarda la configuración de OTP
 */
export async function setOtpEnabled(
  db: D1Database, 
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await setSystemConfig(db, 'otp_enabled', enabled ? 'true' : 'false');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Error al guardar en la base de datos' };
  }
}

/**
 * Obtiene la configuración de templates de ZeptoMail
 */
export async function getZeptoMailTemplates(db: D1Database): Promise<{
  testEmail: string;
  otp: string;
  ticketNotification: string;
}> {
  try {
    const configs = await db
      .prepare("SELECT key, value FROM system_config WHERE key IN ('zeptomail_template_test', 'zeptomail_template_otp', 'zeptomail_template_ticket_notification')")
      .all<{ key: string; value: string }>();
    
    const configMap = new Map(configs.results?.map(r => [r.key, r.value]) || []);
    
    return {
      testEmail: configMap.get('zeptomail_template_test') || '',
      otp: configMap.get('zeptomail_template_otp') || '',
      ticketNotification: configMap.get('zeptomail_template_ticket_notification') || ''
    };
  } catch {
    return {
      testEmail: '',
      otp: '',
      ticketNotification: ''
    };
  }
}

/**
 * Establece las template keys de ZeptoMail
 */
export async function setZeptoMailTemplates(
  db: D1Database, 
  templates: {
    testEmail?: string;
    otp?: string;
    ticketNotification?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const updates: Promise<D1Result>[] = [];
    
    if (templates.testEmail !== undefined) {
      updates.push(
        setSystemConfig(db, 'zeptomail_template_test', templates.testEmail)
      );
    }
    
    if (templates.otp !== undefined) {
      updates.push(
        setSystemConfig(db, 'zeptomail_template_otp', templates.otp)
      );
    }
    
    if (templates.ticketNotification !== undefined) {
      updates.push(
        setSystemConfig(db, 'zeptomail_template_ticket_notification', templates.ticketNotification)
      );
    }
    
    await Promise.all(updates);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Error al guardar en la base de datos' };
  }
}

/**
 * Obtiene el agente disponible con menos tickets activos asignados
 * Solo considera agentes activos (super_admin, agent_admin, agent)
 */
export async function getAvailableAgent(db: D1Database): Promise<{ id: number; active_tickets: number } | null> {
  try {
    // Buscar agente con menos tickets activos (no cerrados) - solo rol 'agent'
    const result = await db.prepare(`
      SELECT u.id, COUNT(t.id) as active_tickets
      FROM users u
      LEFT JOIN tickets t ON t.assigned_to = u.id AND t.status NOT IN ('closed')
      WHERE u.role = 'agent'
        AND u.is_active = 1
      GROUP BY u.id
      ORDER BY active_tickets ASC, u.id ASC
      LIMIT 1
    `).first<{ id: number; active_tickets: number }>();
    
    return result || null;
  } catch (error) {
    console.error('Error getting available agent:', error);
    return null;
  }
}

/**
 * Auto-cierra tickets en estado "pending" que llevan más de X días
 * Retorna el número de tickets cerrados
 */
export async function autoClosePendingTickets(db: D1Database): Promise<number> {
  const config = await getSystemConfig(db);
  const days = config.pendingAutoResolveDays;
  
  // Buscar tickets en "pending" que llevan más de X días sin actualización
  const pendingTickets = await db
    .prepare(`
      SELECT id FROM tickets 
      WHERE status = 'pending' 
      AND datetime(updated_at) < datetime('now', '-' || ? || ' days')
    `)
    .bind(days)
    .all<{ id: number }>();
  
  const ticketIds = pendingTickets.results || [];
  
  for (const ticket of ticketIds) {
    // Actualizar estado a "closed"
    await db
      .prepare("UPDATE tickets SET status = 'closed', updated_at = datetime('now') WHERE id = ?")
      .bind(ticket.id)
      .run();
    
    // Añadir nota automática
    await db
      .prepare(`
        INSERT INTO messages (ticket_id, user_id, content, is_internal) 
        VALUES (?, (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1), ?, 0)
      `)
      .bind(
        ticket.id, 
        `🤖 Ticket cerrado automáticamente por inactividad (${days} días sin respuesta)`
      )
      .run();
  }
  
  return ticketIds.length;
}

/**
 * Guarda el template key de correo de prueba
 */
export async function setEmailTestTemplateKey(
  db: D1Database,
  templateKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .prepare("INSERT INTO system_config (key, value) VALUES ('email_test_template_key', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(templateKey)
      .run();
    
    return { success: true };
  } catch (error) {
    console.error('setEmailTestTemplateKey error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}
