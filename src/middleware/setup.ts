/**
 * ActionQ - Middleware de Setup (First-Run)
 * 
 * Detecta si el sistema está instalado y redirige al setup si no.
 */

import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types';

// ================================================
// VERIFICACIÓN DE INSTALACIÓN
// ================================================

/**
 * Verifica si el sistema ya fue configurado.
 */
export async function isSystemInstalled(db: any): Promise<boolean> {
  try {
    const result = await db
      .prepare("SELECT value FROM system_config WHERE key = 'setup_completed'")
      .first<{ value: string }>();
    
    return result?.value === '1';
  } catch {
    // La tabla puede no existir todavía
    return false;
  }
}

/**
 * Marca el sistema como instalado.
 */
export async function markSystemAsInstalled(db: any): Promise<void> {
  await db
    .prepare("INSERT OR REPLACE INTO system_config (key, value) VALUES ('setup_completed', '1')")
    .run();
}

// ================================================
// MIDDLEWARE DE SETUP
// ================================================

// Rutas que siempre están permitidas (no requieren instalación)
const ALLOWED_PATHS = ['/setup', '/health', '/favicon.ico'];

/**
 * Middleware que verifica si el sistema está instalado.
 * Si no lo está, redirige a /setup (excepto para rutas permitidas).
 */
export const setupCheckMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const path = c.req.path;
  
  // Permitir rutas específicas sin verificar instalación
  if (ALLOWED_PATHS.some(allowed => path.startsWith(allowed))) {
    return next();
  }
  
  // Verificar si el sistema está instalado
  const installed = await isSystemInstalled(c.env.DB);
  c.set('isInstalled', installed);
  
  // Redirigir a setup si no está instalado
  if (!installed) {
    return c.redirect('/setup');
  }
  
  await next();
});

/**
 * Middleware que solo permite acceso a /setup si el sistema NO está instalado.
 * Previene acceso al setup después de la instalación.
 */
export const onlyIfNotInstalledMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const installed = await isSystemInstalled(c.env.DB);
  
  if (installed) {
    return c.redirect('/');
  }
  
  await next();
});
