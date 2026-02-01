/**
 * ActionQ - Rutas de Administración
 * 
 * Maneja el panel de admin, usuarios, tenants y configuración.
 */

import { Hono } from 'hono';
import type { AppEnv, Tenant, User } from '../types';
import { Layout } from '../views/Layout';
import { 
  requireAuth,
  requireAdmin,
  requireAgentManager,
  requireSuperAdmin,
  hashPassword,
  generateSalt
} from '../middleware/auth';
import { formatDate } from '../utils';
import { 
  TIMEZONES,
  SESSION_TIMEOUT_OPTIONS 
} from '../config/constants';
import { 
  getSystemConfig, 
  setTimezone, 
  setSessionTimeout,
  setPendingAutoResolveDays,
  setAutoAssignEnabled,
  setEmailEnabled,
  setEmailProvider,
  setOtpEnabled,
  getZeptoMailTemplates,
  setZeptoMailTemplates
} from '../services/config.service';
import {
  sendEmail,
  sendEmailWithTemplate,
  getEmailConfig,
  testEmailTemplate
} from '../services/email.service';

const adminRoutes = new Hono<AppEnv>();


// ================================================
// RUTAS DE ADMINISTRACIÓN
// ================================================

/**
 * GET /admin - Panel de administración
 */
adminRoutes.get('/admin', requireAdmin, async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  
  // Para org_admin: mostrar solo usuarios de su organización
  if (user.role === 'org_admin') {
    // Obtener nombre de la organización
    const tenant = await db.prepare('SELECT name FROM tenants WHERE id = ?')
      .bind(user.tenant_id)
      .first<{ name: string }>();
    const tenantName = tenant?.name || 'Mi Organización';
    
    // Obtener usuarios de su organización
    const usersResult = await db.prepare('SELECT id, name, email, role, is_active FROM users WHERE tenant_id = ? ORDER BY name')
      .bind(user.tenant_id)
      .all<{ id: number; name: string; email: string; role: string; is_active: number }>();
    const orgUsers = usersResult.results || [];
    
    return c.html(
      <Layout title="Administración" user={user} sessionTimeoutMinutes={c.get('sessionTimeoutMinutes')}>
        <div class="space-y-6">
          <h1 class="text-2xl font-bold text-gray-900">Panel de Administración</h1>
          
          {/* Estadísticas */}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-white rounded-lg shadow p-6">
              <div class="flex items-center justify-between">
                <span class="text-2xl">👥</span>
                <span class="text-3xl font-bold text-gray-900">{orgUsers.length}</span>
              </div>
              <p class="mt-2 text-sm font-medium text-gray-600">Usuarios de {tenantName}</p>
            </div>
          </div>
          
          {/* Lista de usuarios de la organización */}
          <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900">Usuarios de {tenantName}</h2>
            </div>
            
            {orgUsers.length > 0 ? (
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    {orgUsers.map((u) => (
                      <tr key={u.id} class="hover:bg-gray-50">
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.name}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            u.role === 'org_admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {u.role === 'org_admin' ? 'Admin. Org.' : 'Usuario'}
                          </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <span class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {u.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          {u.id !== user.id ? (
                            <form method="post" action={`/admin/tenants/${user.tenant_id}/users/${u.id}/toggle`}>
                              <button 
                                type="submit" 
                                class={`text-sm font-medium ${
                                  u.is_active 
                                    ? 'text-red-600 hover:text-red-800' 
                                    : 'text-green-600 hover:text-green-800'
                                }`}
                              >
                                {u.is_active ? 'Desactivar' : 'Activar'}
                              </button>
                            </form>
                          ) : (
                            <span class="text-gray-400 text-sm">—</span>
                          )}
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
  }
  
  // Para super_admin: mostrar equipo interno y organizaciones
  // Obtener lista de usuarios del equipo interno (solo super_admin, agent_admin, agent)
  const usersResult = await db.prepare("SELECT u.*, t.name as tenant_name FROM users u LEFT JOIN tenants t ON u.tenant_id = t.id WHERE u.role IN ('super_admin', 'agent_admin', 'agent') ORDER BY u.created_at DESC").all<User & { tenant_name: string }>();
  
  const users = usersResult.results || [];
  
  // Obtener lista de tenants (solo super_admin)
  let tenants: Tenant[] = [];
  if (user.role === 'super_admin') {
    const tenantsResult = await db.prepare('SELECT * FROM tenants ORDER BY created_at DESC').all<Tenant>();
    tenants = tenantsResult.results || [];
  }
  
  return c.html(
    <Layout title="Administración" user={user} sessionTimeoutMinutes={c.get('sessionTimeoutMinutes')}>
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
          {user.role === 'super_admin' && (
            <a 
              href="/admin/tenants" 
              class="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
            >
              🏢 Gestionar Organizaciones
            </a>
          )}
          {user.role === 'super_admin' && (
            <a 
              href="/admin/settings" 
              class="inline-flex items-center px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700"
            >
              ⚙️ Configuración del Sistema
            </a>
          )}
        </div>
        
        {/* Estadísticas rápidas */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
              <span class="text-2xl">👥</span>
              <span class="text-3xl font-bold text-gray-900">{users.length}</span>
            </div>
            <p class="mt-2 text-sm font-medium text-gray-600">Equipo Interno</p>
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
        
        {/* Lista de usuarios del equipo interno */}
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 class="text-lg font-semibold text-gray-900">Equipo Interno</h2>
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
                        u.role === 'org_admin' ? 'bg-blue-100 text-blue-800' :
                        u.role === 'agent_admin' ? 'bg-indigo-100 text-indigo-800' :
                        u.role === 'agent' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {u.role === 'agent_admin' ? 'Admin. Agentes' : 
                         u.role === 'org_admin' ? 'Admin. Org.' : u.role}
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
                        {formatDate(t.created_at, c.get('timezone'), { dateOnly: true })}
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
adminRoutes.get('/admin/users/new', requireAdmin, async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  
  // Obtener tenants para el select (solo super_admin puede elegir)
  let tenants: Tenant[] = [];
  if (user.role === 'super_admin') {
    const tenantsResult = await db.prepare('SELECT * FROM tenants ORDER BY name').all<Tenant>();
    tenants = tenantsResult.results || [];
  }
  
  return c.html(
    <Layout title="Nuevo Usuario" user={user} sessionTimeoutMinutes={c.get('sessionTimeoutMinutes')}>
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
              {user.role === 'super_admin' && (
                <>
                  <option value="agent">Agente</option>
                  <option value="agent_admin">Administrador de Agentes</option>
                </>
              )}
              <option value="org_admin">Administrador de Organización</option>
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
adminRoutes.post('/admin/users', requireAdmin, async (c) => {
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
adminRoutes.post('/admin/users/:id/delete', requireAdmin, async (c) => {
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
    // Verificar si el usuario tiene tickets creados
    const ticketCount = await c.env.DB
      .prepare('SELECT COUNT(*) as count FROM tickets WHERE created_by = ?')
      .bind(userId)
      .first<{ count: number }>();
    
    if (ticketCount && ticketCount.count > 0) {
      return c.text(`No se puede eliminar el usuario porque tiene ${ticketCount.count} ticket(s) asociado(s). Desactívalo en su lugar.`, 400);
    }
    
    // Quitar asignaciones de tickets
    await c.env.DB
      .prepare('UPDATE tickets SET assigned_to = NULL WHERE assigned_to = ?')
      .bind(userId)
      .run();
    
    // Eliminar mensajes del usuario
    await c.env.DB
      .prepare('DELETE FROM messages WHERE user_id = ?')
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
adminRoutes.get('/admin/tenants/new', requireAdmin, async (c) => {
  const user = c.get('user')!;
  
  // Solo super_admin puede crear organizaciones
  if (user.role !== 'super_admin') {
    return c.redirect('/admin');
  }
  
  return c.html(
    <Layout title="Nueva Organización" user={user} sessionTimeoutMinutes={c.get('sessionTimeoutMinutes')}>
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
adminRoutes.post('/admin/tenants', requireAdmin, async (c) => {
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
        <Layout title="Error" user={user} sessionTimeoutMinutes={c.get('sessionTimeoutMinutes')}>
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
// API ENDPOINTS
// ================================================

/**
 * GET /api/tenants/:id/users - Obtener usuarios de una organización
 * Solo accesible por equipo interno (super_admin, agent_admin, agent)
 */
adminRoutes.get('/api/tenants/:id/users', requireAuth, async (c) => {
  const user = c.get('user')!;
  
  // Solo equipo interno puede acceder a usuarios de cualquier organización
  if (!['super_admin', 'agent_admin', 'agent'].includes(user.role)) {
    return c.json({ error: 'No autorizado' }, 403);
  }
  
  const tenantId = parseInt(c.req.param('id'));
  
  const result = await c.env.DB
    .prepare('SELECT id, name, email FROM users WHERE tenant_id = ? AND is_active = 1 ORDER BY name')
    .bind(tenantId)
    .all<{ id: number; name: string; email: string }>();
  
  return c.json(result.results || []);
});

// ================================================
// RUTAS DE GESTIÓN DE ORGANIZACIONES
// ================================================

/**
 * GET /admin/tenants - Lista de organizaciones
 * Solo super_admin puede acceder
 */
adminRoutes.get('/admin/tenants', requireAdmin, async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  
  // Solo super_admin puede ver esta página
  if (user.role !== 'super_admin') {
    return c.redirect('/admin');
  }
  
  // Obtener todas las organizaciones
  let tenants: (Tenant & { domains: string[], userCount: number })[] = [];
  
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
  
  return c.html(
    <Layout title="Organizaciones" user={user} sessionTimeoutMinutes={c.get('sessionTimeoutMinutes')}>
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
adminRoutes.get('/admin/tenants/:id', requireAdmin, async (c) => {
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
    <Layout title={tenant.name} user={user} sessionTimeoutMinutes={c.get('sessionTimeoutMinutes')}>
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-3">
            <div>
              <h1 class="text-2xl font-bold text-gray-900">{tenant.name}</h1>
              <p class="mt-1 text-sm text-gray-600">ID: {tenant.slug}</p>
            </div>
            <span class={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              tenant.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {tenant.is_active ? 'Activa' : 'Inactiva'}
            </span>
          </div>
          <div class="flex items-center gap-3">
            <form method="post" action={`/admin/tenants/${tenant.id}/toggle`}>
              <button 
                type="submit" 
                class={`px-4 py-2 text-sm font-medium rounded-lg ${
                  tenant.is_active 
                    ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {tenant.is_active ? 'Desactivar Organización' : 'Activar Organización'}
              </button>
            </form>
            <a href="/admin/tenants" class="text-blue-600 hover:text-blue-700 text-sm">
              ← Volver
            </a>
          </div>
        </div>
        
        {!tenant.is_active && (
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <p class="text-red-800 text-sm">
              <strong>Organización inactiva:</strong> Los usuarios de esta organización no pueden iniciar sesión ni registrarse.
            </p>
          </div>
        )}
        
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
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {users.map((u) => (
                    <tr key={u.id} class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.name}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          u.role === 'org_admin' ? 'bg-blue-100 text-blue-800' :
                          u.role === 'agent_admin' ? 'bg-indigo-100 text-indigo-800' :
                          u.role === 'agent' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {u.role === 'agent_admin' ? 'Admin. Agentes' : 
                           u.role === 'org_admin' ? 'Admin. Org.' : u.role}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {u.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap flex gap-2">
                        <form method="post" action={`/admin/tenants/${tenant.id}/users/${u.id}/toggle`}>
                          <button 
                            type="submit" 
                            class={`text-sm font-medium ${
                              u.is_active 
                                ? 'text-red-600 hover:text-red-800' 
                                : 'text-green-600 hover:text-green-800'
                            }`}
                          >
                            {u.is_active ? 'Desactivar' : 'Activar'}
                          </button>
                        </form>
                        {/* Promover a Org Admin - solo para clientes (no tenant principal) */}
                        {user.role === 'super_admin' && tenant.id !== 1 && u.role === 'user' && (
                          <form method="post" action={`/admin/tenants/${tenant.id}/users/${u.id}/promote`}>
                            <button 
                              type="submit" 
                              class="text-sm font-medium text-blue-600 hover:text-blue-800"
                            >
                              Promover a Org Admin
                            </button>
                          </form>
                        )}
                        {/* Quitar Org Admin - solo para clientes (no tenant principal) */}
                        {user.role === 'super_admin' && tenant.id !== 1 && u.role === 'org_admin' && (
                          <form method="post" action={`/admin/tenants/${tenant.id}/users/${u.id}/demote`}>
                            <button 
                              type="submit" 
                              class="text-sm font-medium text-orange-600 hover:text-orange-800"
                            >
                              Quitar Org Admin
                            </button>
                          </form>
                        )}
                        {/* Promover a Agente - solo en tenant principal (equipo interno) */}
                        {['super_admin', 'agent_admin'].includes(user.role) && tenant.id === 1 && u.role === 'user' && (
                          <form method="post" action={`/admin/tenants/${tenant.id}/users/${u.id}/promote-agent`}>
                            <button 
                              type="submit" 
                              class="text-sm font-medium text-green-600 hover:text-green-800"
                            >
                              Promover a Agente
                            </button>
                          </form>
                        )}
                        {/* Quitar Agente - solo en tenant principal */}
                        {['super_admin', 'agent_admin'].includes(user.role) && tenant.id === 1 && u.role === 'agent' && (
                          <form method="post" action={`/admin/tenants/${tenant.id}/users/${u.id}/demote-agent`}>
                            <button 
                              type="submit" 
                              class="text-sm font-medium text-orange-600 hover:text-orange-800"
                            >
                              Quitar Agente
                            </button>
                          </form>
                        )}
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
 * POST /admin/tenants/:id/toggle - Activar/Desactivar organización
 */
adminRoutes.post('/admin/tenants/:id/toggle', requireAdmin, async (c) => {
  const user = c.get('user')!;
  const tenantId = parseInt(c.req.param('id'));
  
  // Solo super_admin puede desactivar organizaciones
  if (user.role !== 'super_admin') {
    return c.text('No autorizado', 403);
  }
  
  try {
    // Obtener estado actual
    const tenant = await c.env.DB
      .prepare('SELECT is_active FROM tenants WHERE id = ?')
      .bind(tenantId)
      .first<{ is_active: number }>();
    
    if (!tenant) {
      return c.text('Organización no encontrada', 404);
    }
    
    // Toggle estado
    await c.env.DB
      .prepare('UPDATE tenants SET is_active = ? WHERE id = ?')
      .bind(tenant.is_active ? 0 : 1, tenantId)
      .run();
    
    return c.redirect(`/admin/tenants/${tenantId}`);
    
  } catch (error) {
    console.error('Toggle tenant error:', error);
    return c.text('Error al cambiar estado de organización', 500);
  }
});

/**
 * POST /admin/tenants/:tenantId/users/:userId/toggle - Activar/Desactivar usuario
 */
adminRoutes.post('/admin/tenants/:tenantId/users/:userId/toggle', requireAdmin, async (c) => {
  const user = c.get('user')!;
  const tenantId = parseInt(c.req.param('tenantId'));
  const userId = parseInt(c.req.param('userId'));
  
  // Verificar acceso (super_admin o admin del mismo tenant)
  if (user.role !== 'super_admin' && user.tenant_id !== tenantId) {
    return c.text('No autorizado', 403);
  }
  
  try {
    // Obtener estado actual del usuario
    const targetUser = await c.env.DB
      .prepare('SELECT is_active, tenant_id FROM users WHERE id = ?')
      .bind(userId)
      .first<{ is_active: number; tenant_id: number }>();
    
    if (!targetUser || targetUser.tenant_id !== tenantId) {
      return c.text('Usuario no encontrado', 404);
    }
    
    // Toggle estado
    await c.env.DB
      .prepare('UPDATE users SET is_active = ? WHERE id = ?')
      .bind(targetUser.is_active ? 0 : 1, userId)
      .run();
    
    return c.redirect(`/admin/tenants/${tenantId}`);
    
  } catch (error) {
    console.error('Toggle user error:', error);
    return c.text('Error al cambiar estado de usuario', 500);
  }
});

/**
 * POST /admin/tenants/:tenantId/users/:userId/promote - Promover usuario a org_admin
 * Solo super_admin puede promover
 */
adminRoutes.post('/admin/tenants/:tenantId/users/:userId/promote', requireSuperAdmin, async (c) => {
  const tenantId = parseInt(c.req.param('tenantId'));
  const userId = parseInt(c.req.param('userId'));
  
  try {
    // Verificar que el usuario existe y pertenece al tenant
    const targetUser = await c.env.DB
      .prepare('SELECT id, tenant_id, role FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: number; tenant_id: number; role: string }>();
    
    if (!targetUser || targetUser.tenant_id !== tenantId) {
      return c.text('Usuario no encontrado', 404);
    }
    
    // Solo promover si es 'user'
    if (targetUser.role !== 'user') {
      return c.text('Solo se pueden promover usuarios con rol "user"', 400);
    }
    
    // Promover a org_admin
    await c.env.DB
      .prepare("UPDATE users SET role = 'org_admin' WHERE id = ?")
      .bind(userId)
      .run();
    
    return c.redirect(`/admin/tenants/${tenantId}`);
    
  } catch (error) {
    console.error('Promote user error:', error);
    return c.text('Error al promover usuario', 500);
  }
});

/**
 * POST /admin/tenants/:tenantId/users/:userId/demote - Degradar org_admin a user
 * Solo super_admin puede degradar
 */
adminRoutes.post('/admin/tenants/:tenantId/users/:userId/demote', requireSuperAdmin, async (c) => {
  const tenantId = parseInt(c.req.param('tenantId'));
  const userId = parseInt(c.req.param('userId'));
  
  try {
    // Verificar que el usuario existe y pertenece al tenant
    const targetUser = await c.env.DB
      .prepare('SELECT id, tenant_id, role FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: number; tenant_id: number; role: string }>();
    
    if (!targetUser || targetUser.tenant_id !== tenantId) {
      return c.text('Usuario no encontrado', 404);
    }
    
    // Solo degradar si es 'org_admin'
    if (targetUser.role !== 'org_admin') {
      return c.text('Solo se pueden degradar usuarios con rol "org_admin"', 400);
    }
    
    // Degradar a user
    await c.env.DB
      .prepare("UPDATE users SET role = 'user' WHERE id = ?")
      .bind(userId)
      .run();
    
    return c.redirect(`/admin/tenants/${tenantId}`);
    
  } catch (error) {
    console.error('Demote user error:', error);
    return c.text('Error al degradar usuario', 500);
  }
});

/**
 * POST /admin/tenants/:tenantId/users/:userId/promote-agent - Promover usuario a agente
 * Solo super_admin y agent_admin pueden promover (solo en tenant principal)
 */
adminRoutes.post('/admin/tenants/:tenantId/users/:userId/promote-agent', requireAgentManager, async (c) => {
  const tenantId = parseInt(c.req.param('tenantId'));
  const userId = parseInt(c.req.param('userId'));
  
  // Solo permitido en el tenant principal (id = 1)
  if (tenantId !== 1) {
    return c.text('Esta acción solo está disponible para el equipo interno', 403);
  }
  
  try {
    // Verificar que el usuario existe y pertenece al tenant
    const targetUser = await c.env.DB
      .prepare('SELECT id, tenant_id, role FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: number; tenant_id: number; role: string }>();
    
    if (!targetUser || targetUser.tenant_id !== tenantId) {
      return c.text('Usuario no encontrado', 404);
    }
    
    // Solo promover si es 'user'
    if (targetUser.role !== 'user') {
      return c.text('Solo se pueden promover usuarios con rol "user"', 400);
    }
    
    // Promover a agent
    await c.env.DB
      .prepare("UPDATE users SET role = 'agent' WHERE id = ?")
      .bind(userId)
      .run();
    
    return c.redirect(`/admin/tenants/${tenantId}`);
    
  } catch (error) {
    console.error('Promote to agent error:', error);
    return c.text('Error al promover usuario a agente', 500);
  }
});

/**
 * POST /admin/tenants/:tenantId/users/:userId/demote-agent - Degradar agente a user
 * Solo super_admin y agent_admin pueden degradar
 */
adminRoutes.post('/admin/tenants/:tenantId/users/:userId/demote-agent', requireAgentManager, async (c) => {
  const tenantId = parseInt(c.req.param('tenantId'));
  const userId = parseInt(c.req.param('userId'));
  
  // Solo permitido en el tenant principal (id = 1)
  if (tenantId !== 1) {
    return c.text('Esta acción solo está disponible para el equipo interno', 403);
  }
  
  try {
    // Verificar que el usuario existe y pertenece al tenant
    const targetUser = await c.env.DB
      .prepare('SELECT id, tenant_id, role FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: number; tenant_id: number; role: string }>();
    
    if (!targetUser || targetUser.tenant_id !== tenantId) {
      return c.text('Usuario no encontrado', 404);
    }
    
    // Solo degradar si es 'agent'
    if (targetUser.role !== 'agent') {
      return c.text('Solo se pueden degradar usuarios con rol "agent"', 400);
    }
    
    // Degradar a user
    await c.env.DB
      .prepare("UPDATE users SET role = 'user' WHERE id = ?")
      .bind(userId)
      .run();
    
    return c.redirect(`/admin/tenants/${tenantId}`);
    
  } catch (error) {
    console.error('Demote agent error:', error);
    return c.text('Error al degradar agente', 500);
  }
});

/**
 * POST /admin/tenants/:tenantId/domains/add - Añadir dominio permitido
 */
adminRoutes.post('/admin/tenants/:tenantId/domains/add', requireAdmin, async (c) => {
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
    
    // Verificar que el dominio no esté ya en otra organización
    const allTenants = await c.env.DB
      .prepare('SELECT id, name, allowed_domains FROM tenants WHERE id != ?')
      .bind(tenantId)
      .all<{ id: number; name: string; allowed_domains: string }>();
    
    for (const t of allTenants.results || []) {
      const otherDomains: string[] = JSON.parse(t.allowed_domains || '[]');
      if (otherDomains.includes(domain)) {
        return c.text(`El dominio "${domain}" ya está asignado a la organización "${t.name}"`, 400);
      }
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
adminRoutes.post('/admin/tenants/:tenantId/domains/remove', requireAdmin, async (c) => {
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
// MÉTRICAS DE AGENTES (super_admin y agent_admin)
// ================================================

/**
 * GET /admin/metrics - Página de métricas y rendimiento de agentes
 */
adminRoutes.get('/admin/metrics', requireAgentManager, async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  const timezone = c.get('timezone');
  
  // Obtener parámetros de filtro de mes
  const url = new URL(c.req.url);
  const monthParam = url.searchParams.get('month'); // formato: YYYY-MM
  
  // Calcular rango de fechas si hay filtro de mes
  let dateFilter = '';
  let dateFilterLabel = 'Todo el tiempo';
  let selectedMonth = '';
  
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    selectedMonth = monthParam;
    const [year, month] = monthParam.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    // Calcular último día del mes
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay} 23:59:59`;
    dateFilter = `AND t.created_at >= '${startDate}' AND t.created_at <= '${endDate}'`;
    
    // Formatear etiqueta del mes
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    dateFilterLabel = `${monthNames[month - 1]} ${year}`;
  }
  
  // Generar lista de meses disponibles (últimos 12 meses)
  const availableMonths: { value: string; label: string }[] = [];
  const now = new Date();
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    availableMonths.push({ value, label });
  }
  
  // 1. Tiempo promedio de resolución (tickets cerrados o esperando respuesta)
  const avgResolutionResult = await db.prepare(`
    SELECT 
      AVG(
        (julianday(t.updated_at) - julianday(t.created_at)) * 24
      ) as avg_hours
    FROM tickets t
    WHERE t.status IN ('closed', 'pending')
      AND t.assigned_to IS NOT NULL
      ${dateFilter}
  `).first<{ avg_hours: number | null }>();
  
  const avgResolutionHours = avgResolutionResult?.avg_hours || 0;
  
  // Formatear tiempo promedio
  let avgResolutionFormatted: string;
  if (avgResolutionHours < 1) {
    avgResolutionFormatted = `${Math.round(avgResolutionHours * 60)} min`;
  } else if (avgResolutionHours < 24) {
    avgResolutionFormatted = `${avgResolutionHours.toFixed(1)} horas`;
  } else {
    avgResolutionFormatted = `${(avgResolutionHours / 24).toFixed(1)} días`;
  }
  
  // 2. Top 5 agentes por tickets cerrados
  const topAgentsByResolvedResult = await db.prepare(`
    SELECT 
      u.id,
      u.name,
      u.email,
      COUNT(t.id) as tickets_resolved,
      AVG((julianday(t.updated_at) - julianday(t.created_at)) * 24) as avg_resolution_hours
    FROM users u
    INNER JOIN tickets t ON t.assigned_to = u.id
    WHERE t.status IN ('closed', 'pending')
      AND u.role IN ('super_admin', 'agent_admin', 'agent')
      ${dateFilter}
    GROUP BY u.id
    ORDER BY tickets_resolved DESC, avg_resolution_hours ASC
    LIMIT 5
  `).all<{
    id: number;
    name: string;
    email: string;
    tickets_resolved: number;
    avg_resolution_hours: number;
  }>();
  
  const topAgentsByResolved = topAgentsByResolvedResult.results || [];
  
  // 3. Top 5 agentes por eficiencia (mejor ratio tickets/tiempo)
  const topAgentsByEfficiencyResult = await db.prepare(`
    SELECT 
      u.id,
      u.name,
      u.email,
      COUNT(t.id) as tickets_resolved,
      AVG((julianday(t.updated_at) - julianday(t.created_at)) * 24) as avg_resolution_hours,
      CASE 
        WHEN AVG((julianday(t.updated_at) - julianday(t.created_at)) * 24) > 0 
        THEN COUNT(t.id) / AVG((julianday(t.updated_at) - julianday(t.created_at)) * 24)
        ELSE 0 
      END as efficiency_score
    FROM users u
    INNER JOIN tickets t ON t.assigned_to = u.id
    WHERE t.status IN ('closed', 'pending')
      AND u.role IN ('super_admin', 'agent_admin', 'agent')
      ${dateFilter}
    GROUP BY u.id
    HAVING tickets_resolved >= 1
    ORDER BY efficiency_score DESC
    LIMIT 5
  `).all<{
    id: number;
    name: string;
    email: string;
    tickets_resolved: number;
    avg_resolution_hours: number;
    efficiency_score: number;
  }>();
  
  const topAgentsByEfficiency = topAgentsByEfficiencyResult.results || [];
  
  // 4. Estadísticas generales
  const statsQuery = dateFilter 
    ? `
      SELECT 
        COUNT(*) as total_tickets,
        SUM(CASE WHEN status IN ('closed', 'pending') THEN 1 ELSE 0 END) as resolved_tickets,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_tickets,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tickets,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tickets,
        SUM(CASE WHEN assigned_to IS NOT NULL THEN 1 ELSE 0 END) as assigned_tickets
      FROM tickets t
      WHERE 1=1 ${dateFilter}
    `
    : `
      SELECT 
        COUNT(*) as total_tickets,
        SUM(CASE WHEN status IN ('closed', 'pending') THEN 1 ELSE 0 END) as resolved_tickets,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_tickets,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tickets,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tickets,
        SUM(CASE WHEN assigned_to IS NOT NULL THEN 1 ELSE 0 END) as assigned_tickets
      FROM tickets
    `;
  
  const statsResult = await db.prepare(statsQuery).first<{
    total_tickets: number;
    resolved_tickets: number;
    open_tickets: number;
    in_progress_tickets: number;
    pending_tickets: number;
    assigned_tickets: number;
  }>();
  
  const stats = {
    total: statsResult?.total_tickets || 0,
    resolved: statsResult?.resolved_tickets || 0,
    open: statsResult?.open_tickets || 0,
    inProgress: statsResult?.in_progress_tickets || 0,
    pending: statsResult?.pending_tickets || 0,
    assigned: statsResult?.assigned_tickets || 0,
  };
  
  // Calcular ratio asignados/cerrados
  const assignedResolvedRatio = stats.assigned > 0 
    ? ((stats.resolved / stats.assigned) * 100).toFixed(1)
    : '0';
  
  // 5. Tickets sin asignar (esto siempre muestra el estado actual, no filtrado por mes)
  const unassignedResult = await db.prepare(`
    SELECT COUNT(*) as count FROM tickets WHERE assigned_to IS NULL AND status NOT IN ('closed', 'pending')
  `).first<{ count: number }>();
  
  const unassignedTickets = unassignedResult?.count || 0;
  
  // Helper para formatear horas
  const formatHours = (hours: number): string => {
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };
  
  return c.html(
    <Layout title="Métricas de Agentes" user={user} sessionTimeoutMinutes={c.get('sessionTimeoutMinutes')}>
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 class="text-2xl font-bold text-gray-900">📊 Métricas de Agentes</h1>
          <div class="flex items-center gap-4">
            <a href="/admin" class="text-sm text-blue-600 hover:text-blue-700">
              ← Volver al panel
            </a>
          </div>
        </div>
        
        {/* Filtro de mes */}
        <div class="bg-white rounded-lg shadow p-4">
          <form method="get" action="/admin/metrics" class="flex flex-wrap items-center gap-4">
            <label class="text-sm font-medium text-gray-700">
              📅 Período:
            </label>
            <select 
              name="month" 
              class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              onchange="this.form.submit()"
            >
              <option value="">Todo el tiempo</option>
              {availableMonths.map((m) => (
                <option key={m.value} value={m.value} selected={selectedMonth === m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <noscript>
              <button type="submit" class="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                Filtrar
              </button>
            </noscript>
            {selectedMonth && (
              <a href="/admin/metrics" class="text-sm text-gray-500 hover:text-gray-700">
                ✕ Limpiar filtro
              </a>
            )}
            <span class="ml-auto text-sm text-gray-500">
              Mostrando: <strong class="text-gray-700">{dateFilterLabel}</strong>
            </span>
          </form>
        </div>
        
        {/* Estadísticas generales */}
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div class="bg-white rounded-lg shadow p-4">
            <div class="flex items-center justify-between">
              <span class="text-xl">📊</span>
              <span class="text-2xl font-bold text-gray-900">{stats.total}</span>
            </div>
            <p class="mt-1 text-xs font-medium text-gray-600">Total</p>
          </div>
          <div class="bg-blue-50 rounded-lg shadow p-4">
            <div class="flex items-center justify-between">
              <span class="text-xl">📬</span>
              <span class="text-2xl font-bold text-blue-600">{stats.open}</span>
            </div>
            <p class="mt-1 text-xs font-medium text-gray-600">Abiertos</p>
          </div>
          <div class="bg-yellow-50 rounded-lg shadow p-4">
            <div class="flex items-center justify-between">
              <span class="text-xl">⏳</span>
              <span class="text-2xl font-bold text-yellow-600">{stats.inProgress}</span>
            </div>
            <p class="mt-1 text-xs font-medium text-gray-600">En Progreso</p>
          </div>
          <div class="bg-purple-50 rounded-lg shadow p-4">
            <div class="flex items-center justify-between">
              <span class="text-xl">⏸️</span>
              <span class="text-2xl font-bold text-purple-600">{stats.pending}</span>
            </div>
            <p class="mt-1 text-xs font-medium text-gray-600">Esperando</p>
          </div>
          <div class="bg-green-50 rounded-lg shadow p-4">
            <div class="flex items-center justify-between">
              <span class="text-xl">✅</span>
              <span class="text-2xl font-bold text-green-600">{stats.resolved}</span>
            </div>
            <p class="mt-1 text-xs font-medium text-gray-600">Cerrados*</p>
          </div>
          <div class="bg-red-50 rounded-lg shadow p-4">
            <div class="flex items-center justify-between">
              <span class="text-xl">⚠️</span>
              <span class="text-2xl font-bold text-red-600">{unassignedTickets}</span>
            </div>
            <p class="mt-1 text-xs font-medium text-gray-600">Sin Asignar</p>
            {selectedMonth && <p class="text-xs text-gray-400">(actual)</p>}
          </div>
        </div>
        
        {/* Métricas clave: Tiempo promedio y Ratio */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tiempo promedio de resolución */}
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center space-x-4">
              <div class="flex-shrink-0">
                <div class="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span class="text-3xl">⏱️</span>
                </div>
              </div>
              <div>
                <p class="text-sm font-medium text-gray-500">Tiempo Promedio de Cierre</p>
                <p class="text-3xl font-bold text-indigo-600">{avgResolutionFormatted}</p>
                <p class="text-xs text-gray-400 mt-1">
                  Calculado sobre {stats.resolved} tickets cerrados
                </p>
              </div>
            </div>
          </div>
          
          {/* Ratio Asignados/Cerrados */}
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center space-x-4">
              <div class="flex-shrink-0">
                <div class="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                  <span class="text-3xl">📈</span>
                </div>
              </div>
              <div>
                <p class="text-sm font-medium text-gray-500">Ratio Asignados → Cerrados</p>
                <p class="text-3xl font-bold text-emerald-600">{assignedResolvedRatio}%</p>
                <p class="text-xs text-gray-400 mt-1">
                  {stats.resolved} cerrados de {stats.assigned} asignados
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 5 por tickets cerrados */}
          <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900">🏆 Top 5 - Tickets Cerrados</h2>
              <p class="text-sm text-gray-500">Agentes con más tickets cerrados</p>
            </div>
            
            {topAgentsByResolved.length > 0 ? (
              <ul class="divide-y divide-gray-200">
                {topAgentsByResolved.map((agent, index) => (
                  <li key={agent.id} class="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                    <div class="flex items-center space-x-3">
                      <span class={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        index === 0 ? 'bg-yellow-500' :
                        index === 1 ? 'bg-gray-400' :
                        index === 2 ? 'bg-amber-600' :
                        'bg-gray-300'
                      }`}>
                        {index + 1}
                      </span>
                      <div>
                        <p class="font-medium text-gray-900">{agent.name}</p>
                        <p class="text-sm text-gray-500">{agent.email}</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class="text-lg font-bold text-green-600">{agent.tickets_resolved}</p>
                      <p class="text-xs text-gray-500">
                        ~{formatHours(agent.avg_resolution_hours)} prom.
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div class="px-6 py-12 text-center text-gray-500">
                <span class="text-4xl">📭</span>
                <p class="mt-2">No hay datos de tickets cerrados</p>
              </div>
            )}
          </div>
          
          {/* Top 5 por eficiencia */}
          <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900">⚡ Top 5 - Eficiencia</h2>
              <p class="text-sm text-gray-500">Mejor ratio tickets/tiempo de resolución</p>
            </div>
            
            {topAgentsByEfficiency.length > 0 ? (
              <ul class="divide-y divide-gray-200">
                {topAgentsByEfficiency.map((agent, index) => (
                  <li key={agent.id} class="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                    <div class="flex items-center space-x-3">
                      <span class={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        index === 0 ? 'bg-yellow-500' :
                        index === 1 ? 'bg-gray-400' :
                        index === 2 ? 'bg-amber-600' :
                        'bg-gray-300'
                      }`}>
                        {index + 1}
                      </span>
                      <div>
                        <p class="font-medium text-gray-900">{agent.name}</p>
                        <p class="text-sm text-gray-500">{agent.email}</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class="text-lg font-bold text-indigo-600">
                        {agent.efficiency_score.toFixed(2)}
                      </p>
                      <p class="text-xs text-gray-500">
                        {agent.tickets_resolved} tickets • {formatHours(agent.avg_resolution_hours)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div class="px-6 py-12 text-center text-gray-500">
                <span class="text-4xl">📭</span>
                <p class="mt-2">No hay datos de eficiencia</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Nota explicativa */}
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div class="flex">
            <span class="text-blue-500 text-xl mr-3">ℹ️</span>
            <div class="text-sm text-blue-700">
              <p class="font-medium">¿Cómo se calculan las métricas?</p>
              <ul class="mt-1 list-disc list-inside space-y-1">
                <li><strong>Tiempo de resolución:</strong> Diferencia entre fecha de creación y última actualización del ticket</li>
                <li><strong>Eficiencia:</strong> Tickets cerrados dividido por tiempo promedio de cierre (mayor es mejor)</li>
                <li><strong>Ratio Asignados/Cerrados:</strong> Porcentaje de tickets asignados que han sido cerrados</li>
                <li><strong>*Cerrados:</strong> Incluye tickets en "Esperando respuesta" y "Cerrado" (asignados a un agente)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
});

// ================================================
// CONFIGURACIÓN DEL SISTEMA (solo super_admin)
// ================================================

/**
 * GET /admin/settings - Página de configuración del sistema
 */
adminRoutes.get('/admin/settings', requireAdmin, async (c) => {
  const user = c.get('user')!;
  
  // Solo super_admin puede acceder
  if (user.role !== 'super_admin') {
    return c.text('No autorizado', 403);
  }
  
  // Obtener configuración actual usando el servicio
  const config = await getSystemConfig(c.env.DB);
  const currentTimezone = config.timezone;
  const sessionTimeoutMinutes = config.sessionTimeoutMinutes;
  const pendingAutoResolveDays = config.pendingAutoResolveDays;
  const autoAssignEnabled = config.autoAssignEnabled;
  const emailEnabled = config.emailEnabled;
  const otpEnabled = config.otpEnabled;
  const emailTestTemplateKey = config.emailTestTemplateKey;
  
  // Verificar si ZeptoMail está configurado (solo requiere token y from email)
  const emailConfig = getEmailConfig(c.env);
  const isEmailConfigured = emailConfig.apiToken !== 'not-configured' && emailConfig.fromEmail !== 'noreply@example.com';
  
  // Verificar si se envió un correo de prueba exitosamente
  const testEmailSent = c.req.query('test_email_sent') === 'true';
  
  // Obtener hora actual en la zona horaria configurada
  const now = new Date();
  let currentTimeInTz = '';
  try {
    currentTimeInTz = now.toLocaleString('es-ES', { 
      timeZone: currentTimezone,
      dateStyle: 'full',
      timeStyle: 'long'
    });
  } catch {
    currentTimeInTz = now.toISOString();
  }
  
  return c.html(
    <Layout title="Configuración del Sistema" user={user} sessionTimeoutMinutes={c.get('sessionTimeoutMinutes')}>
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold text-gray-900">⚙️ Configuración del Sistema</h1>
          <a href="/admin" class="text-blue-600 hover:text-blue-700">← Volver al Panel</a>
        </div>
        
        {/* Formulario General de Configuración */}
        <form method="post" action="/admin/settings/save" class="space-y-6" id="settings-form">
          {/* Zona Horaria */}
          <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900">🕐 Zona Horaria</h2>
              <p class="text-sm text-gray-500 mt-1">Configura la zona horaria para mostrar fechas y horas en el sistema.</p>
            </div>
            
            <div class="p-6">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Zona Horaria Actual
                  </label>
                  <select 
                    name="timezone" 
                    class="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {TIMEZONES.map((tz) => (
                      <option 
                        key={tz.value} 
                        value={tz.value} 
                        selected={tz.value === currentTimezone}
                      >
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div class="bg-gray-50 rounded-lg p-4">
                  <p class="text-sm text-gray-600">
                    <strong>Hora actual en {currentTimezone}:</strong>
                  </p>
                  <p class="text-lg font-medium text-gray-900 mt-1">{currentTimeInTz}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Timeout de Sesión */}
          <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900">⏱️ Tiempo de Inactividad</h2>
              <p class="text-sm text-gray-500 mt-1">Configura el tiempo de inactividad antes de cerrar la sesión automáticamente.</p>
            </div>
            
            <div class="p-6">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Tiempo de inactividad (minutos)
                  </label>
                  <select 
                    name="session_timeout_minutes" 
                    class="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {SESSION_TIMEOUT_OPTIONS.map((opt) => (
                      <option 
                        key={opt.value} 
                        value={opt.value} 
                        selected={sessionTimeoutMinutes === opt.value}
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p class="text-sm text-amber-800">
                    <strong>⚠️ Nota:</strong> Cuando queden 30 segundos para cerrar la sesión, 
                    el usuario verá una advertencia con opción de mantener la sesión activa.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Auto-asignación de tickets */}
          <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900">🤖 Auto-asignación de Tickets</h2>
              <p class="text-sm text-gray-500 mt-1">
                Asigna automáticamente los tickets nuevos al agente con menos carga de trabajo.
              </p>
            </div>
            
            <div class="p-6">
              <div class="space-y-4">
                <div class="flex items-center gap-4">
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      name="auto_assign_enabled" 
                      value="true"
                      checked={autoAssignEnabled}
                      class="sr-only peer"
                    />
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span class="ms-3 text-sm font-medium text-gray-700">
                      {autoAssignEnabled ? 'Activado' : 'Desactivado'}
                    </span>
                  </label>
                </div>
                
                <div class={`border rounded-lg p-4 ${autoAssignEnabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <p class={`text-sm ${autoAssignEnabled ? 'text-green-800' : 'text-gray-600'}`}>
                    <strong>ℹ️ Funcionamiento:</strong> Cuando se crea un nuevo ticket, se asignará 
                    automáticamente al agente activo con menos tickets pendientes.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Auto-cierre de tickets en "Esperando respuesta" */}
          <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900">🔄 Auto-cierre de Tickets</h2>
              <p class="text-sm text-gray-500 mt-1">
                Cierra automáticamente los tickets en estado "Esperando respuesta" después de un período de inactividad.
              </p>
            </div>
            
            <div class="p-6">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Días sin respuesta del usuario
                  </label>
                  <select 
                    name="pending_auto_resolve_days" 
                    class="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {[1, 2, 3, 5, 7, 10, 14, 21, 30].map((days) => (
                      <option 
                        key={days} 
                        value={days} 
                        selected={pendingAutoResolveDays === days}
                      >
                        {days} {days === 1 ? 'día' : 'días'}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p class="text-sm text-blue-800">
                    <strong>ℹ️ Funcionamiento:</strong> Cuando un ticket está en "Esperando respuesta" 
                    y el usuario no responde en el tiempo configurado, el ticket se cerrará automáticamente 
                    con una nota indicando el motivo.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Configuración de Correos Electrónicos */}
          <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900">📧 Correos Electrónicos</h2>
              <p class="text-sm text-gray-500 mt-1">
                Configura el envío de notificaciones por correo electrónico.
              </p>
            </div>
            
            <div class="p-6">
              <div class="space-y-6">
                {/* Estado de configuración ZeptoMail */}
                <div class={`p-4 rounded-lg border ${isEmailConfigured ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  {isEmailConfigured ? (
                    <p class="text-sm text-green-800">
                      <strong>✅ ZeptoMail configurado:</strong> Las credenciales de ZeptoMail están configuradas correctamente.
                    </p>
                  ) : (
                    <p class="text-sm text-yellow-800">
                      <strong>⚠️ ZeptoMail no configurado:</strong> Debes configurar las variables de entorno 
                      <code class="mx-1 px-1 bg-yellow-100 rounded">ZEPTOMAIL_TOKEN</code>,
                      <code class="mx-1 px-1 bg-yellow-100 rounded">ZEPTOMAIL_FROM_EMAIL</code> y
                      <code class="mx-1 px-1 bg-yellow-100 rounded">ZEPTOMAIL_FROM_NAME</code> en tu wrangler.toml
                    </p>
                  )}
                </div>
                
                {/* Toggle para habilitar/deshabilitar correos */}
                <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label class="text-sm font-medium text-gray-900">Habilitar envío de correos</label>
                    <p class="text-xs text-gray-500 mt-1">
                      Activa o desactiva todas las notificaciones por correo electrónico del sistema.
                    </p>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      name="email_enabled"
                      value="true"
                      class="sr-only peer"
                      checked={emailEnabled}
                      disabled={!isEmailConfigured}
                    />
                    <div class={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${isEmailConfigured ? 'bg-gray-200 peer-checked:bg-blue-600' : 'bg-gray-300 cursor-not-allowed'}`}></div>
                  </label>
                </div>
                
                {!isEmailConfigured && (
                  <p class="text-xs text-gray-500 italic">
                    * Debes configurar ZeptoMail antes de poder habilitar el envío de correos.
                  </p>
                )}
                
                {/* Selector de Proveedor de Correo */}
                {emailEnabled && isEmailConfigured && (
                  <div class="space-y-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        📨 Proveedor de Correo
                      </label>
                      <select 
                        name="email_provider"
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Seleccionar proveedor...</option>
                        <option value="zeptomail" selected={config.emailProvider === 'zeptomail'}>ZeptoMail</option>
                        <option value="smtp" disabled>SMTP (Próximamente)</option>
                      </select>
                      <p class="text-xs text-gray-500 mt-1">
                        Selecciona el servicio de correo que deseas utilizar.
                      </p>
                    </div>
                    
                    {/* Botón de configuración del proveedor */}
                    {config.emailProvider === 'zeptomail' && (
                      <div class="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div class="flex-1">
                          <p class="text-sm font-medium text-blue-900">Configurar templates de ZeptoMail</p>
                          <p class="text-xs text-blue-600 mt-1">
                            Configura las plantillas para correos de prueba, restablecimiento de contraseña y notificaciones de tickets.
                          </p>
                        </div>
                        <a 
                          href="/admin/settings/email-provider"
                          class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                        >
                          ⚙️ Configurar
                        </a>
                      </div>
                    )}
                    
                    {config.emailProvider === 'smtp' && (
                      <div class="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <p class="text-sm text-gray-600">
                          <span class="inline-block px-2 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded mr-2">Próximamente</span>
                          La configuración de SMTP estará disponible en una próxima actualización.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
        
        {/* Espacio para la barra fija */}
        <div class="h-24"></div>
        
        {/* Prueba de Correo Electrónico */}
        {isEmailConfigured && (
          <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900">🧪 Prueba de Correo</h2>
              <p class="text-sm text-gray-500 mt-1">
                Envía un correo de prueba para verificar que la configuración de ZeptoMail funciona correctamente.
              </p>
            </div>
            
            <div class="p-6">
              {testEmailSent && (
                <div class="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p class="text-sm text-green-800">
                    <strong>✅ Correo enviado:</strong> El correo de prueba se envió exitosamente. Revisa tu bandeja de entrada.
                  </p>
                </div>
              )}
              
              <form method="post" action="/admin/settings/test-email" class="flex flex-col sm:flex-row gap-3">
                <div class="flex-1">
                  <input 
                    type="email" 
                    name="test_email" 
                    placeholder="correo@ejemplo.com"
                    required
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button 
                  type="submit"
                  class={`px-6 py-2 font-medium rounded-lg transition-colors ${emailEnabled ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                  disabled={!emailEnabled}
                >
                  📤 Enviar Prueba
                </button>
              </form>
              
              {!emailEnabled && (
                <p class="mt-3 text-sm text-amber-600">
                  ⚠️ Debes habilitar el envío de correos y guardar los cambios antes de poder enviar una prueba.
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Configuración de OTP */}
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">🔐 Verificación por OTP</h2>
            <p class="text-sm text-gray-500 mt-1">
              Gestiona la autenticación de dos factores con códigos de un solo uso.
            </p>
          </div>
          
          <div class="p-6 space-y-4">
            {/* Toggle para habilitar/deshabilitar OTP */}
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <label class="text-sm font-medium text-gray-900">Habilitar verificación por OTP</label>
                <p class="text-xs text-gray-500 mt-1">
                  Requiere código OTP en registro de usuarios y restablecimiento de contraseña.
                </p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  name="otp_enabled"
                  value="true"
                  class="sr-only peer"
                  checked={otpEnabled}
                />
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            {otpEnabled && (
              <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p class="text-sm text-blue-900">
                  <strong>✅ OTP Habilitado:</strong> Los usuarios deberán verificar su correo con un código de 6 dígitos.
                </p>
                <ul class="text-xs text-blue-800 mt-2 list-disc list-inside space-y-1">
                  <li>Requiere correos habilitados y configurados</li>
                  <li>Código válido por 15 minutos</li>
                  <li>Máximo 3 intentos fallidos por OTP</li>
                </ul>
              </div>
            )}
          </div>
        </div>
        
        {/* Información del Sistema */}
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">ℹ️ Información del Sistema</h2>
          </div>
          
          <div class="p-6">
            <dl class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt class="text-sm font-medium text-gray-500">Aplicación</dt>
                <dd class="text-lg text-gray-900">{c.env.APP_NAME || 'ActionQ'}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500">Versión</dt>
                <dd class="text-lg text-gray-900">{c.env.APP_VERSION || '1.0.0'}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
      
      {/* Barra de guardar fija al final */}
      <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-6 shadow-lg">
        <div class="max-w-7xl mx-auto flex gap-3 justify-end">
          <a 
            href="/admin"
            class="px-6 py-2 text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </a>
          <button 
            type="submit"
            form="settings-form"
            class="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            💾 Guardar Todos los Cambios
          </button>
        </div>
      </div>
    </Layout>
  );
});

/**
 * POST /admin/settings/save - Guardar toda la configuración del sistema
 */
adminRoutes.post('/admin/settings/save', requireAdmin, async (c) => {
  const user = c.get('user')!;
  
  // Solo super_admin puede modificar
  if (user.role !== 'super_admin') {
    return c.text('No autorizado', 403);
  }
  
  try {
    const formData = await c.req.formData();
    
    // Guardar timezone
    const timezone = formData.get('timezone') as string;
    if (timezone) {
      const tzResult = await setTimezone(c.env.DB, timezone);
      if (!tzResult.success) {
        return c.text(tzResult.error || 'Error al guardar zona horaria', 400);
      }
    }
    
    // Guardar session timeout
    const sessionTimeoutMinutes = parseInt(formData.get('session_timeout_minutes') as string, 10);
    if (!isNaN(sessionTimeoutMinutes)) {
      const stResult = await setSessionTimeout(c.env.DB, sessionTimeoutMinutes);
      if (!stResult.success) {
        return c.text(stResult.error || 'Error al guardar tiempo de inactividad', 400);
      }
    }
    
    // Guardar auto-assign enabled
    const autoAssignEnabled = formData.get('auto_assign_enabled') === 'true';
    const aaResult = await setAutoAssignEnabled(c.env.DB, autoAssignEnabled);
    if (!aaResult.success) {
      return c.text(aaResult.error || 'Error al guardar configuración de auto-asignación', 400);
    }
    
    // Guardar pending auto-resolve days
    const pendingAutoResolveDays = parseInt(formData.get('pending_auto_resolve_days') as string, 10);
    if (!isNaN(pendingAutoResolveDays)) {
      const parResult = await setPendingAutoResolveDays(c.env.DB, pendingAutoResolveDays);
      if (!parResult.success) {
        return c.text(parResult.error || 'Error al guardar días de auto-cierre', 400);
      }
    }
    
    // Guardar email enabled
    const emailEnabled = formData.get('email_enabled') === 'true';
    const emailResult = await setEmailEnabled(c.env.DB, emailEnabled);
    if (!emailResult.success) {
      return c.text(emailResult.error || 'Error al guardar configuración de correos', 400);
    }
    
    // Guardar email provider
    const emailProvider = (formData.get('email_provider') as string || '').trim() as 'smtp' | 'zeptomail' | '';
    if (emailProvider) {
      const providerResult = await setEmailProvider(c.env.DB, emailProvider);
      if (!providerResult.success) {
        return c.text(providerResult.error || 'Error al guardar proveedor de correos', 400);
      }
    }
    
    // Guardar OTP enabled
    const otpEnabled = formData.get('otp_enabled') === 'true';
    const otpResult = await setOtpEnabled(c.env.DB, otpEnabled);
    if (!otpResult.success) {
      return c.text(otpResult.error || 'Error al guardar configuración de OTP', 400);
    }
    
    return c.redirect('/admin/settings');
    
  } catch (error) {
    console.error('Save settings error:', error);
    return c.text('Error al guardar configuración del sistema', 500);
  }
});

/**
 * POST /admin/settings/test-email - Enviar correo de prueba
 */
adminRoutes.post('/admin/settings/test-email', requireAdmin, async (c) => {
  const user = c.get('user')!;
  
  // Solo super_admin puede enviar correos de prueba
  if (user.role !== 'super_admin') {
    return c.text('No autorizado', 403);
  }
  
  try {
    const formData = await c.req.formData();
    const testEmail = formData.get('test_email') as string;
    
    if (!testEmail || !testEmail.includes('@')) {
      return c.text('Dirección de correo inválida', 400);
    }
    
    const emailConfig = getEmailConfig(c.env);
    
    // Verificar que ZeptoMail esté configurado
    if (emailConfig.apiToken === 'not-configured') {
      return c.text('ZeptoMail no está configurado. Por favor configura ZEPTOMAIL_TOKEN.', 400);
    }
    
    // Verificar que el envío de correos esté habilitado
    const config = await getSystemConfig(c.env.DB);
    if (!config.emailEnabled) {
      return c.text('El envío de correos está deshabilitado. Habilítalo en la configuración.', 400);
    }
    
    const appName = c.env.APP_NAME || 'ActionQ';
    const appUrl = c.req.url.replace(/\/admin\/settings.*/, '');
    
    // Verificar si hay un template configurado para el proveedor
    let result;
    if (config.emailProvider === 'zeptomail') {
      const templates = await getZeptoMailTemplates(c.env.DB);
      
      if (templates.testEmail) {
        // Usar template de ZeptoMail
        console.log('[Test Email] Usando template de ZeptoMail:', templates.testEmail);
        result = await sendEmailWithTemplate(emailConfig, {
          to: [{ email: testEmail }],
          templateKey: templates.testEmail,
          mergeInfo: {
            recipient_email: testEmail,
            app_name: appName,
            app_url: appUrl,
            test_date: new Date().toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })
          }
        });
      } else {
        // Generar plantilla HTML automática
        console.log('[Test Email] Usando HTML generado automáticamente (sin template configurado)');
        const template = testEmailTemplate(testEmail, appName, appUrl);
        result = await sendEmail(emailConfig, {
          to: [{ email: testEmail }],
          subject: template.subject,
          htmlBody: template.html
        });
      }
    } else {
      // Si no es ZeptoMail o no hay proveedor, usar HTML
      console.log('[Test Email] Usando HTML generado automáticamente');
      const template = testEmailTemplate(testEmail, appName, appUrl);
      result = await sendEmail(emailConfig, {
        to: [{ email: testEmail }],
        subject: template.subject,
        htmlBody: template.html
      });
    }
    
    if (result.success) {
      return c.redirect('/admin/settings?test_email_sent=true');
    } else {
      console.error('Test email error:', result.error);
      return c.text(`Error al enviar correo: ${result.error}`, 500);
    }
    
  } catch (error) {
    console.error('Test email error:', error);
    return c.text('Error al enviar correo de prueba', 500);
  }
});

/**
 * GET /admin/settings/email-provider - Configuración de plantillas del proveedor de email
 */
adminRoutes.get('/admin/settings/email-provider', requireAdmin, async (c) => {
  const user = c.get('user')!;
  
  // Solo super_admin puede configurar proveedores
  if (user.role !== 'super_admin') {
    return c.text('No autorizado', 403);
  }
  
  try {
    const config = await getSystemConfig(c.env.DB);
    
    // Verificar que hay un proveedor seleccionado
    if (!config.emailProvider) {
      return c.redirect('/admin/settings');
    }
    
    // Por ahora solo soportamos ZeptoMail
    if (config.emailProvider !== 'zeptomail') {
      return c.text('Proveedor no soportado', 400);
    }
    
    const templates = await getZeptoMailTemplates(c.env.DB);
    const saveSuccess = c.req.query('success') === 'true';
    
    return c.html(
      <Layout title="Configuración de ZeptoMail" user={user}>
        <div class="max-w-4xl mx-auto">
          {/* Header con navegación */}
          <div class="mb-6 flex items-center justify-between">
            <a 
              href="/admin/settings"
              class="text-blue-600 hover:text-blue-800"
            >
              ← Volver a Configuración
            </a>
            <button
              onclick="document.getElementById('variablesModal').classList.remove('hidden')"
              class="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              📚 Variables Básicas
            </button>
          </div>
          
          <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
              <h1 class="text-2xl font-bold text-gray-900">⚙️ Configuración de ZeptoMail</h1>
              <p class="text-sm text-gray-500 mt-1">
                Configura las plantillas de ZeptoMail para diferentes tipos de correos.
              </p>
            </div>
            
            <div class="p-6">
              {saveSuccess && (
                <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p class="text-sm text-green-800">
                    <strong>✅ Configuración guardada:</strong> Las plantillas de ZeptoMail se guardaron correctamente.
                  </p>
                </div>
              )}
              
              {/* Información de ZeptoMail */}
              <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p class="text-sm text-blue-800">
                  <strong>ℹ️ Acerca de las plantillas:</strong> Las plantillas deben estar creadas en tu cuenta de ZeptoMail. 
                  Puedes obtener el template key desde el dashboard de ZeptoMail en la sección de Templates.
                </p>
                <p class="text-sm text-blue-700 mt-2">
                  <strong>💡 Tip:</strong> Haz clic en el botón "📚 Variables Básicas" arriba para ver todas las variables disponibles que puedes usar en tus plantillas.
                </p>
              </div>
              
              <form method="post" action="/admin/settings/email-provider/save" class="space-y-6">
                {/* Template de Prueba */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    🧪 Plantilla de Correo de Prueba
                  </label>
                  <input 
                    type="text"
                    name="test_email"
                    value={templates.testEmail}
                    placeholder="2d6f.7af6fdbb5601d78b.k1.5dcff0c1-ff84-11f0-bfe0-1ae16fad91d9.19c19dd09ba"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    Template key para los correos de prueba del sistema.
                  </p>
                </div>
                
                {/* Template de Restablecimiento de Contraseña */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    � Plantilla de Verificación OTP
                  </label>
                  <input 
                    type="text"
                    name="otp"
                    value={templates.otp}
                    placeholder="2d6f.7af6fdbb5601d78b.k1...."
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    Template key para los correos de verificación OTP (registro y restablecimiento de contraseña).
                  </p>
                </div>
                
                {/* Template de Notificaciones de Tickets */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    🎫 Plantilla de Notificaciones de Tickets
                  </label>
                  <input 
                    type="text"
                    name="ticket_notification"
                    value={templates.ticketNotification}
                    placeholder="2d6f.7af6fdbb5601d78b.k1...."
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    Template key para las notificaciones de tickets (nuevos, asignados, mensajes, cambios de estado).
                  </p>
                </div>
                
                {/* Botones de acción */}
                <div class="flex gap-3 justify-end pt-4 border-t border-gray-200">
                  <a 
                    href="/admin/settings"
                    class="px-6 py-2 text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </a>
                  <button 
                    type="submit"
                    class="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
                  >
                    💾 Guardar Plantillas
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        
        {/* Modal de Variables Básicas */}
        <div id="variablesModal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header del Modal */}
            <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-purple-600 text-white">
              <h2 class="text-xl font-bold">📚 Variables para Plantillas de Email</h2>
              <button 
                onclick="document.getElementById('variablesModal').classList.add('hidden')"
                class="text-white hover:text-gray-200 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            
            {/* Contenido del Modal */}
            <div class="p-6 overflow-y-auto flex-1">
              <p class="text-sm text-gray-600 mb-6">
                Estas variables están disponibles para usar en tus plantillas HTML de ZeptoMail. 
                Copia y pega las que necesites usando la sintaxis: <code class="px-2 py-1 bg-gray-100 rounded text-purple-600">{`{{variable_name}}`}</code>
              </p>
              
              {/* Variables Globales */}
              <div class="mb-8">
                <h3 class="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  🌍 Variables Globales
                  <span class="text-xs font-normal text-gray-500">(Disponibles en todas las plantillas)</span>
                </h3>
                <div class="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div class="flex items-start gap-3">
                    <code class="px-3 py-1 bg-white border border-gray-300 rounded text-purple-600 font-mono text-sm">{`{{app_name}}`}</code>
                    <div class="flex-1">
                      <p class="text-sm text-gray-700">Nombre de la aplicación</p>
                      <p class="text-xs text-gray-500 mt-1">Ejemplo: ActionQ</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <code class="px-3 py-1 bg-white border border-gray-300 rounded text-purple-600 font-mono text-sm">{`{{app_url}}`}</code>
                    <div class="flex-1">
                      <p class="text-sm text-gray-700">URL de la aplicación</p>
                      <p class="text-xs text-gray-500 mt-1">Ejemplo: https://actionq.example.com</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Variables de Prueba */}
              <div class="mb-8">
                <h3 class="text-lg font-bold text-gray-900 mb-3">🧪 Correo de Prueba</h3>
                <div class="bg-green-50 rounded-lg p-4 space-y-3">
                  <div class="flex items-start gap-3">
                    <code class="px-3 py-1 bg-white border border-green-300 rounded text-green-700 font-mono text-sm">{`{{recipient_email}}`}</code>
                    <div class="flex-1">
                      <p class="text-sm text-gray-700">Email del destinatario</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <code class="px-3 py-1 bg-white border border-green-300 rounded text-green-700 font-mono text-sm">{`{{test_date}}`}</code>
                    <div class="flex-1">
                      <p class="text-sm text-gray-700">Fecha y hora del envío</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Variables de Password Reset */}
              <div class="mb-8">
                <h3 class="text-lg font-bold text-gray-900 mb-3">🔑 Restablecimiento de Contraseña</h3>
                <div class="bg-yellow-50 rounded-lg p-4 space-y-3">
                  <div class="flex items-start gap-3">
                    <code class="px-3 py-1 bg-white border border-yellow-300 rounded text-yellow-700 font-mono text-sm">{`{{user_name}}`}</code>
                    <div class="flex-1">
                      <p class="text-sm text-gray-700">Nombre del usuario</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <code class="px-3 py-1 bg-white border border-yellow-300 rounded text-yellow-700 font-mono text-sm">{`{{reset_url}}`}</code>
                    <div class="flex-1">
                      <p class="text-sm text-gray-700">URL para restablecer contraseña</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <code class="px-3 py-1 bg-white border border-yellow-300 rounded text-yellow-700 font-mono text-sm">{`{{expiration_time}}`}</code>
                    <div class="flex-1">
                      <p class="text-sm text-gray-700">Tiempo de expiración del enlace</p>
                      <p class="text-xs text-gray-500 mt-1">Ejemplo: "1 hora" o "24 horas"</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Variables de Tickets */}
              <div class="mb-8">
                <h3 class="text-lg font-bold text-gray-900 mb-3">🎫 Notificaciones de Tickets</h3>
                <div class="bg-blue-50 rounded-lg p-4 space-y-3">
                  <div class="flex items-start gap-3">
                    <code class="px-3 py-1 bg-white border border-blue-300 rounded text-blue-700 font-mono text-sm">{`{{user_name}}`}</code>
                    <div class="flex-1">
                      <p class="text-sm text-gray-700">Nombre del destinatario</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <code class="px-3 py-1 bg-white border border-blue-300 rounded text-blue-700 font-mono text-sm">{`{{notification_title}}`}</code>
                    <div class="flex-1">
                      <p class="text-sm text-gray-700">Título de la notificación</p>
                      <p class="text-xs text-gray-500 mt-1">Ejemplo: "Nuevo Ticket Asignado"</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <code class="px-3 py-1 bg-white border border-blue-300 rounded text-blue-700 font-mono text-sm">{`{{notification_message}}`}</code>
                    <div class="flex-1">
                      <p class="text-sm text-gray-700">Mensaje descriptivo</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <code class="px-3 py-1 bg-white border border-blue-300 rounded text-blue-700 font-mono text-sm">{`{{ticket_id}}`}</code>
                    <div class="flex-1">
                      <p class="text-sm text-gray-700">ID del ticket</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <code class="px-3 py-1 bg-white border border-blue-300 rounded text-blue-700 font-mono text-sm">{`{{ticket_title}}`}</code>
                    <div class="flex-1">
                      <p class="text-sm text-gray-700">Título del ticket</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <code class="px-3 py-1 bg-white border border-blue-300 rounded text-blue-700 font-mono text-sm">{`{{ticket_description}}`}</code>
                    <div class="flex-1">
                      <p class="text-sm text-gray-700">Descripción del ticket</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <code class="px-3 py-1 bg-white border border-blue-300 rounded text-blue-700 font-mono text-sm">{`{{ticket_status}}`}</code>
                    <div class="flex-1">
                      <p class="text-sm text-gray-700">Estado actual del ticket</p>
                      <p class="text-xs text-gray-500 mt-1">Ejemplos: "Abierto", "En Progreso", "Cerrado"</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <code class="px-3 py-1 bg-white border border-blue-300 rounded text-blue-700 font-mono text-sm">{`{{ticket_url}}`}</code>
                    <div class="flex-1">
                      <p class="text-sm text-gray-700">URL directa al ticket</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <code class="px-3 py-1 bg-white border border-blue-300 rounded text-blue-700 font-mono text-sm">{`{{tenant_name}}`}</code>
                    <div class="flex-1">
                      <p class="text-sm text-gray-700">Nombre de la organización</p>
                    </div>
                  </div>
                  
                  <div class="mt-4 pt-4 border-t border-blue-200">
                    <p class="text-xs font-semibold text-blue-900 mb-2">Variables Opcionales:</p>
                    <div class="space-y-2">
                      <div class="flex items-start gap-3">
                        <code class="px-2 py-1 bg-white border border-blue-200 rounded text-blue-600 font-mono text-xs">{`{{action_by}}`}</code>
                        <p class="text-xs text-gray-600">Usuario que realizó la acción</p>
                      </div>
                      <div class="flex items-start gap-3">
                        <code class="px-2 py-1 bg-white border border-blue-200 rounded text-blue-600 font-mono text-xs">{`{{action_date}}`}</code>
                        <p class="text-xs text-gray-600">Fecha de la acción</p>
                      </div>
                      <div class="flex items-start gap-3">
                        <code class="px-2 py-1 bg-white border border-blue-200 rounded text-blue-600 font-mono text-xs">{`{{message_content}}`}</code>
                        <p class="text-xs text-gray-600">Contenido del último mensaje</p>
                      </div>
                      <div class="flex items-start gap-3">
                        <code class="px-2 py-1 bg-white border border-blue-200 rounded text-blue-600 font-mono text-xs">{`{{priority}}`}</code>
                        <p class="text-xs text-gray-600">Prioridad del ticket (Alta, Media, Baja)</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Sintaxis Condicional */}
              <div class="mb-6">
                <h3 class="text-lg font-bold text-gray-900 mb-3">📝 Sintaxis de ZeptoMail</h3>
                <div class="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div>
                    <p class="text-sm font-semibold text-gray-700 mb-2">Variables simples:</p>
                    <code class="block px-3 py-2 bg-white border border-gray-300 rounded font-mono text-sm text-gray-800">{`{{variable_name}}`}</code>
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-gray-700 mb-2">Condicionales (solo mostrar si existe):</p>
                    <code class="block px-3 py-2 bg-white border border-gray-300 rounded font-mono text-sm text-gray-800 whitespace-pre">{`{{#if variable_name}}
  <p>Mostrar solo si existe</p>
{{/if}}`}</code>
                  </div>
                </div>
              </div>
              
              {/* Recursos Adicionales */}
              <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p class="text-sm text-purple-900">
                  <strong>📖 Documentación completa:</strong> Para ver ejemplos de código y más detalles, consulta el archivo 
                  <code class="mx-1 px-2 py-1 bg-white rounded text-purple-700">email-templates/VARIABLES.md</code> en el repositorio.
                </p>
              </div>
            </div>
            
            {/* Footer del Modal */}
            <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button 
                onclick="document.getElementById('variablesModal').classList.add('hidden')"
                class="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
    
  } catch (error) {
    console.error('Email provider config error:', error);
    return c.text('Error al cargar configuración', 500);
  }
});

/**
 * POST /admin/settings/email-provider/save - Guardar plantillas del proveedor
 */
adminRoutes.post('/admin/settings/email-provider/save', requireAdmin, async (c) => {
  const user = c.get('user')!;
  
  // Solo super_admin puede configurar proveedores
  if (user.role !== 'super_admin') {
    return c.text('No autorizado', 403);
  }
  
  try {
    const formData = await c.req.formData();
    const config = await getSystemConfig(c.env.DB);
    
    // Verificar que hay un proveedor seleccionado
    if (!config.emailProvider) {
      return c.text('No hay proveedor de correo seleccionado', 400);
    }
    
    // Por ahora solo soportamos ZeptoMail
    if (config.emailProvider === 'zeptomail') {
      const templates = {
        testEmail: (formData.get('test_email') as string || '').trim(),
        otp: (formData.get('otp') as string || '').trim(),
        ticketNotification: (formData.get('ticket_notification') as string || '').trim()
      };
      
      const result = await setZeptoMailTemplates(c.env.DB, templates);
      
      if (!result.success) {
        return c.text(result.error || 'Error al guardar plantillas', 400);
      }
      
      return c.redirect('/admin/settings/email-provider?success=true');
    }
    
    return c.text('Proveedor no soportado', 400);
    
  } catch (error) {
    console.error('Save email provider config error:', error);
    return c.text('Error al guardar configuración', 500);
  }
});

export { adminRoutes };

