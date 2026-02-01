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
  
  // Cloudflare KV - Almacenamiento de OTPs
  OTP_STORE: KVNamespace;
  
  // Secretos (configurados con `wrangler secret put`)
  APP_SECRET: string;
  ADMIN_INIT_EMAIL: string;
  ADMIN_INIT_PASSWORD: string;
  
  // Secretos de ZeptoMail (configurados con `wrangler secret put`)
  ZEPTOMAIL_TOKEN?: string;          // Token de envío de correo
  ZEPTOMAIL_FROM_EMAIL?: string;     // Dirección de remitente
  ZEPTOMAIL_FROM_NAME?: string;      // Nombre del remitente
  ZEPTOMAIL_BOUNCE_ADDRESS?: string; // Agent Alias (bounce address)
  
  // Variables de entorno (configuradas en wrangler.toml [vars])
  APP_NAME: string;
  APP_VERSION: string;
  APP_URL?: string;
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
  must_change_password?: boolean;
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
  
  // Zona horaria configurada para el sistema
  timezone: string;
  
  // Tiempo de inactividad de sesión en minutos
  sessionTimeoutMinutes: number;
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
 * - super_admin: Acceso total al sistema (equipo interno)
 * - agent_admin: Administrador de agentes, puede asignar tickets (equipo interno)
 * - agent: Agente de soporte (equipo interno)
 * - org_admin: Administrador de organización (cliente) - solo gestión de su org
 * - user: Usuario final (cliente)
 */
export type UserRole = 'super_admin' | 'agent_admin' | 'agent' | 'org_admin' | 'user';

/**
 * Estados posibles de un ticket.
 */
export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'closed';

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
  created_by_agent: number | null; // ID del agente que creó el ticket en nombre de otro
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
