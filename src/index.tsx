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
    resolvedTickets: (statusCounts['resolved'] || 0) + (statusCounts['closed'] || 0),
  };
  
  // Obtener tickets recientes con el mismo filtro
  let ticketsQuery: string;
  let ticketsResult;
  
  if (isInternalTeam) {
    // Equipo interno ve todos los tickets recientes
    ticketsQuery = 'SELECT * FROM tickets ORDER BY created_at DESC LIMIT 5';
    ticketsResult = await db.prepare(ticketsQuery).all<Ticket>();
  } else if (user.role === 'org_admin') {
    // org_admin ve tickets recientes de su organización
    ticketsQuery = 'SELECT * FROM tickets WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 5';
    ticketsResult = await db.prepare(ticketsQuery).bind(user.tenant_id).all<Ticket>();
  } else {
    // user: solo sus tickets
    ticketsQuery = 'SELECT * FROM tickets WHERE created_by = ? ORDER BY created_at DESC LIMIT 5';
    ticketsResult = await db.prepare(ticketsQuery).bind(user.id).all<Ticket>();
  }
  
  const recentTickets = ticketsResult.results || [];
  
  return c.html(
    <Layout title="Dashboard" user={user} sessionTimeoutMinutes={c.get('sessionTimeoutMinutes')}>
      <DashboardPage user={user} stats={stats} recentTickets={recentTickets} />
    </Layout>
  );
});

// ================================================
// EXPORTAR APP
// ================================================

export default app;
