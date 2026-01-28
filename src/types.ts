/**
 * ActionQ - Definición de Tipos
 * 
 * Este archivo define los tipos para los bindings de Cloudflare Workers
 * y las variables de contexto de Hono.
 */

// ================================================
// BINDINGS DE CLOUDFLARE
// ================================================

/**
 * Bindings disponibles en el Worker.
 * Estos se configuran en wrangler.toml y secretos.
 */
export type Bindings = {
  // Base de datos D1
  DB: D1Database;
  
  // Secretos (configurados con `wrangler secret put`)
  APP_SECRET: string;
  ADMIN_INIT_EMAIL: string;
  ADMIN_INIT_PASSWORD: string;
  
  // Variables de entorno (configuradas en wrangler.toml [vars])
  APP_NAME: string;
  APP_VERSION: string;
};

// ================================================
// VARIABLES DE CONTEXTO
// ================================================

/**
 * Usuario autenticado en la sesión actual.
 */
export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  tenant_id: number | null;
}

/**
 * Variables disponibles en el contexto de Hono.
 * Se establecen mediante middleware.
 */
export type Variables = {
  // Usuario de la sesión actual (null si no autenticado)
  user: SessionUser | null;
  
  // Indica si el sistema está instalado
  isInstalled: boolean;
};

// ================================================
// ENTORNO DE LA APP
// ================================================

/**
 * Tipo completo del entorno para Hono.
 * Uso: const app = new Hono<AppEnv>();
 */
export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

// ================================================
// MODELOS DE DATOS
// ================================================

/**
 * Roles de usuario disponibles en el sistema.
 */
export type UserRole = 'super_admin' | 'admin' | 'agent' | 'user';

/**
 * Estados posibles de un ticket.
 */
export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';

/**
 * Prioridades de ticket.
 */
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Modelo: Tenant (organización/empresa)
 */
export interface Tenant {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  allowed_domains: string; // JSON array de dominios permitidos para registro
  created_at: string;
  updated_at: string;
}

/**
 * Modelo: Usuario
 */
export interface User {
  id: number;
  tenant_id: number | null;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Modelo: Ticket
 */
export interface Ticket {
  id: number;
  tenant_id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_by: number;
  assigned_to: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Modelo: Mensaje de ticket
 */
export interface Message {
  id: number;
  ticket_id: number;
  user_id: number;
  content: string;
  is_internal: boolean;
  created_at: string;
}

/**
 * Modelo: Configuración del sistema
 */
export interface SystemConfig {
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}
