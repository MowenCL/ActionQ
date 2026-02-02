/**
 * ActionQ - Middleware de Autenticación
 * 
 * Maneja la verificación de sesiones mediante cookies firmadas.
 */

import { createMiddleware } from 'hono/factory';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { AppEnv, SessionUser } from '../types';

// ================================================
// UTILIDADES DE CRYPTO
// ================================================

/**
 * Genera un hash SHA-256 de una cadena.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifica si una contraseña coincide con su hash.
 */
export async function verifyPassword(
  password: string, 
  storedHash: string, 
  salt: string
): Promise<boolean> {
  const hash = await hashPassword(password, salt);
  return hash === storedHash;
}

/**
 * Genera un salt aleatorio.
 */
export function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ================================================
// COOKIES DE SESIÓN
// ================================================

const SESSION_COOKIE_NAME = 'actionq_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

/**
 * Firma un payload con el secreto de la aplicación.
 */
async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload + secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${btoa(payload)}.${signature}`;
}

/**
 * Verifica y extrae un payload firmado.
 */
async function verifyPayload(signedValue: string, secret: string): Promise<string | null> {
  try {
    const [encodedPayload, signature] = signedValue.split('.');
    if (!encodedPayload || !signature) return null;
    
    const payload = atob(encodedPayload);
    const expectedSignature = await signPayload(payload, secret);
    const expectedSig = expectedSignature.split('.')[1];
    
    if (signature === expectedSig) {
      return payload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Establece la cookie de sesión con el usuario.
 */
export async function setSessionCookie(
  c: { header: (name: string, value: string) => void; env: { APP_SECRET: string } },
  user: SessionUser
): Promise<void> {
  const payload = JSON.stringify(user);
  const signedValue = await signPayload(payload, c.env.APP_SECRET);
  
  // Usar setCookie de Hono internamente construimos el header
  const cookieValue = `${SESSION_COOKIE_NAME}=${signedValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`;
  c.header('Set-Cookie', cookieValue);
}

/**
 * Obtiene el usuario de la cookie de sesión.
 */
export async function getSessionUser(
  c: { req: { header: (name: string) => string | undefined }; env: { APP_SECRET: string } }
): Promise<SessionUser | null> {
  const cookieHeader = c.req.header('Cookie');
  if (!cookieHeader) return null;
  
  // Parsear cookies manualmente (manejando valores con '=' como en base64)
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const trimmed = cookie.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex);
      const value = trimmed.substring(eqIndex + 1);
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, string>);
  
  const signedValue = cookies[SESSION_COOKIE_NAME];
  if (!signedValue) return null;
  
  const payload = await verifyPayload(signedValue, c.env.APP_SECRET);
  if (!payload) return null;
  
  try {
    return JSON.parse(payload) as SessionUser;
  } catch {
    return null;
  }
}

/**
 * Elimina la cookie de sesión.
 */
export function clearSessionCookie(
  c: { header: (name: string, value: string) => void }
): void {
  const cookieValue = `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
  c.header('Set-Cookie', cookieValue);
}

// ================================================
// MIDDLEWARE DE AUTENTICACIÓN
// ================================================

/**
 * Middleware que carga el usuario de la sesión en el contexto.
 * Verifica que el usuario siga activo en la base de datos.
 * No bloquea la request si no hay usuario.
 */
export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const sessionUser = await getSessionUser(c);
  
  if (sessionUser) {
    // Cargar datos actualizados del usuario y verificar que su organización esté activa
    const dbUser = await c.env.DB
      .prepare(`
        SELECT u.id, u.name, u.email, u.role, u.tenant_id, u.is_active,
               COALESCE(t.is_active, 1) as tenant_is_active
        FROM users u
        LEFT JOIN tenants t ON u.tenant_id = t.id
        WHERE u.id = ?
      `)
      .bind(sessionUser.id)
      .first<{ 
        id: number; 
        name: string; 
        email: string; 
        role: string; 
        tenant_id: number | null; 
        is_active: number;
        tenant_is_active: number;
      }>();
    
    if (dbUser && dbUser.is_active && dbUser.tenant_is_active) {
      // Usuario y organización activos - usar datos actualizados de la BD
      c.set('user', {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role as SessionUser['role'],
        tenant_id: dbUser.tenant_id
      });
    } else {
      // Usuario desactivado, organización desactivada o usuario eliminado - limpiar sesión
      c.set('user', null);
      clearSessionCookie(c);
    }
  } else {
    c.set('user', null);
  }
  
  await next();
});

/**
 * Middleware que requiere autenticación.
 * Redirige a /login si no hay sesión.
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  
  if (!user) {
    return c.redirect('/login');
  }
  
  await next();
});

/**
 * Middleware que requiere rol de administrador.
 * Incluye: super_admin, org_admin (admin de organización)
 */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  
  if (!user) {
    return c.redirect('/login');
  }
  
  if (user.role !== 'super_admin' && user.role !== 'org_admin') {
    return c.text('No tienes permisos para acceder a esta página', 403);
  }
  
  await next();
});

/**
 * Middleware que permite acceso a roles que pueden gestionar asignaciones de tickets.
 * Incluye: super_admin, agent_admin (NO incluye org_admin - es rol de cliente)
 */
export const requireAgentManager = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  
  if (!user) {
    return c.redirect('/login');
  }
  
  if (user.role !== 'super_admin' && user.role !== 'agent_admin') {
    return c.text('No tienes permisos para acceder a esta página', 403);
  }
  
  await next();
});

/**
 * Middleware que requiere rol de super admin.
 */
export const requireSuperAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  
  if (!user) {
    return c.redirect('/login');
  }
  
  if (user.role !== 'super_admin') {
    return c.text('No tienes permisos para acceder a esta página', 403);
  }
  
  await next();
});
