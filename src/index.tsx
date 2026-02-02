/**
 * ActionQ - Entrada Principal
 * 
 * Sistema de Tickets basado en Cloudflare Workers, Hono y D1.
 * 
 * @author ActionQ Team
 * @license MIT
 */

import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { csrf } from 'hono/csrf';

import type { AppEnv, Ticket, Tenant } from './types';
import { Layout, MinimalLayout } from './views/Layout';
import { DashboardPage } from './views/pages';
import { 
  sessionMiddleware, 
  requireAuth,
  requireAdmin,
  requireAgentManager,
  requireSuperAdmin,
  hashPassword,
  generateSalt
} from './middleware/auth';
import { setupCheckMiddleware } from './middleware/setup';

// Utilidades y constantes extraídas
import { formatDate } from './utils';
import { 
  TICKET_STATUS_LABELS, 
  TICKET_STATUS_COLORS, 
  TIMEZONES,
  SESSION_TIMEOUT_OPTIONS,
  PRIORITY_ORDER_SQL
} from './config/constants';

// Servicios
import { 
  getSystemConfig, 
  setTimezone, 
  setSessionTimeout 
} from './services/config.service';
import { 
  createSecureKey, 
  decryptSecureKey, 
  getSecureKeyById, 
  deleteSecureKey,
  logSecureKeyDeletion,
  logSecureKeyCreation
} from './services/secureKey.service';

// Rutas
import { authRoutes, adminRoutes, ticketRoutes } from './routes';

// ================================================
// CREAR APP HONO
// ================================================

const app = new Hono<AppEnv>();

// ================================================
// MIDDLEWARE GLOBAL
// ================================================

// Logging de requests
app.use('*', logger());

// Headers de seguridad
app.use('*', secureHeaders());

// Cargar sesión del usuario
app.use('*', sessionMiddleware);

// Cargar zona horaria del sistema y timeout de sesión
app.use('*', async (c, next) => {
  try {
    const { getSystemConfig } = await import('./services/config.service');
    const config = await getSystemConfig(c.env.DB);
    c.set('timezone', config.timezone);
    c.set('sessionTimeoutMinutes', config.sessionTimeoutMinutes);
  } catch {
    c.set('timezone', 'UTC');
    c.set('sessionTimeoutMinutes', 5);
  }
  await next();
});

// Verificar instalación (redirige a /setup si no está configurado)
app.use('*', setupCheckMiddleware);

// ================================================
// RUTAS PÚBLICAS
// ================================================

/**
 * Health check - útil para monitoreo
 */
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: c.env.APP_VERSION || '1.0.0'
  });
});

// ================================================
// MONTAR RUTAS DE AUTENTICACIÓN
// ================================================

// Setup, login, registro, logout y session/keepalive
app.route('/', authRoutes);

// ================================================
// MONTAR RUTAS DE ADMINISTRACIÓN
// ================================================

// Panel admin, gestión de usuarios, tenants, configuración
app.route('/', adminRoutes);

// ================================================
// MONTAR RUTAS DE TICKETS
// ================================================

// CRUD de tickets, mensajes, asignaciones, participantes
app.route('/', ticketRoutes);

// ================================================
// RUTAS PROTEGIDAS (Requieren autenticación)
// ================================================

/**
 * GET / - Página principal (redirige a dashboard)
 */
app.get('/', (c) => {
  const user = c.get('user');
  if (!user) {
    return c.redirect('/login');
  }
  return c.redirect('/dashboard');
});

/**
 * GET /dashboard - Panel principal
 */
app.get('/dashboard', requireAuth, async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  
  // Determinar filtro según rol:
  // - super_admin/agent_admin/agent: ve todos los tickets (equipo interno)
  // - org_admin: ve todos los tickets de su organización
  // - user: solo ve sus propios tickets
  const isInternalTeam = user.role === 'super_admin' || user.role === 'agent_admin' || user.role === 'agent';
  
  let statsQuery: string;
  let statsResult;
  
  if (isInternalTeam) {
    // Equipo interno ve todos los tickets
    statsQuery = 'SELECT status, COUNT(*) as count FROM tickets GROUP BY status';
    statsResult = await db.prepare(statsQuery).all<{ status: string; count: number }>();
  } else if (user.role === 'org_admin') {
    // org_admin ve todos los tickets de su organización
    statsQuery = 'SELECT status, COUNT(*) as count FROM tickets WHERE tenant_id = ? GROUP BY status';
    statsResult = await db.prepare(statsQuery).bind(user.tenant_id).all<{ status: string; count: number }>();
  } else {
    // user: solo sus tickets
    statsQuery = 'SELECT status, COUNT(*) as count FROM tickets WHERE created_by = ? GROUP BY status';
    statsResult = await db.prepare(statsQuery).bind(user.id).all<{ status: string; count: number }>();
  }
  
  const statusCounts = statsResult.results?.reduce((acc, row) => {
    acc[row.status] = row.count;
    return acc;
  }, {} as Record<string, number>) || {};
  
  const stats = {
    totalTickets: Object.values(statusCounts).reduce((a, b) => a + b, 0),
    openTickets: statusCounts['open'] || 0,
    inProgressTickets: statusCounts['in_progress'] || 0,
    resolvedTickets: (statusCounts['pending'] || 0) + (statusCounts['closed'] || 0),
  };
  
  // Obtener tickets actualizados recientemente con info de última actividad
  let ticketsQuery: string;
  let ticketsResult;
  
  // Query base con subquery para obtener el último mensaje y nombre del asignado
  const baseSelect = `
    SELECT t.*, 
           u.name as assigned_to_name,
           (
             SELECT m.content FROM messages m 
             WHERE m.ticket_id = t.id 
             ORDER BY m.created_at DESC LIMIT 1
           ) as last_message,
           (
             SELECT mu.name FROM messages m 
             JOIN users mu ON m.user_id = mu.id
             WHERE m.ticket_id = t.id 
             ORDER BY m.created_at DESC LIMIT 1
           ) as last_message_by
    FROM tickets t
    LEFT JOIN users u ON t.assigned_to = u.id
  `;
  
  if (isInternalTeam) {
    // Equipo interno ve todos los tickets actualizados recientemente
    ticketsQuery = `${baseSelect} ORDER BY t.updated_at DESC LIMIT 5`;
    ticketsResult = await db.prepare(ticketsQuery).all<Ticket & { assigned_to_name: string | null; last_message: string | null; last_message_by: string | null }>();
  } else if (user.role === 'org_admin') {
    // org_admin ve tickets de su organización actualizados recientemente
    ticketsQuery = `${baseSelect} WHERE t.tenant_id = ? ORDER BY t.updated_at DESC LIMIT 5`;
    ticketsResult = await db.prepare(ticketsQuery).bind(user.tenant_id).all<Ticket & { assigned_to_name: string | null; last_message: string | null; last_message_by: string | null }>();
  } else {
    // user: solo sus tickets actualizados recientemente
    ticketsQuery = `${baseSelect} WHERE t.created_by = ? ORDER BY t.updated_at DESC LIMIT 5`;
    ticketsResult = await db.prepare(ticketsQuery).bind(user.id).all<Ticket & { assigned_to_name: string | null; last_message: string | null; last_message_by: string | null }>();
  }
  
  const recentTickets = ticketsResult.results || [];
  
  return c.html(
    <Layout title="Dashboard" user={user} sessionTimeoutMinutes={c.get('sessionTimeoutMinutes')}>
      <DashboardPage user={user} stats={stats} recentTickets={recentTickets as any} />
    </Layout>
  );
});

// ================================================
// SCHEDULED HANDLER (Cron Trigger)
// ================================================

/**
 * Ejecuta tareas programadas (auto-resolver tickets en "pending")
 */
async function handleScheduled(event: ScheduledEvent, env: AppEnv['Bindings']) {
  console.log('[Scheduled] Running auto-resolve task at', new Date().toISOString());
  
  try {
    // Obtener configuración de días para auto-resolver
    const config = await getSystemConfig(env.DB);
    const days = config.pendingAutoResolveDays;
    
    // Calcular fecha límite (tickets actualizados antes de esta fecha serán cerrados)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffISO = cutoffDate.toISOString();
    
    console.log(`[Scheduled] Auto-closing tickets in "pending" status not updated since ${cutoffISO}`);
    
    // Buscar tickets en estado "pending" que no han sido actualizados en X días
    const ticketsToResolve = await env.DB.prepare(`
      SELECT id, subject FROM tickets 
      WHERE status = 'pending' AND updated_at < ?
    `).bind(cutoffISO).all<{ id: number; subject: string }>();
    
    const tickets = ticketsToResolve.results || [];
    
    if (tickets.length === 0) {
      console.log('[Scheduled] No tickets to auto-close');
      return;
    }
    
    console.log(`[Scheduled] Found ${tickets.length} tickets to auto-close`);
    
    // Resolver cada ticket
    const now = new Date().toISOString();
    for (const ticket of tickets) {
      // Actualizar estado del ticket a cerrado
      await env.DB.prepare(`
        UPDATE tickets 
        SET status = 'closed', updated_at = ? 
        WHERE id = ?
      `).bind(now, ticket.id).run();
      
      // Añadir mensaje automático
      await env.DB.prepare(`
        INSERT INTO messages (ticket_id, user_id, content, is_internal, created_at)
        VALUES (?, NULL, ?, 0, ?)
      `).bind(
        ticket.id,
        `🤖 **Ticket cerrado automáticamente**\n\nEste ticket fue cerrado automáticamente después de ${days} días sin respuesta.\n\nSi aún necesitas ayuda, por favor crea un nuevo ticket.`,
        now
      ).run();
      
      console.log(`[Scheduled] Auto-closed ticket #${ticket.id}: ${ticket.subject}`);
    }
    
    console.log(`[Scheduled] Successfully auto-closed ${tickets.length} tickets`);
    
  } catch (error) {
    console.error('[Scheduled] Error in auto-resolve task:', error);
  }
}

// ================================================
// EXPORTAR APP
// ================================================

export default {
  fetch: app.fetch,
  scheduled: handleScheduled
};
