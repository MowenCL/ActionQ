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

import type { AppEnv, SessionUser, User, Ticket, Tenant } from './types';
import { Layout, MinimalLayout } from './views/Layout';
import { SetupPage, LoginPage, RegisterPage, DashboardPage } from './views/pages';
import { 
  sessionMiddleware, 
  requireAuth,
  requireAdmin,
  setSessionCookie, 
  clearSessionCookie,
  hashPassword,
  verifyPassword,
  generateSalt
} from './middleware/auth';
import { 
  setupCheckMiddleware, 
  onlyIfNotInstalledMiddleware,
  markSystemAsInstalled 
} from './middleware/setup';

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
// RUTAS DE SETUP (Primera instalación)
// ================================================

/**
 * GET /setup - Formulario de configuración inicial
 */
app.get('/setup', onlyIfNotInstalledMiddleware, async (c) => {
  const adminEmail = c.env.ADMIN_INIT_EMAIL || '';
  
  if (!adminEmail) {
    return c.html(
      <MinimalLayout title="Error de Configuración">
        <div class="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <span class="text-5xl">⚠️</span>
          <h1 class="mt-4 text-xl font-bold text-red-600">Error de Configuración</h1>
          <p class="mt-2 text-sm text-gray-600">
            La variable de entorno <code class="bg-gray-100 px-1 rounded">ADMIN_INIT_EMAIL</code> no está configurada.
          </p>
          <p class="mt-4 text-sm text-gray-500">
            Configura los secretos usando <code class="bg-gray-100 px-1 rounded">wrangler secret put</code>
          </p>
        </div>
      </MinimalLayout>
    );
  }
  
  return c.html(
    <MinimalLayout title="Configuración Inicial">
      <SetupPage adminEmail={adminEmail} />
    </MinimalLayout>
  );
});

/**
 * POST /setup - Procesar configuración inicial
 */
app.post('/setup', onlyIfNotInstalledMiddleware, async (c) => {
  const adminEmail = c.env.ADMIN_INIT_EMAIL;
  const adminPassword = c.env.ADMIN_INIT_PASSWORD;
  
  if (!adminEmail || !adminPassword) {
    return c.html(
      <MinimalLayout title="Error">
        <SetupPage 
          adminEmail={adminEmail || ''} 
          error="Variables de entorno ADMIN_INIT_EMAIL y ADMIN_INIT_PASSWORD son requeridas" 
        />
      </MinimalLayout>
    );
  }
  
  try {
    const formData = await c.req.formData();
    const name = formData.get('name') as string;
    const organization = formData.get('organization') as string;
    
    if (!name || !organization) {
      return c.html(
        <MinimalLayout title="Error">
          <SetupPage 
            adminEmail={adminEmail} 
            error="Todos los campos son requeridos" 
          />
        </MinimalLayout>
      );
    }
    
    // Crear slug para la organización
    const slug = organization
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Generar hash de contraseña
    const salt = generateSalt();
    const passwordHash = await hashPassword(adminPassword, salt);
    const storedHash = `${salt}:${passwordHash}`;
    
    // Crear tenant y usuario en una transacción
    const db = c.env.DB;
    
    // 1. Crear tenant
    const tenantResult = await db
      .prepare('INSERT INTO tenants (name, slug) VALUES (?, ?) RETURNING id')
      .bind(organization, slug)
      .first<{ id: number }>();
    
    if (!tenantResult) {
      throw new Error('No se pudo crear la organización');
    }
    
    // 2. Crear usuario super_admin
    await db
      .prepare(`
        INSERT INTO users (tenant_id, email, password_hash, name, role) 
        VALUES (?, ?, ?, ?, 'super_admin')
      `)
      .bind(tenantResult.id, adminEmail, storedHash, name)
      .run();
    
    // 3. Marcar sistema como instalado
    await markSystemAsInstalled(db);
    
    // Redirigir al login
    return c.redirect('/login?setup=success');
    
  } catch (error) {
    console.error('Setup error:', error);
    return c.html(
      <MinimalLayout title="Error">
        <SetupPage 
          adminEmail={adminEmail} 
          error={`Error durante la configuración: ${error instanceof Error ? error.message : 'Error desconocido'}`} 
        />
      </MinimalLayout>
    );
  }
});

// ================================================
// RUTAS DE AUTENTICACIÓN
// ================================================

/**
 * GET /login - Formulario de inicio de sesión
 */
app.get('/login', (c) => {
  const user = c.get('user');
  if (user) {
    return c.redirect('/dashboard');
  }
  
  const setupSuccess = c.req.query('setup') === 'success';
  
  return c.html(
    <MinimalLayout title="Iniciar Sesión">
      {setupSuccess && (
        <div class="fixed top-4 right-4 bg-green-100 border border-green-200 text-green-800 px-4 py-3 rounded-lg shadow-lg">
          ✅ Configuración completada. Ya puedes iniciar sesión.
        </div>
      )}
      <LoginPage />
    </MinimalLayout>
  );
});

/**
 * POST /login - Procesar inicio de sesión
 */
app.post('/login', async (c) => {
  try {
    const formData = await c.req.formData();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    if (!email || !password) {
      return c.html(
        <MinimalLayout title="Error">
          <LoginPage error="Email y contraseña son requeridos" />
        </MinimalLayout>
      );
    }
    
    // Buscar usuario
    const user = await c.env.DB
      .prepare('SELECT * FROM users WHERE email = ? AND is_active = 1')
      .bind(email)
      .first<User>();
    
    if (!user) {
      return c.html(
        <MinimalLayout title="Error">
          <LoginPage error="Credenciales inválidas" />
        </MinimalLayout>
      );
    }
    
    // Verificar contraseña
    const [salt, storedHash] = user.password_hash.split(':');
    const isValid = await verifyPassword(password, storedHash, salt);
    
    if (!isValid) {
      return c.html(
        <MinimalLayout title="Error">
          <LoginPage error="Credenciales inválidas" />
        </MinimalLayout>
      );
    }
    
    // Actualizar último login
    await c.env.DB
      .prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?")
      .bind(user.id)
      .run();
    
    // Crear sesión
    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as SessionUser['role'],
      tenant_id: user.tenant_id,
    };
    
    await setSessionCookie(c, sessionUser);
    
    return c.redirect('/dashboard');
    
  } catch (error) {
    console.error('Login error:', error);
    return c.html(
      <MinimalLayout title="Error">
        <LoginPage error="Error al procesar el inicio de sesión" />
      </MinimalLayout>
    );
  }
});

/**
 * GET /register - Formulario de registro público
 */
app.get('/register', (c) => {
  const user = c.get('user');
  if (user) {
    return c.redirect('/dashboard');
  }
  
  return c.html(
    <MinimalLayout title="Crear Cuenta">
      <RegisterPage />
    </MinimalLayout>
  );
});

/**
 * POST /register - Procesar registro público
 * Cada dominio de email = una organización independiente
 * Si la organización no existe, se crea automáticamente
 */
app.post('/register', async (c) => {
  try {
    const formData = await c.req.formData();
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const passwordConfirm = formData.get('password_confirm') as string;
    
    // Validaciones básicas
    if (!name || !email || !password || !passwordConfirm) {
      return c.html(
        <MinimalLayout title="Error">
          <RegisterPage error="Todos los campos son requeridos" />
        </MinimalLayout>
      );
    }
    
    if (password !== passwordConfirm) {
      return c.html(
        <MinimalLayout title="Error">
          <RegisterPage error="Las contraseñas no coinciden" />
        </MinimalLayout>
      );
    }
    
    if (password.length < 8) {
      return c.html(
        <MinimalLayout title="Error">
          <RegisterPage error="La contraseña debe tener al menos 8 caracteres" />
        </MinimalLayout>
      );
    }
    
    // Extraer dominio del email
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (!emailDomain) {
      return c.html(
        <MinimalLayout title="Error">
          <RegisterPage error="Email inválido" />
        </MinimalLayout>
      );
    }
    
    // Verificar si el email ya existe
    const existingUser = await c.env.DB
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(email.toLowerCase())
      .first();
    
    if (existingUser) {
      return c.html(
        <MinimalLayout title="Error">
          <RegisterPage error="No se pudo completar el registro. Verifica tus datos." />
        </MinimalLayout>
      );
    }
    
    // Buscar organización existente basada en el dominio del email
    // Buscar en allowed_domains de todas las organizaciones activas
    let tenant: { id: number; name: string } | null = null;
    
    const allTenants = await c.env.DB
      .prepare('SELECT id, name, allowed_domains FROM tenants WHERE is_active = 1')
      .all<{ id: number; name: string; allowed_domains: string }>();
    
    for (const t of allTenants.results || []) {
      const domains: string[] = JSON.parse(t.allowed_domains || '[]');
      if (domains.includes(emailDomain)) {
        tenant = { id: t.id, name: t.name };
        break;
      }
    }
    
    // Si no existe la organización, no permitir registro
    if (!tenant) {
      return c.html(
        <MinimalLayout title="Error">
          <RegisterPage error={`No existe una organización registrada para el dominio "${emailDomain}". Contacta al administrador.`} />
        </MinimalLayout>
      );
    }
    
    // Todos los usuarios registrados son "user" por defecto
    // Solo un admin existente puede promover usuarios a admin
    const userRole = 'user';
    
    // Crear usuario
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const storedHash = `${salt}:${passwordHash}`;
    
    await c.env.DB
      .prepare('INSERT INTO users (tenant_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)')
      .bind(tenant.id, email.toLowerCase(), storedHash, name, userRole)
      .run();
    
    return c.html(
      <MinimalLayout title="Registro Exitoso">
        <RegisterPage success={true} />
      </MinimalLayout>
    );
    
  } catch (error) {
    console.error('Register error:', error);
    return c.html(
      <MinimalLayout title="Error">
        <RegisterPage error="No se pudo completar el registro. Verifica tus datos." />
      </MinimalLayout>
    );
  }
});

/**
 * GET/POST /logout - Cerrar sesión
 */
app.all('/logout', (c) => {
  clearSessionCookie(c);
  return c.redirect('/login');
});

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
  // - super_admin: ve todos los tickets
  // - admin/agent: ve todos los tickets de su tenant
  // - user: solo ve sus propios tickets
  let statsQuery: string;
  let statsResult;
  
  if (user.role === 'super_admin') {
    statsQuery = 'SELECT status, COUNT(*) as count FROM tickets GROUP BY status';
    statsResult = await db.prepare(statsQuery).all<{ status: string; count: number }>();
  } else if (user.role === 'admin' || user.role === 'agent') {
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
  
  if (user.role === 'super_admin') {
    ticketsQuery = 'SELECT * FROM tickets ORDER BY created_at DESC LIMIT 5';
    ticketsResult = await db.prepare(ticketsQuery).all<Ticket>();
  } else if (user.role === 'admin' || user.role === 'agent') {
    ticketsQuery = 'SELECT * FROM tickets WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 5';
    ticketsResult = await db.prepare(ticketsQuery).bind(user.tenant_id).all<Ticket>();
  } else {
    // user: solo sus tickets
    ticketsQuery = 'SELECT * FROM tickets WHERE created_by = ? ORDER BY created_at DESC LIMIT 5';
    ticketsResult = await db.prepare(ticketsQuery).bind(user.id).all<Ticket>();
  }
  
  const recentTickets = ticketsResult.results || [];
  
  return c.html(
    <Layout title="Dashboard" user={user}>
      <DashboardPage user={user} stats={stats} recentTickets={recentTickets} />
    </Layout>
  );
});

// ================================================
// RUTAS DE TICKETS (CRUD básico)
// ================================================

/**
 * GET /tickets - Listar tickets
 */
app.get('/tickets', requireAuth, async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  
  // Filtro según rol
  let query: string;
  let result;
  
  if (user.role === 'super_admin') {
    query = 'SELECT * FROM tickets ORDER BY created_at DESC';
    result = await db.prepare(query).all<Ticket>();
  } else if (user.role === 'admin' || user.role === 'agent') {
    query = 'SELECT * FROM tickets WHERE tenant_id = ? ORDER BY created_at DESC';
    result = await db.prepare(query).bind(user.tenant_id).all<Ticket>();
  } else {
    // user: solo sus tickets
    query = 'SELECT * FROM tickets WHERE created_by = ? ORDER BY created_at DESC';
    result = await db.prepare(query).bind(user.id).all<Ticket>();
  }
  
  const tickets = result.results || [];
  
  return c.html(
    <Layout title="Tickets" user={user}>
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <h1 class="text-2xl font-bold text-gray-900">Tickets</h1>
          <a 
            href="/tickets/new"
            class="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            + Nuevo Ticket
          </a>
        </div>
        
        <div class="bg-white rounded-lg shadow overflow-hidden">
          {tickets.length > 0 ? (
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridad</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} class="hover:bg-gray-50 cursor-pointer" onclick={`window.location='/tickets/${ticket.id}'`}>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{ticket.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ticket.title}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        ticket.status === 'open' ? 'bg-blue-100 text-blue-800' :
                        ticket.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                        ticket.status === 'resolved' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        ticket.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                        ticket.priority === 'high' ? 'bg-orange-100 text-orange-600' :
                        ticket.priority === 'medium' ? 'bg-blue-100 text-blue-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(ticket.created_at).toLocaleDateString('es-ES')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div class="px-6 py-12 text-center">
              <span class="text-4xl">📭</span>
              <p class="mt-2 text-gray-500">No hay tickets</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
});

/**
 * GET /tickets/new - Formulario para crear ticket
 */
app.get('/tickets/new', requireAuth, (c) => {
  const user = c.get('user')!;
  
  return c.html(
    <Layout title="Nuevo Ticket" user={user}>
      <div class="max-w-2xl mx-auto">
        <h1 class="text-2xl font-bold text-gray-900 mb-6">Crear Nuevo Ticket</h1>
        
        <form method="post" action="/tickets" class="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Título</label>
            <input 
              type="text" 
              name="title" 
              required
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe brevemente el problema"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea 
              name="description" 
              rows={5}
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Proporciona todos los detalles relevantes..."
            ></textarea>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <select 
                name="priority" 
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="low">Baja</option>
                <option value="medium" selected>Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>
          
          <div class="flex justify-end space-x-3">
            <a href="/tickets" class="px-4 py-2 text-gray-700 hover:text-gray-900">Cancelar</a>
            <button 
              type="submit"
              class="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            >
              Crear Ticket
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
});

/**
 * POST /tickets - Crear ticket
 */
app.post('/tickets', requireAuth, async (c) => {
  const user = c.get('user')!;
  
  try {
    const formData = await c.req.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string || '';
    const priority = formData.get('priority') as string || 'medium';
    
    if (!title) {
      return c.text('El título es requerido', 400);
    }
    
    const result = await c.env.DB
      .prepare(`
        INSERT INTO tickets (tenant_id, title, description, priority, created_by) 
        VALUES (?, ?, ?, ?, ?)
        RETURNING id
      `)
      .bind(user.tenant_id, title, description, priority, user.id)
      .first<{ id: number }>();
    
    return c.redirect(`/tickets/${result?.id}`);
    
  } catch (error) {
    console.error('Create ticket error:', error);
    return c.text('Error al crear el ticket', 500);
  }
});

/**
 * GET /tickets/:id - Ver detalle de ticket
 */
app.get('/tickets/:id', requireAuth, async (c) => {
  const user = c.get('user')!;
  const ticketId = parseInt(c.req.param('id'));
  
  const ticket = await c.env.DB
    .prepare('SELECT * FROM tickets WHERE id = ?')
    .bind(ticketId)
    .first<Ticket>();
  
  if (!ticket) {
    return c.text('Ticket no encontrado', 404);
  }
  
  // Verificar acceso según rol:
  // - super_admin: acceso a todos
  // - admin/agent: acceso a tickets de su tenant
  // - user: solo acceso a sus propios tickets
  if (user.role === 'super_admin') {
    // OK - acceso total
  } else if (user.role === 'admin' || user.role === 'agent') {
    if (ticket.tenant_id !== user.tenant_id) {
      return c.text('No tienes acceso a este ticket', 403);
    }
  } else {
    // user: solo sus tickets
    if (ticket.created_by !== user.id) {
      return c.text('No tienes acceso a este ticket', 403);
    }
  }
  
  // Obtener mensajes del ticket (usuarios normales no ven notas internas)
  const messagesQuery = user.role === 'user'
    ? `SELECT m.*, u.name as user_name 
       FROM messages m 
       JOIN users u ON m.user_id = u.id 
       WHERE m.ticket_id = ? AND m.is_internal = 0
       ORDER BY m.created_at ASC`
    : `SELECT m.*, u.name as user_name 
       FROM messages m 
       JOIN users u ON m.user_id = u.id 
       WHERE m.ticket_id = ? 
       ORDER BY m.created_at ASC`;
  
  const messages = await c.env.DB
    .prepare(messagesQuery)
    .bind(ticketId)
    .all<{ id: number; content: string; is_internal: number; created_at: string; user_name: string }>();
  
  return c.html(
    <Layout title={`Ticket #${ticket.id}`} user={user}>
      <div class="max-w-4xl mx-auto space-y-6">
        {/* Header del ticket */}
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-sm text-gray-500">Ticket #{ticket.id}</p>
              <h1 class="text-2xl font-bold text-gray-900 mt-1">{ticket.title}</h1>
            </div>
            <div class="flex items-center space-x-2">
              <span class={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                ticket.status === 'open' ? 'bg-blue-100 text-blue-800' :
                ticket.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                ticket.status === 'resolved' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {ticket.status}
              </span>
              <span class={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                ticket.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                ticket.priority === 'high' ? 'bg-orange-100 text-orange-600' :
                ticket.priority === 'medium' ? 'bg-blue-100 text-blue-600' :
                'bg-gray-100 text-gray-600'
              }`}>
                {ticket.priority}
              </span>
            </div>
          </div>
          
          {ticket.description && (
            <div class="mt-4 prose prose-sm max-w-none">
              <p class="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}
          
          <div class="mt-4 text-sm text-gray-500">
            Creado el {new Date(ticket.created_at).toLocaleString('es-ES')}
          </div>
        </div>
        
        {/* Mensajes */}
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">Conversación</h2>
          </div>
          
          <div class="divide-y divide-gray-200">
            {messages.results && messages.results.length > 0 ? (
              messages.results.map((msg) => (
                <div key={msg.id} class={`px-6 py-4 ${msg.is_internal ? 'bg-yellow-50' : ''}`}>
                  <div class="flex justify-between items-start">
                    <span class="font-medium text-gray-900">{msg.user_name}</span>
                    <span class="text-sm text-gray-500">
                      {new Date(msg.created_at).toLocaleString('es-ES')}
                    </span>
                  </div>
                  <p class="mt-1 text-gray-700 whitespace-pre-wrap">{msg.content}</p>
                  {msg.is_internal === 1 && (
                    <span class="inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                      Nota interna
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div class="px-6 py-8 text-center text-gray-500">
                No hay mensajes todavía
              </div>
            )}
          </div>
          
          {/* Formulario para nuevo mensaje */}
          <div class="px-6 py-4 border-t border-gray-200">
            <form method="post" action={`/tickets/${ticket.id}/messages`} class="space-y-4">
              <textarea 
                name="content" 
                rows={3}
                required
                placeholder="Escribe un mensaje..."
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
              
              <div class="flex justify-between items-center">
                {(user.role === 'admin' || user.role === 'super_admin' || user.role === 'agent') && (
                  <label class="flex items-center space-x-2">
                    <input type="checkbox" name="is_internal" value="1" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span class="text-sm text-gray-600">Nota interna</span>
                  </label>
                )}
                <button 
                  type="submit"
                  class="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
                >
                  Enviar
                </button>
              </div>
            </form>
          </div>
        </div>
        
        <div class="flex justify-start">
          <a href="/tickets" class="text-blue-600 hover:text-blue-700">
            ← Volver a tickets
          </a>
        </div>
      </div>
    </Layout>
  );
});

/**
 * POST /tickets/:id/messages - Añadir mensaje a ticket
 */
app.post('/tickets/:id/messages', requireAuth, async (c) => {
  const user = c.get('user')!;
  const ticketId = parseInt(c.req.param('id'));
  
  try {
    const formData = await c.req.formData();
    const content = formData.get('content') as string;
    const isInternal = formData.get('is_internal') === '1' ? 1 : 0;
    
    if (!content) {
      return c.text('El contenido es requerido', 400);
    }
    
    await c.env.DB
      .prepare('INSERT INTO messages (ticket_id, user_id, content, is_internal) VALUES (?, ?, ?, ?)')
      .bind(ticketId, user.id, content, isInternal)
      .run();
    
    // Actualizar fecha de actualización del ticket
    await c.env.DB
      .prepare("UPDATE tickets SET updated_at = datetime('now') WHERE id = ?")
      .bind(ticketId)
      .run();
    
    return c.redirect(`/tickets/${ticketId}`);
    
  } catch (error) {
    console.error('Add message error:', error);
    return c.text('Error al añadir mensaje', 500);
  }
});

// ================================================
// RUTAS DE ADMINISTRACIÓN
// ================================================

/**
 * GET /admin - Panel de administración
 */
app.get('/admin', requireAdmin, async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  
  // Obtener lista de usuarios
  const usersResult = user.role === 'super_admin'
    ? await db.prepare('SELECT u.*, t.name as tenant_name FROM users u LEFT JOIN tenants t ON u.tenant_id = t.id ORDER BY u.created_at DESC').all<User & { tenant_name: string }>()
    : await db.prepare('SELECT u.*, t.name as tenant_name FROM users u LEFT JOIN tenants t ON u.tenant_id = t.id WHERE u.tenant_id = ? ORDER BY u.created_at DESC').bind(user.tenant_id).all<User & { tenant_name: string }>();
  
  const users = usersResult.results || [];
  
  // Obtener lista de tenants (solo super_admin)
  let tenants: Tenant[] = [];
  if (user.role === 'super_admin') {
    const tenantsResult = await db.prepare('SELECT * FROM tenants ORDER BY created_at DESC').all<Tenant>();
    tenants = tenantsResult.results || [];
  }
  
  return c.html(
    <Layout title="Administración" user={user}>
      <div class="space-y-6">
        <h1 class="text-2xl font-bold text-gray-900">Panel de Administración</h1>
        
        {/* Acciones rápidas */}
        <div class="flex flex-wrap gap-3">
          <a 
            href="/admin/users/new" 
            class="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            👤 Nuevo Usuario
          </a>
          {user.role === 'super_admin' && (
            <a 
              href="/admin/tenants/new" 
              class="inline-flex items-center px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700"
            >
              🏢 Nueva Organización
            </a>
          )}
          <a 
            href="/admin/tenants" 
            class="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
          >
            🏢 Gestionar Organizaciones
          </a>
        </div>
        
        {/* Estadísticas rápidas */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
              <span class="text-2xl">👥</span>
              <span class="text-3xl font-bold text-gray-900">{users.length}</span>
            </div>
            <p class="mt-2 text-sm font-medium text-gray-600">Usuarios</p>
          </div>
          {user.role === 'super_admin' && (
            <div class="bg-white rounded-lg shadow p-6">
              <div class="flex items-center justify-between">
                <span class="text-2xl">🏢</span>
                <span class="text-3xl font-bold text-gray-900">{tenants.length}</span>
              </div>
              <p class="mt-2 text-sm font-medium text-gray-600">Organizaciones</p>
            </div>
          )}
        </div>
        
        {/* Lista de usuarios */}
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 class="text-lg font-semibold text-gray-900">Usuarios</h2>
            <a href="/admin/users/new" class="text-sm text-blue-600 hover:text-blue-700 font-medium">
              + Nuevo Usuario
            </a>
          </div>
          
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                  {user.role === 'super_admin' && (
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organización</th>
                  )}
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  {user.role === 'super_admin' && (
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.id} class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                        u.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                        u.role === 'agent' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    {user.role === 'super_admin' && (
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {u.tenant_name || '—'}
                      </td>
                    )}
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {user.role === 'super_admin' && (
                      <td class="px-6 py-4 whitespace-nowrap">
                        {u.id !== user.id ? (
                          <form method="post" action={`/admin/users/${u.id}/delete`} 
                            onsubmit="return confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.')">
                            <button type="submit" class="text-red-600 hover:text-red-800 text-sm font-medium">
                              Eliminar
                            </button>
                          </form>
                        ) : (
                          <span class="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Lista de organizaciones (solo super_admin) */}
        {user.role === 'super_admin' && (
          <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 class="text-lg font-semibold text-gray-900">Organizaciones</h2>
              <a href="/admin/tenants/new" class="text-sm text-purple-600 hover:text-purple-700 font-medium">
                + Nueva Organización
              </a>
            </div>
            
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dominio</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Creado</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {tenants.map((t) => (
                    <tr key={t.id} class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{t.name}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.slug}</td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          t.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {t.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(t.created_at).toLocaleDateString('es-ES')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
});

/**
 * GET /admin/users/new - Formulario para crear usuario
 */
app.get('/admin/users/new', requireAdmin, async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  
  // Obtener tenants para el select (solo super_admin puede elegir)
  let tenants: Tenant[] = [];
  if (user.role === 'super_admin') {
    const tenantsResult = await db.prepare('SELECT * FROM tenants ORDER BY name').all<Tenant>();
    tenants = tenantsResult.results || [];
  }
  
  return c.html(
    <Layout title="Nuevo Usuario" user={user}>
      <div class="max-w-2xl mx-auto">
        <h1 class="text-2xl font-bold text-gray-900 mb-6">Crear Nuevo Usuario</h1>
        
        <form method="post" action="/admin/users" class="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input 
              type="text" 
              name="name" 
              required
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              name="email" 
              required
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input 
              type="password" 
              name="password" 
              required
              minLength={8}
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Rol</label>
            <select 
              name="role" 
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="user">Usuario</option>
              <option value="agent">Agente</option>
              <option value="admin">Administrador</option>
              {user.role === 'super_admin' && (
                <option value="super_admin">Super Admin</option>
              )}
            </select>
          </div>
          
          {user.role === 'super_admin' && tenants.length > 0 && (
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Organización</label>
              <select 
                name="tenant_id" 
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
          
          <div class="flex justify-end space-x-3">
            <a href="/admin" class="px-4 py-2 text-gray-700 hover:text-gray-900">Cancelar</a>
            <button 
              type="submit"
              class="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            >
              Crear Usuario
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
});

/**
 * POST /admin/users - Crear usuario
 */
app.post('/admin/users', requireAdmin, async (c) => {
  const user = c.get('user')!;
  
  try {
    const formData = await c.req.formData();
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;
    const tenantId = user.role === 'super_admin' 
      ? formData.get('tenant_id') as string 
      : user.tenant_id?.toString();
    
    if (!name || !email || !password) {
      return c.text('Todos los campos son requeridos', 400);
    }
    
    // Generar hash de contraseña
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const storedHash = `${salt}:${passwordHash}`;
    
    await c.env.DB
      .prepare('INSERT INTO users (tenant_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)')
      .bind(tenantId ? parseInt(tenantId) : null, email, storedHash, name, role)
      .run();
    
    return c.redirect('/admin');
    
  } catch (error) {
    console.error('Create user error:', error);
    return c.text('Error al crear usuario', 500);
  }
});

/**
 * POST /admin/users/:id/delete - Eliminar usuario (solo super_admin)
 */
app.post('/admin/users/:id/delete', requireAdmin, async (c) => {
  const user = c.get('user')!;
  const userId = parseInt(c.req.param('id'));
  
  // Solo super_admin puede eliminar usuarios
  if (user.role !== 'super_admin') {
    return c.text('No autorizado', 403);
  }
  
  // No permitir eliminarse a sí mismo
  if (userId === user.id) {
    return c.text('No puedes eliminarte a ti mismo', 400);
  }
  
  try {
    // Eliminar tickets del usuario primero (por integridad referencial)
    await c.env.DB
      .prepare('DELETE FROM messages WHERE ticket_id IN (SELECT id FROM tickets WHERE created_by = ?)')
      .bind(userId)
      .run();
    
    await c.env.DB
      .prepare('DELETE FROM tickets WHERE created_by = ?')
      .bind(userId)
      .run();
    
    // Eliminar el usuario
    await c.env.DB
      .prepare('DELETE FROM users WHERE id = ?')
      .bind(userId)
      .run();
    
    return c.redirect('/admin');
    
  } catch (error) {
    console.error('Delete user error:', error);
    return c.text('Error al eliminar usuario', 500);
  }
});

// ================================================
// RUTAS DE GESTIÓN DE ORGANIZACIONES
// ================================================

/**
 * GET /admin/tenants/new - Formulario para crear organización
 */
app.get('/admin/tenants/new', requireAdmin, async (c) => {
  const user = c.get('user')!;
  
  // Solo super_admin puede crear organizaciones
  if (user.role !== 'super_admin') {
    return c.redirect('/admin');
  }
  
  return c.html(
    <Layout title="Nueva Organización" user={user}>
      <div class="max-w-lg mx-auto">
        <div class="mb-6">
          <a href="/admin" class="text-blue-600 hover:text-blue-700 text-sm">
            ← Volver a Administración
          </a>
        </div>
        
        <div class="bg-white rounded-lg shadow p-6">
          <h1 class="text-xl font-bold text-gray-900 mb-6">Nueva Organización</h1>
          
          <form method="post" action="/admin/tenants" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Nombre de la Organización *
              </label>
              <input 
                type="text" 
                name="name" 
                required
                placeholder="Ej: Maderas Nativas SpA"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <p class="mt-1 text-xs text-gray-500">
                Nombre comercial o razón social de la empresa
              </p>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Dominio de Email *
              </label>
              <input 
                type="text" 
                name="domain" 
                required
                placeholder="Ej: maderas.cl"
                pattern="^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <p class="mt-1 text-xs text-gray-500">
                Los usuarios con emails de este dominio podrán registrarse en esta organización
              </p>
            </div>
            
            <div class="flex justify-end space-x-3 pt-4">
              <a href="/admin" class="px-4 py-2 text-gray-700 hover:text-gray-900">
                Cancelar
              </a>
              <button 
                type="submit"
                class="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700"
              >
                Crear Organización
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
});

/**
 * POST /admin/tenants - Crear organización
 */
app.post('/admin/tenants', requireAdmin, async (c) => {
  const user = c.get('user')!;
  
  // Solo super_admin puede crear organizaciones
  if (user.role !== 'super_admin') {
    return c.text('No autorizado', 403);
  }
  
  try {
    const formData = await c.req.formData();
    const name = (formData.get('name') as string)?.trim();
    const domain = (formData.get('domain') as string)?.toLowerCase().trim();
    
    if (!name || !domain) {
      return c.text('Nombre y dominio son requeridos', 400);
    }
    
    // Verificar que el dominio no exista ya
    const existing = await c.env.DB
      .prepare('SELECT id FROM tenants WHERE slug = ?')
      .bind(domain)
      .first();
    
    if (existing) {
      return c.html(
        <Layout title="Error" user={user}>
          <div class="max-w-lg mx-auto">
            <div class="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 class="text-lg font-semibold text-red-800 mb-2">Error</h2>
              <p class="text-red-700 mb-4">
                Ya existe una organización con el dominio "{domain}".
              </p>
              <a href="/admin/tenants/new" class="text-red-600 hover:text-red-700 font-medium">
                ← Volver al formulario
              </a>
            </div>
          </div>
        </Layout>
      );
    }
    
    // Crear organización con el dominio como allowed_domains
    await c.env.DB
      .prepare('INSERT INTO tenants (name, slug, allowed_domains) VALUES (?, ?, ?)')
      .bind(name, domain, JSON.stringify([domain]))
      .run();
    
    return c.redirect('/admin');
    
  } catch (error) {
    console.error('Create tenant error:', error);
    return c.text('Error al crear organización', 500);
  }
});

// ================================================
// RUTAS DE GESTIÓN DE ORGANIZACIONES
// ================================================

/**
 * GET /admin/tenants - Lista de organizaciones
 */
app.get('/admin/tenants', requireAdmin, async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  
  // Obtener tenant del usuario (o todos si es super_admin)
  let tenants: (Tenant & { domains: string[], userCount: number })[] = [];
  
  if (user.role === 'super_admin') {
    const result = await db.prepare(`
      SELECT t.*, 
             (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count
      FROM tenants t 
      ORDER BY t.name
    `).all<Tenant & { user_count: number }>();
    tenants = (result.results || []).map(t => ({
      ...t,
      domains: JSON.parse(t.allowed_domains || '[]'),
      userCount: t.user_count || 0
    }));
  } else if (user.tenant_id) {
    const tenant = await db.prepare(`
      SELECT t.*, 
             (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count
      FROM tenants t 
      WHERE t.id = ?
    `).bind(user.tenant_id).first<Tenant & { user_count: number }>();
    if (tenant) {
      tenants = [{
        ...tenant,
        domains: JSON.parse(tenant.allowed_domains || '[]'),
        userCount: tenant.user_count || 0
      }];
    }
  }
  
  return c.html(
    <Layout title="Organizaciones" user={user}>
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Organizaciones</h1>
            <p class="mt-1 text-sm text-gray-600">
              Selecciona una organización para gestionar sus dominios y configuración
            </p>
          </div>
          <div class="flex gap-3">
            {user.role === 'super_admin' && (
              <a 
                href="/admin/tenants/new" 
                class="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 text-sm"
              >
                + Nueva Organización
              </a>
            )}
            <a href="/admin" class="text-blue-600 hover:text-blue-700 text-sm py-2">
              ← Volver
            </a>
          </div>
        </div>
        
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <a 
              key={tenant.id} 
              href={`/admin/tenants/${tenant.id}`}
              class="block bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div class="p-6">
                <div class="flex items-start justify-between">
                  <div>
                    <h2 class="text-lg font-semibold text-gray-900">{tenant.name}</h2>
                    <p class="text-sm text-gray-500 mt-1">Dominio: {tenant.slug}</p>
                  </div>
                  <span class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    tenant.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {tenant.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                
                <div class="mt-4 flex items-center justify-between text-sm">
                  <span class="text-gray-600">
                    <span class="font-medium">{tenant.userCount}</span> usuarios
                  </span>
                  <span class="text-gray-600">
                    <span class="font-medium">{tenant.domains.length}</span> dominios
                  </span>
                </div>
                
                <div class="mt-3 text-blue-600 text-sm font-medium">
                  Gestionar →
                </div>
              </div>
            </a>
          ))}
        </div>
        
        {tenants.length === 0 && (
          <div class="text-center py-12 bg-white rounded-lg shadow">
            <p class="text-gray-500">No hay organizaciones disponibles</p>
          </div>
        )}
      </div>
    </Layout>
  );
});

/**
 * GET /admin/tenants/:id - Detalle y gestión de una organización
 */
app.get('/admin/tenants/:id', requireAdmin, async (c) => {
  const user = c.get('user')!;
  const tenantId = parseInt(c.req.param('id'));
  
  // Verificar acceso
  if (user.role !== 'super_admin' && user.tenant_id !== tenantId) {
    return c.redirect('/admin/tenants');
  }
  
  const tenant = await c.env.DB
    .prepare('SELECT * FROM tenants WHERE id = ?')
    .bind(tenantId)
    .first<Tenant>();
  
  if (!tenant) {
    return c.redirect('/admin/tenants');
  }
  
  const domains: string[] = JSON.parse(tenant.allowed_domains || '[]');
  
  // Obtener usuarios de esta organización
  const usersResult = await c.env.DB
    .prepare('SELECT id, name, email, role, is_active FROM users WHERE tenant_id = ? ORDER BY name')
    .bind(tenantId)
    .all<{ id: number; name: string; email: string; role: string; is_active: number }>();
  const users = usersResult.results || [];
  
  return c.html(
    <Layout title={tenant.name} user={user}>
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">{tenant.name}</h1>
            <p class="mt-1 text-sm text-gray-600">ID: {tenant.slug}</p>
          </div>
          <a href="/admin/tenants" class="text-blue-600 hover:text-blue-700 text-sm">
            ← Volver a Organizaciones
          </a>
        </div>
        
        {/* Dominios permitidos */}
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">Dominios Permitidos</h2>
            <p class="text-sm text-gray-500">Los usuarios con estos dominios pueden registrarse</p>
          </div>
          
          <div class="p-6">
            {/* Lista de dominios actuales */}
            <div class="mb-4">
              {domains.length > 0 ? (
                <div class="flex flex-wrap gap-2">
                  {domains.map((domain) => (
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                      {domain}
                      <form method="post" action={`/admin/tenants/${tenant.id}/domains/remove`} class="inline ml-2">
                        <input type="hidden" name="domain" value={domain} />
                        <button type="submit" class="text-blue-600 hover:text-red-600" title="Eliminar">
                          ×
                        </button>
                      </form>
                    </span>
                  ))}
                </div>
              ) : (
                <p class="text-sm text-gray-500 italic">
                  No hay dominios configurados. Los usuarios no pueden registrarse en esta organización.
                </p>
              )}
            </div>
            
            {/* Formulario para añadir dominio */}
            <form method="post" action={`/admin/tenants/${tenant.id}/domains/add`} class="flex gap-2">
              <input 
                type="text" 
                name="domain" 
                required
                placeholder="ejemplo.com"
                pattern="^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$"
                class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button 
                type="submit"
                class="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
              >
                Añadir dominio
              </button>
            </form>
          </div>
        </div>
        
        {/* Usuarios de esta organización */}
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">Usuarios ({users.length})</h2>
          </div>
          
          {users.length > 0 ? (
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {users.map((u) => (
                    <tr key={u.id} class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.name}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          u.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                          u.role === 'agent' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {u.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div class="p-6 text-center text-gray-500">
              No hay usuarios en esta organización
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
});

/**
 * POST /admin/tenants/:tenantId/domains/add - Añadir dominio permitido
 */
app.post('/admin/tenants/:tenantId/domains/add', requireAdmin, async (c) => {
  const user = c.get('user')!;
  const tenantId = parseInt(c.req.param('tenantId'));
  
  // Verificar acceso
  if (user.role !== 'super_admin' && user.tenant_id !== tenantId) {
    return c.text('No autorizado', 403);
  }
  
  try {
    const formData = await c.req.formData();
    const domain = (formData.get('domain') as string)?.toLowerCase().trim();
    
    if (!domain) {
      return c.redirect(`/admin/tenants/${tenantId}`);
    }
    
    // Obtener dominios actuales
    const tenant = await c.env.DB
      .prepare('SELECT allowed_domains FROM tenants WHERE id = ?')
      .bind(tenantId)
      .first<{ allowed_domains: string }>();
    
    if (!tenant) {
      return c.text('Tenant no encontrado', 404);
    }
    
    const domains: string[] = JSON.parse(tenant.allowed_domains || '[]');
    
    // Añadir si no existe
    if (!domains.includes(domain)) {
      domains.push(domain);
      await c.env.DB
        .prepare('UPDATE tenants SET allowed_domains = ? WHERE id = ?')
        .bind(JSON.stringify(domains), tenantId)
        .run();
    }
    
    return c.redirect(`/admin/tenants/${tenantId}`);
    
  } catch (error) {
    console.error('Add domain error:', error);
    return c.text('Error al añadir dominio', 500);
  }
});

/**
 * POST /admin/tenants/:tenantId/domains/remove - Eliminar dominio permitido
 */
app.post('/admin/tenants/:tenantId/domains/remove', requireAdmin, async (c) => {
  const user = c.get('user')!;
  const tenantId = parseInt(c.req.param('tenantId'));
  
  // Verificar acceso
  if (user.role !== 'super_admin' && user.tenant_id !== tenantId) {
    return c.text('No autorizado', 403);
  }
  
  try {
    const formData = await c.req.formData();
    const domain = (formData.get('domain') as string)?.toLowerCase().trim();
    
    if (!domain) {
      return c.redirect(`/admin/tenants/${tenantId}`);
    }
    
    // Obtener dominios actuales
    const tenant = await c.env.DB
      .prepare('SELECT allowed_domains FROM tenants WHERE id = ?')
      .bind(tenantId)
      .first<{ allowed_domains: string }>();
    
    if (!tenant) {
      return c.text('Tenant no encontrado', 404);
    }
    
    let domains: string[] = JSON.parse(tenant.allowed_domains || '[]');
    
    // Eliminar dominio
    domains = domains.filter(d => d !== domain);
    
    await c.env.DB
      .prepare('UPDATE tenants SET allowed_domains = ? WHERE id = ?')
      .bind(JSON.stringify(domains), tenantId)
      .run();
    
    return c.redirect(`/admin/tenants/${tenantId}`);
    
  } catch (error) {
    console.error('Remove domain error:', error);
    return c.text('Error al eliminar dominio', 500);
  }
});

// ================================================
// EXPORTAR APP
// ================================================

export default app;
