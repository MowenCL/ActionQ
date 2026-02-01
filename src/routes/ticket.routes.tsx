/**
 * ActionQ - Rutas de Tickets
 * 
 * Maneja todas las operaciones CRUD de tickets, mensajes, asignaciones,
 * estados, participantes y claves seguras.
 */

import { Hono } from 'hono';
import type { AppEnv, Ticket, User, Tenant } from '../types';
import { Layout } from '../views/Layout';
import { 
  requireAuth,
  requireAdmin,
  requireAgentManager
} from '../middleware/auth';
import { formatDate } from '../utils';
import { 
  TICKET_STATUS_LABELS, 
  TICKET_STATUS_COLORS,
  PRIORITY_ORDER_SQL
} from '../config/constants';
import {
  createSecureKey,
  decryptSecureKey,
  getSecureKeyById,
  deleteSecureKey,
  logSecureKeyDeletion,
  logSecureKeyCreation
} from '../services/secureKey.service';

const ticketRoutes = new Hono<AppEnv>();

// ================================================
// RUTAS DE TICKETS (CRUD básico)
// ================================================

/**
 * GET /tickets - Listar tickets
 */
ticketRoutes.get('/tickets', requireAuth, async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  
  // Filtro según rol - incluir nombre de usuario y organización
  let query: string;
  let result;
  
  // Mostrar columnas de usuario y organización solo para roles que ven tickets de otros
  const canSeeAllInfo = user.role === 'super_admin' || user.role === 'agent_admin' || user.role === 'agent' || user.role === 'org_admin';
  // Equipo interno (super_admin, agent_admin, agent) ve TODOS los tickets de todas las organizaciones
  const isInternalTeam = user.role === 'super_admin' || user.role === 'agent_admin' || user.role === 'agent';
  
  if (isInternalTeam) {
    // Equipo interno ve todos los tickets
    query = `
      SELECT t.*, u.name as user_name, ten.name as tenant_name, agent.name as agent_name 
      FROM tickets t 
      LEFT JOIN users u ON t.created_by = u.id 
      LEFT JOIN tenants ten ON t.tenant_id = ten.id 
      LEFT JOIN users agent ON t.assigned_to = agent.id 
      WHERE t.status NOT IN ('closed', 'resolved')
      ORDER BY ${PRIORITY_ORDER_SQL}, t.created_at DESC
    `;
    result = await db.prepare(query).all<Ticket & { user_name: string; tenant_name: string; agent_name: string | null }>();
  } else if (user.role === 'org_admin') {
    // org_admin ve solo tickets de su organización
    query = `
      SELECT t.*, u.name as user_name, ten.name as tenant_name, agent.name as agent_name 
      FROM tickets t 
      LEFT JOIN users u ON t.created_by = u.id 
      LEFT JOIN tenants ten ON t.tenant_id = ten.id 
      LEFT JOIN users agent ON t.assigned_to = agent.id 
      WHERE t.tenant_id = ? AND t.status NOT IN ('closed', 'resolved')
      ORDER BY ${PRIORITY_ORDER_SQL}, t.created_at DESC
    `;
    result = await db.prepare(query).bind(user.tenant_id).all<Ticket & { user_name: string; tenant_name: string; agent_name: string | null }>();
  } else {
    // user: sus tickets + tickets donde es participante
    query = `
      SELECT DISTINCT t.*, ten.name as tenant_name, agent.name as agent_name 
      FROM tickets t 
      LEFT JOIN tenants ten ON t.tenant_id = ten.id 
      LEFT JOIN users agent ON t.assigned_to = agent.id 
      LEFT JOIN ticket_participants tp ON t.id = tp.ticket_id
      WHERE (t.created_by = ? OR tp.user_id = ?) AND t.status NOT IN ('closed', 'resolved')
      ORDER BY ${PRIORITY_ORDER_SQL}, t.created_at DESC
    `;
    result = await db.prepare(query).bind(user.id, user.id).all<Ticket & { tenant_name: string; agent_name: string | null }>();
  }
  
  const tickets = result.results || [];
  
  return c.html(
    <Layout title="Tickets Activos" user={user} sessionTimeoutMinutes={c.get('sessionTimeoutMinutes')}>
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <h1 class="text-2xl font-bold text-gray-900">Tickets Activos</h1>
          <div class="flex gap-3">
            <a 
              href="/tickets/history"
              class="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 border border-gray-300"
            >
              📋 Historial
            </a>
            <a 
              href="/tickets/new"
              class="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            >
              + Nuevo Ticket
            </a>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow overflow-hidden">
          {tickets.length > 0 ? (
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                    {canSeeAllInfo && (
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                    )}
                    {isInternalTeam && (
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organización</th>
                    )}
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agente</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridad</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {tickets.map((ticket: any) => (
                    <tr key={ticket.id} class="hover:bg-gray-50 cursor-pointer" onclick={`window.location='/tickets/${ticket.id}'`}>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{ticket.id}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ticket.title}</td>
                      {canSeeAllInfo && (
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {ticket.user_name || 'Usuario desconocido'}
                        </td>
                      )}
                      {isInternalTeam && (
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {ticket.tenant_name || 'Sin organización'}
                        </td>
                      )}
                      <td class="px-6 py-4 whitespace-nowrap text-sm">
                        {ticket.agent_name ? (
                          <span class="inline-flex items-center px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs font-medium">
                            {ticket.agent_name}
                          </span>
                        ) : (
                          <span class="text-gray-400 italic">Sin asignar</span>
                        )}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          ticket.status === 'open' ? 'bg-blue-100 text-blue-800' :
                          ticket.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                          ticket.status === 'pending' ? 'bg-purple-100 text-purple-800' :
                          ticket.status === 'resolved' ? 'bg-green-100 text-green-800' :
                          ticket.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {ticket.status === 'open' ? 'Abierto' :
                           ticket.status === 'in_progress' ? 'En Progreso' :
                           ticket.status === 'pending' ? 'Validando' :
                           ticket.status === 'resolved' ? 'Resuelto' :
                           ticket.status === 'closed' ? 'Cerrado' :
                           ticket.status}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          ticket.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                          ticket.priority === 'high' ? 'bg-orange-100 text-orange-600' :
                          ticket.priority === 'medium' ? 'bg-blue-100 text-blue-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {ticket.priority === 'urgent' ? 'Urgente' :
                           ticket.priority === 'high' ? 'Alta' :
                           ticket.priority === 'medium' ? 'Media' :
                           'Baja'}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(ticket.created_at, c.get('timezone'), { dateOnly: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div class="px-6 py-12 text-center">
              <span class="text-4xl">📭</span>
              <p class="mt-2 text-gray-500">No hay tickets activos</p>
              <a href="/tickets/history" class="text-blue-600 hover:underline text-sm mt-2 inline-block">
                Ver historial de tickets
              </a>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
});

/**
 * GET /tickets/history - Historial de tickets cerrados y resueltos
 */
ticketRoutes.get('/tickets/history', requireAuth, async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  
  // Filtro según rol - solo tickets cerrados o resueltos
  let query: string;
  let result;
  
  const canSeeAllInfo = user.role === 'super_admin' || user.role === 'agent_admin' || user.role === 'agent' || user.role === 'org_admin';
  // Equipo interno ve todos los tickets
  const isInternalTeam = user.role === 'super_admin' || user.role === 'agent_admin' || user.role === 'agent';
  
  if (isInternalTeam) {
    // Equipo interno ve todos los tickets cerrados/resueltos
    query = `
      SELECT t.*, u.name as user_name, ten.name as tenant_name, agent.name as agent_name 
      FROM tickets t 
      LEFT JOIN users u ON t.created_by = u.id 
      LEFT JOIN tenants ten ON t.tenant_id = ten.id 
      LEFT JOIN users agent ON t.assigned_to = agent.id 
      WHERE t.status IN ('closed', 'resolved')
      ORDER BY t.updated_at DESC
    `;
    result = await db.prepare(query).all<Ticket & { user_name: string; tenant_name: string; agent_name: string | null }>();
  } else if (user.role === 'org_admin') {
    // org_admin ve solo tickets de su organización
    query = `
      SELECT t.*, u.name as user_name, ten.name as tenant_name, agent.name as agent_name 
      FROM tickets t 
      LEFT JOIN users u ON t.created_by = u.id 
      LEFT JOIN tenants ten ON t.tenant_id = ten.id 
      LEFT JOIN users agent ON t.assigned_to = agent.id 
      WHERE t.tenant_id = ? AND t.status IN ('closed', 'resolved')
      ORDER BY t.updated_at DESC
    `;
    result = await db.prepare(query).bind(user.tenant_id).all<Ticket & { user_name: string; tenant_name: string; agent_name: string | null }>();
  } else {
    // user: sus tickets + tickets donde es participante
    query = `
      SELECT DISTINCT t.*, ten.name as tenant_name, agent.name as agent_name 
      FROM tickets t 
      LEFT JOIN tenants ten ON t.tenant_id = ten.id 
      LEFT JOIN users agent ON t.assigned_to = agent.id 
      LEFT JOIN ticket_participants tp ON t.id = tp.ticket_id
      WHERE (t.created_by = ? OR tp.user_id = ?) AND t.status IN ('closed', 'resolved')
      ORDER BY t.updated_at DESC
    `;
    result = await db.prepare(query).bind(user.id, user.id).all<Ticket & { tenant_name: string; agent_name: string | null }>();
  }
  
  const tickets = result.results || [];
  
  return c.html(
    <Layout title="Historial de Tickets" user={user} sessionTimeoutMinutes={c.get('sessionTimeoutMinutes')}>
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-4">
            <a 
              href="/tickets"
              class="text-gray-500 hover:text-gray-700"
            >
              ← Volver
            </a>
            <h1 class="text-2xl font-bold text-gray-900">Historial de Tickets</h1>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow overflow-hidden">
          {tickets.length > 0 ? (
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                    {canSeeAllInfo && (
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                    )}
                    {isInternalTeam && (
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organización</th>
                    )}
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agente</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cerrado</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {tickets.map((ticket: any) => (
                    <tr key={ticket.id} class="hover:bg-gray-50 cursor-pointer" onclick={`window.location='/tickets/${ticket.id}'`}>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{ticket.id}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ticket.title}</td>
                      {canSeeAllInfo && (
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {ticket.user_name || 'Usuario desconocido'}
                        </td>
                      )}
                      {isInternalTeam && (
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {ticket.tenant_name || 'Sin organización'}
                        </td>
                      )}
                      <td class="px-6 py-4 whitespace-nowrap text-sm">
                        {ticket.agent_name ? (
                          <span class="inline-flex items-center px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs font-medium">
                            {ticket.agent_name}
                          </span>
                        ) : (
                          <span class="text-gray-400 italic">Sin asignar</span>
                        )}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          ticket.status === 'resolved' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {ticket.status === 'resolved' ? 'Resuelto' : 'Cerrado'}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(ticket.updated_at, c.get('timezone'), { dateOnly: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div class="px-6 py-12 text-center">
              <span class="text-4xl">📋</span>
              <p class="mt-2 text-gray-500">No hay tickets en el historial</p>
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
ticketRoutes.get('/tickets/new', requireAuth, async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  
  // Determinar si puede crear tickets en nombre de otros
  const canCreateOnBehalf = ['super_admin', 'agent_admin', 'agent', 'org_admin'].includes(user.role);
  const isInternalTeam = ['super_admin', 'agent_admin', 'agent'].includes(user.role);
  
  // Obtener organizaciones (solo para equipo interno)
  let tenants: { id: number; name: string }[] = [];
  if (isInternalTeam) {
    const tenantsResult = await db
      .prepare('SELECT id, name FROM tenants WHERE is_active = 1 ORDER BY name')
      .all<{ id: number; name: string }>();
    tenants = tenantsResult.results || [];
  }
  
  // Para org_admin, obtener usuarios de su organización
  let orgUsers: { id: number; name: string; email: string }[] = [];
  if (user.role === 'org_admin' && user.tenant_id) {
    const usersResult = await db
      .prepare('SELECT id, name, email FROM users WHERE tenant_id = ? AND is_active = 1 ORDER BY name')
      .bind(user.tenant_id)
      .all<{ id: number; name: string; email: string }>();
    orgUsers = usersResult.results || [];
  }
  
  return c.html(
    <Layout title="Nuevo Ticket" user={user} sessionTimeoutMinutes={c.get('sessionTimeoutMinutes')}>
      <div class="max-w-2xl mx-auto">
        <h1 class="text-2xl font-bold text-gray-900 mb-6">Crear Nuevo Ticket</h1>
        
        <form method="post" action="/tickets" class="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Selector de organización y usuario (solo para roles con permisos) */}
          {canCreateOnBehalf && (
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
              <h3 class="text-sm font-semibold text-blue-800">Crear ticket en nombre de:</h3>
              
              {/* Checkbox para crear en nombre de otro */}
              <label class="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id="create-on-behalf" 
                  name="create_on_behalf"
                  value="1"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  onchange="toggleOnBehalfFields(this.checked)"
                />
                <span class="text-sm text-gray-700">Crear en nombre de otro usuario</span>
              </label>
              
              <div id="on-behalf-fields" class="hidden space-y-4">
                {/* Selector de organización (solo equipo interno) */}
                {isInternalTeam && (
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Organización</label>
                    <div class="relative">
                      <input 
                        type="text" 
                        id="tenant-search"
                        placeholder="Buscar organización..."
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        oninput="filterTenants(this.value)"
                        onfocus="showTenantDropdown()"
                      />
                      <input type="hidden" name="tenant_id" id="selected-tenant-id" />
                      <div id="tenant-dropdown" class="hidden absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {tenants.map((tenant) => (
                          <div 
                            key={tenant.id}
                            class="tenant-option px-4 py-2 hover:bg-blue-50 cursor-pointer"
                            data-id={tenant.id}
                            data-name={tenant.name}
                            onclick={`selectTenant(${tenant.id}, '${tenant.name.replace(/'/g, "\\'")}')`}
                          >
                            {tenant.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Selector de usuario */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                  <div class="relative">
                    <input 
                      type="text" 
                      id="user-search"
                      placeholder={isInternalTeam ? "Primero selecciona una organización..." : "Buscar usuario..."}
                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={isInternalTeam}
                      oninput="filterUsers(this.value)"
                      onfocus="showUserDropdown()"
                    />
                    <input type="hidden" name="on_behalf_user_id" id="selected-user-id" />
                    <div id="user-dropdown" class="hidden absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {/* Para org_admin, mostrar usuarios de su org directamente */}
                      {user.role === 'org_admin' && orgUsers.map((u) => (
                        <div 
                          key={u.id}
                          class="user-option px-4 py-2 hover:bg-blue-50 cursor-pointer"
                          data-id={u.id}
                          data-name={u.name}
                          data-email={u.email}
                          onclick={`selectUser(${u.id}, '${u.name.replace(/'/g, "\\'")} (${u.email})')`}
                        >
                          <span class="font-medium">{u.name}</span>
                          <span class="text-gray-500 text-sm ml-2">{u.email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
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
      
      {/* JavaScript para los selectores con búsqueda */}
      {canCreateOnBehalf && (
        <script dangerouslySetInnerHTML={{ __html: `
          let allTenants = ${JSON.stringify(tenants)};
          let allUsers = ${JSON.stringify(orgUsers)};
          let isInternalTeam = ${isInternalTeam};
          
          function toggleOnBehalfFields(show) {
            const fields = document.getElementById('on-behalf-fields');
            if (show) {
              fields.classList.remove('hidden');
            } else {
              fields.classList.add('hidden');
              // Limpiar selecciones
              document.getElementById('selected-tenant-id').value = '';
              document.getElementById('selected-user-id').value = '';
              if (document.getElementById('tenant-search')) {
                document.getElementById('tenant-search').value = '';
              }
              document.getElementById('user-search').value = '';
            }
          }
          
          function filterTenants(query) {
            const dropdown = document.getElementById('tenant-dropdown');
            const options = dropdown.querySelectorAll('.tenant-option');
            const lowerQuery = query.toLowerCase();
            
            options.forEach(opt => {
              const name = opt.dataset.name.toLowerCase();
              opt.style.display = name.includes(lowerQuery) ? 'block' : 'none';
            });
          }
          
          function showTenantDropdown() {
            document.getElementById('tenant-dropdown').classList.remove('hidden');
          }
          
          function selectTenant(id, name) {
            document.getElementById('tenant-search').value = name;
            document.getElementById('selected-tenant-id').value = id;
            document.getElementById('tenant-dropdown').classList.add('hidden');
            
            // Cargar usuarios de esta organización
            loadUsersForTenant(id);
          }
          
          async function loadUsersForTenant(tenantId) {
            const userSearch = document.getElementById('user-search');
            const userDropdown = document.getElementById('user-dropdown');
            
            userSearch.disabled = true;
            userSearch.placeholder = 'Cargando usuarios...';
            userSearch.value = '';
            document.getElementById('selected-user-id').value = '';
            
            try {
              const response = await fetch('/api/tenants/' + tenantId + '/users');
              if (response.ok) {
                allUsers = await response.json();
                
                // Actualizar dropdown
                userDropdown.innerHTML = allUsers.map(u => 
                  '<div class="user-option px-4 py-2 hover:bg-blue-50 cursor-pointer" ' +
                  'data-id="' + u.id + '" data-name="' + u.name + '" data-email="' + u.email + '" ' +
                  'onclick="selectUser(' + u.id + ', \\'' + u.name.replace(/'/g, "\\\\'") + ' (' + u.email + ')\\')\">' +
                  '<span class="font-medium">' + u.name + '</span>' +
                  '<span class="text-gray-500 text-sm ml-2">' + u.email + '</span>' +
                  '</div>'
                ).join('');
                
                userSearch.disabled = false;
                userSearch.placeholder = 'Buscar usuario...';
              }
            } catch (err) {
              console.error('Error loading users:', err);
              userSearch.placeholder = 'Error al cargar usuarios';
            }
          }
          
          function filterUsers(query) {
            const dropdown = document.getElementById('user-dropdown');
            const options = dropdown.querySelectorAll('.user-option');
            const lowerQuery = query.toLowerCase();
            
            options.forEach(opt => {
              const name = (opt.dataset.name + ' ' + opt.dataset.email).toLowerCase();
              opt.style.display = name.includes(lowerQuery) ? 'block' : 'none';
            });
          }
          
          function showUserDropdown() {
            document.getElementById('user-dropdown').classList.remove('hidden');
          }
          
          function selectUser(id, displayText) {
            document.getElementById('user-search').value = displayText;
            document.getElementById('selected-user-id').value = id;
            document.getElementById('user-dropdown').classList.add('hidden');
          }
          
          // Cerrar dropdowns al hacer click fuera
          document.addEventListener('click', function(e) {
            if (!e.target.closest('#tenant-search') && !e.target.closest('#tenant-dropdown')) {
              document.getElementById('tenant-dropdown')?.classList.add('hidden');
            }
            if (!e.target.closest('#user-search') && !e.target.closest('#user-dropdown')) {
              document.getElementById('user-dropdown')?.classList.add('hidden');
            }
          });
        `}} />
      )}
    </Layout>
  );
});

/**
 * POST /tickets - Crear ticket
 * Soporta creación en nombre de otro usuario para roles con permisos
 */
ticketRoutes.post('/tickets', requireAuth, async (c) => {
  const user = c.get('user')!;
  
  try {
    const formData = await c.req.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string || '';
    const priority = formData.get('priority') as string || 'medium';
    const createOnBehalf = formData.get('create_on_behalf') === '1';
    const onBehalfUserId = formData.get('on_behalf_user_id') as string;
    const selectedTenantId = formData.get('tenant_id') as string;
    
    if (!title) {
      return c.text('El título es requerido', 400);
    }
    
    // Determinar tenant_id, created_by y created_by_agent
    let ticketTenantId = user.tenant_id;
    let ticketCreatedBy = user.id;
    let ticketCreatedByAgent: number | null = null;
    
    // Si se crea en nombre de otro usuario
    if (createOnBehalf && onBehalfUserId) {
      const canCreateOnBehalf = ['super_admin', 'agent_admin', 'agent', 'org_admin'].includes(user.role);
      
      if (!canCreateOnBehalf) {
        return c.text('No tienes permisos para crear tickets en nombre de otros', 403);
      }
      
      // Verificar que el usuario existe y obtener su tenant
      const targetUser = await c.env.DB
        .prepare('SELECT id, tenant_id FROM users WHERE id = ? AND is_active = 1')
        .bind(parseInt(onBehalfUserId))
        .first<{ id: number; tenant_id: number }>();
      
      if (!targetUser) {
        return c.text('Usuario no encontrado', 404);
      }
      
      // org_admin solo puede crear tickets para usuarios de su propia organización
      if (user.role === 'org_admin' && targetUser.tenant_id !== user.tenant_id) {
        return c.text('Solo puedes crear tickets para usuarios de tu organización', 403);
      }
      
      // Para equipo interno, verificar que el tenant seleccionado coincide con el del usuario
      if (['super_admin', 'agent_admin', 'agent'].includes(user.role)) {
        if (selectedTenantId && parseInt(selectedTenantId) !== targetUser.tenant_id) {
          return c.text('El usuario no pertenece a la organización seleccionada', 400);
        }
      }
      
      ticketTenantId = targetUser.tenant_id;
      ticketCreatedBy = targetUser.id;
      ticketCreatedByAgent = user.id; // Guardar quién realmente creó el ticket
    }
    
    const result = await c.env.DB
      .prepare(`
        INSERT INTO tickets (tenant_id, title, description, priority, created_by, created_by_agent) 
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id
      `)
      .bind(ticketTenantId, title, description, priority, ticketCreatedBy, ticketCreatedByAgent)
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
ticketRoutes.get('/tickets/:id', requireAuth, async (c) => {
  const user = c.get('user')!;
  const ticketId = parseInt(c.req.param('id'));
  
  const ticket = await c.env.DB
    .prepare('SELECT * FROM tickets WHERE id = ?')
    .bind(ticketId)
    .first<Ticket>();
  
  if (!ticket) {
    return c.text('Ticket no encontrado', 404);
  }
  
  // Verificar si el usuario es participante del ticket
  const isParticipant = await c.env.DB
    .prepare('SELECT 1 FROM ticket_participants WHERE ticket_id = ? AND user_id = ?')
    .bind(ticketId, user.id)
    .first();
  
  // Verificar acceso según rol:
  // - super_admin: acceso a todos
  // - agent_admin/agent: acceso a todos los tickets (equipo interno global)
  // - org_admin: acceso a tickets de su organización
  // - user: acceso a sus propios tickets O tickets donde es participante
  if (user.role === 'super_admin' || user.role === 'agent_admin' || user.role === 'agent') {
    // OK - acceso total (equipo interno)
  } else if (user.role === 'org_admin') {
    if (ticket.tenant_id !== user.tenant_id) {
      return c.text('No tienes acceso a este ticket', 403);
    }
  } else {
    // user: solo sus tickets o donde es participante
    if (ticket.created_by !== user.id && !isParticipant) {
      return c.text('No tienes acceso a este ticket', 403);
    }
  }
  
  // Obtener mensajes del ticket (usuarios normales no ven notas internas)
  const messagesQuery = user.role === 'user'
    ? `SELECT m.*, u.name as user_name,
              sk.id as secure_key_id, sk.encrypted_value, sk.iv
       FROM messages m 
       JOIN users u ON m.user_id = u.id 
       LEFT JOIN secure_keys sk ON sk.message_id = m.id
       WHERE m.ticket_id = ? AND m.is_internal = 0
       ORDER BY m.created_at ASC`
    : `SELECT m.*, u.name as user_name,
              sk.id as secure_key_id, sk.encrypted_value, sk.iv
       FROM messages m 
       JOIN users u ON m.user_id = u.id 
       LEFT JOIN secure_keys sk ON sk.message_id = m.id
       WHERE m.ticket_id = ? 
       ORDER BY m.created_at ASC`;
  
  const messages = await c.env.DB
    .prepare(messagesQuery)
    .bind(ticketId)
    .all<{ id: number; content: string; is_internal: number; created_at: string; user_name: string; secure_key_id: number | null; encrypted_value: string | null; iv: string | null }>();
  
  // Obtener nombre del agente asignado si existe
  let assignedName = null;
  if (ticket.assigned_to) {
    const assigned = await c.env.DB
      .prepare('SELECT name FROM users WHERE id = ?')
      .bind(ticket.assigned_to)
      .first<{ name: string }>();
    assignedName = assigned?.name;
  }
  
  // Obtener nombre del creador del ticket
  const createdByUser = await c.env.DB
    .prepare('SELECT name FROM users WHERE id = ?')
    .bind(ticket.created_by)
    .first<{ name: string }>();
  const createdByName = createdByUser?.name || 'Usuario desconocido';
  
  // Obtener nombre del agente que creó el ticket en nombre de otro (si aplica)
  let createdByAgentName = null;
  if (ticket.created_by_agent) {
    const createdByAgentUser = await c.env.DB
      .prepare('SELECT name FROM users WHERE id = ?')
      .bind(ticket.created_by_agent)
      .first<{ name: string }>();
    createdByAgentName = createdByAgentUser?.name;
  }
  
  // Obtener participantes del ticket
  const participantsResult = await c.env.DB
    .prepare(`
      SELECT tp.id, tp.user_id, tp.created_at, u.name, u.email, added.name as added_by_name
      FROM ticket_participants tp
      JOIN users u ON tp.user_id = u.id
      JOIN users added ON tp.added_by = added.id
      WHERE tp.ticket_id = ?
      ORDER BY tp.created_at ASC
    `)
    .bind(ticketId)
    .all<{ id: number; user_id: number; created_at: string; name: string; email: string; added_by_name: string }>();
  const participants = participantsResult.results || [];
  
  // Obtener usuarios de la misma organización para añadir como participantes
  // Excluir al creador del ticket y participantes actuales
  const participantIds = participants.map(p => p.user_id);
  const excludeIds = [ticket.created_by, ...participantIds, user.id];
  const availableParticipantsResult = await c.env.DB
    .prepare(`
      SELECT id, name, email 
      FROM users 
      WHERE tenant_id = ? 
        AND is_active = 1 
        AND id NOT IN (${excludeIds.join(',')})
      ORDER BY name
    `)
    .bind(ticket.tenant_id)
    .all<{ id: number; name: string; email: string }>();
  const availableParticipants = availableParticipantsResult.results || [];
  
  // Determinar permisos
  // isManager: super_admin y agent_admin tienen acceso global a gestionar tickets
  const isManager = user.role === 'super_admin' || user.role === 'agent_admin';
  // isAssignedAgent: agente asignado a este ticket específico
  const isAssignedAgent = user.role === 'agent' && ticket.assigned_to === user.id;
  // isInternalTeam: equipo interno que puede gestionar este ticket (managers globales o agente asignado)
  const isInternalTeam = isManager || isAssignedAgent;
  // isAgentManager: puede asignar/reasignar tickets a otros agentes
  const isAgentManager = user.role === 'super_admin' || user.role === 'agent_admin';
  const isSuperAdmin = user.role === 'super_admin';
  const isClosed = ticket.status === 'closed';
  
  // canAddMessage: puede añadir mensajes si tiene acceso al ticket
  // - Creador del ticket
  // - Participantes del ticket
  // - org_admin de la misma organización
  // - Managers (super_admin, agent_admin) siempre
  // - Agent solo si está asignado
  const isTicketOwnerOrParticipant = ticket.created_by === user.id || participants.some(p => p.user_id === user.id);
  const isOrgAdmin = user.role === 'org_admin' && ticket.tenant_id === user.tenant_id;
  const hasMessageAccess = isManager || isAssignedAgent || isTicketOwnerOrParticipant || isOrgAdmin;
  const canAddMessage = hasMessageAccess && (!isClosed || (isClosed && isInternalTeam));
  
  const canChangeStatus = isInternalTeam && (!isClosed || isSuperAdmin); // solo equipo interno puede cambiar estado
  const canSelfAssign = (isManager || user.role === 'agent') && ticket.status === 'open' && !ticket.assigned_to;
  const canReassign = isAgentManager && !isClosed; // Los managers pueden reasignar
  // Permitir añadir participantes a todos (ticket no cerrado)
  const canAddParticipants = !isClosed && availableParticipants.length > 0;
  
  // Obtener lista de agentes disponibles para asignación (solo si puede reasignar)
  // Los agentes son globales y pueden trabajar con tickets de cualquier organización
  // Solo roles internos pueden ser asignados (no org_admin que es rol de cliente)
  let availableAgents: { id: number; name: string }[] = [];
  if (canReassign) {
    const agentsResult = await c.env.DB
      .prepare(`SELECT id, name FROM users WHERE role IN ('super_admin', 'agent_admin', 'agent') AND is_active = 1 ORDER BY name`)
      .all<{ id: number; name: string }>();
    availableAgents = agentsResult.results || [];
  }
  
  // Determinar si puede ver/añadir claves seguras
  // Solo: creador del ticket, participantes, agente asignado, equipo interno
  const canViewSecureKeys = isInternalTeam || 
    ticket.created_by === user.id || 
    ticket.assigned_to === user.id ||
    participants.some(p => p.user_id === user.id);
  const canAddSecureKeys = canViewSecureKeys && !isClosed;
  
  return c.html(
    <Layout title={`Ticket #${ticket.id}`} user={user} sessionTimeoutMinutes={c.get('sessionTimeoutMinutes')}>
      <div class="max-w-4xl mx-auto space-y-6">
        {/* Header del ticket */}
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-sm text-gray-500">Ticket #{ticket.id}</p>
              <h1 class="text-2xl font-bold text-gray-900 mt-1">{ticket.title}</h1>
            </div>
            <div class="flex items-center space-x-2">
              <span class={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${TICKET_STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-800'}`}>
                {TICKET_STATUS_LABELS[ticket.status] || ticket.status}
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
          
          <div class="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
            <span>Creado el {formatDate(ticket.created_at, c.get('timezone'))}</span>
            <span class="flex items-center gap-1">
              <span class="font-medium">Creado por:</span> {createdByName}
              {createdByAgentName && (
                <span class="text-blue-600 ml-1">(registrado por {createdByAgentName})</span>
              )}
            </span>
            {assignedName && (
              <span class="flex items-center gap-1">
                <span class="font-medium">Asignado a:</span> {assignedName}
              </span>
            )}
          </div>
          
          {/* Botón para que agentes se auto-asignen (visible incluso si no están asignados) */}
          {canSelfAssign && (
            <div class="mt-4 pt-4 border-t border-gray-200">
              <form method="post" action={`/tickets/${ticket.id}/assign`}>
                <button 
                  type="submit"
                  class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  🙋 Asignarme este ticket
                </button>
              </form>
            </div>
          )}
          
          {/* Acciones adicionales de equipo interno (solo managers o agente asignado) */}
          {isInternalTeam && (
            <div class={`${canSelfAssign ? 'mt-3' : 'mt-4 pt-4 border-t border-gray-200'} flex flex-wrap gap-3 items-start`}>
              {/* Selector para asignar/reasignar a un agente (solo managers) */}
              {canReassign && availableAgents.length > 0 && (
                <form method="post" action={`/tickets/${ticket.id}/reassign`} class="flex items-center gap-2">
                  <select 
                    name="agent_id" 
                    required
                    class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Seleccionar agente...</option>
                    {availableAgents.map((agent) => (
                      <option 
                        key={agent.id} 
                        value={agent.id}
                        selected={ticket.assigned_to === agent.id}
                      >
                        {agent.name} {ticket.assigned_to === agent.id ? '(actual)' : ''}
                      </option>
                    ))}
                  </select>
                  <button 
                    type="submit"
                    class="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
                  >
                    {ticket.assigned_to ? '🔄 Reasignar' : '📋 Asignar'}
                  </button>
                </form>
              )}
              
              {/* Cambiar estado */}
              {canChangeStatus && (
                <div class="flex items-center gap-2">
                  <span class="text-sm text-gray-600">Cambiar estado:</span>
                  {ticket.status !== 'in_progress' && (
                    <button 
                      type="button"
                      onclick={`document.getElementById('status-modal').classList.remove('hidden'); document.getElementById('new-status').value='in_progress';`}
                      class="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-lg hover:bg-yellow-200"
                    >
                      En Progreso
                    </button>
                  )}
                  {ticket.status !== 'pending' && (
                    <button 
                      type="button"
                      onclick={`document.getElementById('status-modal').classList.remove('hidden'); document.getElementById('new-status').value='pending';`}
                      class="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-lg hover:bg-purple-200"
                    >
                      Validando
                    </button>
                  )}
                  {ticket.status !== 'resolved' && (
                    <button 
                      type="button"
                      onclick={`document.getElementById('status-modal').classList.remove('hidden'); document.getElementById('new-status').value='resolved';`}
                      class="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-lg hover:bg-green-200"
                    >
                      Resuelto
                    </button>
                  )}
                  {ticket.status !== 'closed' && (
                    <button 
                      type="button"
                      onclick={`document.getElementById('status-modal').classList.remove('hidden'); document.getElementById('new-status').value='closed';`}
                      class="px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-lg hover:bg-gray-200"
                    >
                      Cerrado
                    </button>
                  )}
                  {isSuperAdmin && ticket.status === 'closed' && (
                    <button 
                      type="button"
                      onclick={`document.getElementById('status-modal').classList.remove('hidden'); document.getElementById('new-status').value='open';`}
                      class="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-lg hover:bg-blue-200"
                    >
                      Reabrir
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Participantes del ticket */}
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">👥 Participantes</h2>
          
          <div class="space-y-2">
            {/* Creador del ticket (siempre visible) */}
            <div class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <div class="flex items-center gap-2">
                <span class="text-lg">👤</span>
                <div>
                  <span class="font-medium text-gray-900">{createdByName}</span>
                  <span class="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Creador</span>
                </div>
              </div>
            </div>
            
            {/* Lista de participantes actuales */}
            {participants.length > 0 ? (
              participants.map((p) => (
                <div key={p.id} class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div class="flex items-center gap-2">
                    <span class="text-lg">👤</span>
                    <div>
                      <span class="font-medium text-gray-900">{p.name}</span>
                      <span class="text-gray-500 text-sm ml-2">({p.email})</span>
                    </div>
                  </div>
                  <span class="text-xs text-gray-500">Añadido por {p.added_by_name}</span>
                </div>
              ))
            ) : (
              <p class="text-gray-500 text-sm py-2">No hay participantes adicionales.</p>
            )}
            
            {!isClosed && (
              <p class="text-xs text-gray-500 mt-2 italic">
                Puedes gestionar participantes en el formulario de mensaje de abajo.
              </p>
            )}
          </div>
        </div>
        
        {/* Aviso ticket cerrado */}
        {isClosed && (
          <div class="bg-gray-100 border border-gray-300 rounded-lg p-4 text-center">
            <p class="text-gray-700">
              <strong>Este ticket está cerrado.</strong>
              {user.role === 'user' 
                ? ' No se pueden añadir más mensajes.'
                : ' Solo se pueden añadir notas internas.'
              }
            </p>
          </div>
        )}
        
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
                      {formatDate(msg.created_at, c.get('timezone'))}
                    </span>
                  </div>
                  <p class="mt-1 text-gray-700 whitespace-pre-wrap">{msg.content}</p>
                  
                  {/* Mostrar clave segura si existe */}
                  {msg.secure_key_id && canViewSecureKeys && (
                    <div class="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div class="flex items-center gap-2">
                        <span class="text-lg">🔐</span>
                        <input 
                          type="password" 
                          id={`msg-key-${msg.secure_key_id}`}
                          value="••••••••••••"
                          readonly
                          class="flex-1 max-w-xs px-2 py-1 bg-white border border-amber-300 rounded text-sm font-mono"
                        />
                        <button 
                          type="button"
                          onclick={`
                            const input = document.getElementById('msg-key-${msg.secure_key_id}');
                            const btn = this;
                            if (input.type === 'password') {
                              fetch('/tickets/${ticket.id}/secure-keys/${msg.secure_key_id}/decrypt')
                                .then(r => r.json())
                                .then(data => {
                                  if (data.value) {
                                    input.value = data.value;
                                    input.type = 'text';
                                    btn.textContent = '🙈 Ocultar';
                                  } else {
                                    alert('Error al desencriptar');
                                  }
                                })
                                .catch(() => alert('Error al obtener la clave'));
                            } else {
                              input.type = 'password';
                              input.value = '••••••••••••';
                              btn.textContent = '👁️ Ver';
                            }
                          `}
                          class="px-2 py-1 text-xs bg-amber-200 hover:bg-amber-300 rounded font-medium"
                        >
                          👁️ Ver
                        </button>
                        <button 
                          type="button"
                          onclick={`
                            fetch('/tickets/${ticket.id}/secure-keys/${msg.secure_key_id}/decrypt')
                              .then(r => r.json())
                              .then(data => {
                                if (data.value) {
                                  navigator.clipboard.writeText(data.value)
                                    .then(() => {
                                      this.textContent = '✓ Copiado';
                                      setTimeout(() => this.textContent = '📋 Copiar', 2000);
                                    })
                                    .catch(() => alert('Error al copiar'));
                                }
                              })
                              .catch(() => alert('Error al obtener la clave'));
                          `}
                          class="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium"
                        >
                          📋 Copiar
                        </button>
                      </div>
                    </div>
                  )}
                  
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
          {canAddMessage && (
            <div class="px-6 py-4 border-t border-gray-200">
              <form method="post" action={`/tickets/${ticket.id}/messages`} class="space-y-4">
                <textarea 
                  name="content" 
                  rows={3}
                  required
                  placeholder={isClosed ? "Añadir nota interna..." : "Escribe un mensaje..."}
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                ></textarea>
                
                {/* Gestión de participantes (solo si no está cerrado) */}
                {!isClosed && (participants.length > 0 || availableParticipants.length > 0) && (
                  <div class="border border-gray-200 rounded-lg p-3">
                    <button 
                      type="button"
                      onclick="document.getElementById('participants-section').classList.toggle('hidden')"
                      class="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                    >
                      <span>👥</span>
                      <span>Gestionar participantes</span>
                      <span class="text-gray-400 text-xs">({participants.length} actuales)</span>
                    </button>
                    
                    <div id="participants-section" class="hidden mt-3 space-y-3">
                      {/* Participantes actuales (checkbox para quitar) */}
                      {participants.length > 0 && (
                        <div class="space-y-1">
                          <p class="text-xs font-medium text-gray-600 uppercase">Participantes actuales:</p>
                          {participants.map((p) => (
                            <label key={p.id} class="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded cursor-pointer">
                              <input 
                                type="checkbox" 
                                name="keep_participant" 
                                value={p.user_id.toString()}
                                checked
                                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span class="text-sm text-gray-700">{p.name}</span>
                              <span class="text-xs text-gray-500">({p.email})</span>
                            </label>
                          ))}
                          <p class="text-xs text-gray-500 italic">Desmarca para quitar del ticket.</p>
                        </div>
                      )}
                      
                      {/* Buscador para añadir participantes */}
                      {availableParticipants.length > 0 && (
                        <div class="mt-2 pt-2 border-t border-gray-200">
                          <p class="text-xs font-medium text-gray-600 uppercase mb-2">Añadir participantes:</p>
                          
                          {/* Campo de búsqueda */}
                          <div class="relative">
                            <input 
                              type="text"
                              id="participant-search"
                              placeholder="Buscar por nombre o email..."
                              autocomplete="off"
                              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              oninput={`
                                const search = this.value.toLowerCase();
                                const results = document.getElementById('search-results');
                                const items = results.querySelectorAll('[data-participant]');
                                let visibleCount = 0;
                                items.forEach(item => {
                                  const name = item.dataset.name.toLowerCase();
                                  const email = item.dataset.email.toLowerCase();
                                  const isSelected = document.querySelector('input[name=add_participant][value="' + item.dataset.id + '"]');
                                  if ((name.includes(search) || email.includes(search)) && !isSelected && search.length > 0) {
                                    item.classList.remove('hidden');
                                    visibleCount++;
                                  } else {
                                    item.classList.add('hidden');
                                  }
                                });
                                results.classList.toggle('hidden', visibleCount === 0 || search.length === 0);
                              `}
                              onfocus={`
                                const search = this.value.toLowerCase();
                                if (search.length > 0) {
                                  document.getElementById('search-results').classList.remove('hidden');
                                }
                              `}
                            />
                            
                            {/* Lista de resultados */}
                            <div 
                              id="search-results" 
                              class="hidden absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                            >
                              {availableParticipants.map((u) => (
                                <div 
                                  key={u.id}
                                  data-participant
                                  data-id={u.id.toString()}
                                  data-name={u.name}
                                  data-email={u.email}
                                  class="hidden px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                                  onclick={`
                                    const container = document.getElementById('selected-participants');
                                    const id = this.dataset.id;
                                    const name = this.dataset.name;
                                    const email = this.dataset.email;
                                    
                                    // Crear el elemento seleccionado
                                    const div = document.createElement('div');
                                    div.className = 'flex items-center justify-between py-1 px-2 bg-green-50 rounded text-sm';
                                    div.dataset.selectedId = id;
                                    
                                    const content = document.createElement('div');
                                    content.className = 'flex items-center gap-2';
                                    content.innerHTML = '<span class="text-green-600">✓</span><span>' + name + '</span><span class="text-xs text-gray-500">(' + email + ')</span>';
                                    
                                    const removeBtn = document.createElement('button');
                                    removeBtn.type = 'button';
                                    removeBtn.className = 'text-red-500 hover:text-red-700 text-xs font-bold px-2';
                                    removeBtn.textContent = '✕';
                                    removeBtn.onclick = function(e) {
                                      e.stopPropagation();
                                      const parentDiv = this.parentElement;
                                      const removeId = parentDiv.dataset.selectedId;
                                      const hiddenInput = document.querySelector('input[name="add_participant"][value="' + removeId + '"]');
                                      if (hiddenInput) hiddenInput.remove();
                                      parentDiv.remove();
                                    };
                                    
                                    div.appendChild(content);
                                    div.appendChild(removeBtn);
                                    container.appendChild(div);
                                    
                                    // Crear input hidden
                                    const input = document.createElement('input');
                                    input.type = 'hidden';
                                    input.name = 'add_participant';
                                    input.value = id;
                                    container.appendChild(input);
                                    
                                    // Ocultar de la lista
                                    this.classList.add('hidden');
                                    document.getElementById('participant-search').value = '';
                                    document.getElementById('search-results').classList.add('hidden');
                                  `}
                                >
                                  <span class="font-medium">{u.name}</span>
                                  <span class="text-gray-500 ml-2">({u.email})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Participantes seleccionados para añadir */}
                          <div id="selected-participants" class="mt-2 space-y-1">
                            {/* Los participantes seleccionados se añaden aquí dinámicamente */}
                          </div>
                          
                          <p class="text-xs text-gray-500 mt-2 italic">Escribe para buscar usuarios de la organización.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Botón para enviar datos sensibles */}
                {canAddSecureKeys && (
                  <div class="border border-amber-200 rounded-lg p-3 bg-amber-50">
                    <button 
                      type="button"
                      onclick="document.getElementById('secure-key-section').classList.toggle('hidden');"
                      class="flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-900"
                    >
                      <span>🔐</span>
                      <span>Enviar datos sensibles</span>
                    </button>
                    
                    <div id="secure-key-section" class="hidden mt-3 space-y-3">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Dato sensible (será encriptado)</label>
                        <input 
                          type="text"
                          id="secure-key-value-input"
                          name="secure_key_value"
                          placeholder="La contraseña, clave o dato sensible"
                          oninput={`
                            const normalBtn = document.getElementById('message-submit-btn');
                            const secureBtn = document.getElementById('secure-key-submit-btn');
                            const checkbox = document.getElementById('secure-key-accept-risk');
                            const warning = document.getElementById('secure-key-blocked-warning');
                            if (this.value.trim()) {
                              // Hay dato sensible - bloquear botón normal
                              normalBtn.disabled = true;
                              normalBtn.classList.add('opacity-50', 'cursor-not-allowed');
                              warning.classList.remove('hidden');
                              // Si el checkbox no está marcado, mantener oculto el botón rojo
                              if (!checkbox.checked) {
                                secureBtn.classList.add('hidden');
                              }
                            } else {
                              // No hay dato sensible - restaurar botón normal
                              normalBtn.disabled = false;
                              normalBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                              normalBtn.classList.remove('hidden');
                              warning.classList.add('hidden');
                              secureBtn.classList.add('hidden');
                              checkbox.checked = false;
                            }
                          `}
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                      </div>
                      
                      {/* Advertencia y checkbox */}
                      <div class="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div class="flex items-start gap-2 text-sm text-red-700">
                          <span class="text-lg">⚠️</span>
                          <p>
                            Esta clave podrá ser vista por <strong>todos los participantes del ticket</strong>.
                            Asegúrate de compartir información solo con las personas correctas.
                          </p>
                        </div>
                        <input type="hidden" id="secure-key-confirmed" name="secure_key_confirmed" value="0" />
                        <label class="flex items-center gap-2 mt-3 cursor-pointer">
                          <input 
                            type="checkbox" 
                            id="secure-key-accept-risk"
                            onchange={`
                              document.getElementById('secure-key-confirmed').value = this.checked ? '1' : '0';
                              const btn = document.getElementById('secure-key-submit-btn');
                              const normalBtn = document.getElementById('message-submit-btn');
                              const warning = document.getElementById('secure-key-blocked-warning');
                              if (this.checked) {
                                const value = document.getElementById('secure-key-value-input').value.trim();
                                if (!value) {
                                  alert('Debes ingresar el dato sensible primero');
                                  this.checked = false;
                                  return;
                                }
                                warning.classList.add('hidden');
                                btn.classList.remove('hidden');
                                normalBtn.classList.add('hidden');
                                btn.disabled = true;
                                btn.classList.add('opacity-50', 'cursor-not-allowed');
                                let countdown = 5;
                                btn.textContent = '🔐 Enviar (' + countdown + 's)';
                                const interval = setInterval(() => {
                                  countdown--;
                                  if (countdown > 0) {
                                    btn.textContent = '🔐 Enviar (' + countdown + 's)';
                                  } else {
                                    clearInterval(interval);
                                    btn.textContent = '🔐 Enviar con clave';
                                    btn.disabled = false;
                                    btn.classList.remove('opacity-50', 'cursor-not-allowed');
                                  }
                                }, 1000);
                              } else {
                                btn.classList.add('hidden');
                                normalBtn.classList.remove('hidden');
                                normalBtn.disabled = true;
                                normalBtn.classList.add('opacity-50', 'cursor-not-allowed');
                                warning.classList.remove('hidden');
                              }
                            `}
                            class="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                          />
                          <span class="text-sm font-medium text-red-800">Acepto los riesgos</span>
                        </label>
                      </div>
                      
                      <p class="text-xs text-gray-500 italic">
                        🔒 La clave se encriptará con AES-256 y solo será visible para los participantes autorizados.
                      </p>
                    </div>
                  </div>
                )}
                
                <div class="flex justify-between items-center">
                  {isInternalTeam && !isClosed && (
                    <label class="flex items-center space-x-2">
                      <input type="checkbox" name="is_internal" value="1" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span class="text-sm text-gray-600">Nota interna</span>
                    </label>
                  )}
                  {isClosed && (
                    <input type="hidden" name="is_internal" value="1" />
                  )}
                  {!isInternalTeam && !isClosed && <div></div>}
                  <div class="flex items-center gap-3">
                    <span id="secure-key-blocked-warning" class="hidden text-sm text-amber-600">
                      ⚠️ Marca "Acepto los riesgos" para enviar
                    </span>
                    <button 
                      type="submit"
                      id="message-submit-btn"
                      class="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
                    >
                      {isClosed ? 'Añadir Nota' : 'Enviar'}
                    </button>
                    <button 
                      type="submit"
                      id="secure-key-submit-btn"
                      disabled
                      class="hidden px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 opacity-50 cursor-not-allowed"
                    >
                      🔐 Enviar (5s)
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
          
          {!canAddMessage && (
            <div class="px-6 py-4 border-t border-gray-200 text-center text-gray-500">
              No puedes añadir mensajes a un ticket cerrado.
            </div>
          )}
        </div>
        
        <div class="flex justify-start">
          <a href="/tickets" class="text-blue-600 hover:text-blue-700">
            ← Volver a tickets
          </a>
        </div>
        
        {/* Modal para cambiar estado */}
        <div id="status-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Cambiar Estado del Ticket</h3>
            <form method="post" action={`/tickets/${ticket.id}/status`}>
              <input type="hidden" id="new-status" name="status" value="" />
              
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Mensaje (requerido)</label>
                <textarea 
                  name="message" 
                  rows={3}
                  required
                  placeholder="Explica el motivo del cambio de estado..."
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                ></textarea>
              </div>
              
              <div class="flex justify-end gap-3">
                <button 
                  type="button"
                  onclick="document.getElementById('status-modal').classList.add('hidden');"
                  class="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  class="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
                >
                  Cambiar Estado
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
});

/**
 * POST /tickets/:id/assign - Asignarse un ticket (agente)
 */
ticketRoutes.post('/tickets/:id/assign', requireAuth, async (c) => {
  const user = c.get('user')!;
  const ticketId = parseInt(c.req.param('id'));
  
  // Solo equipo interno puede asignarse tickets (NO org_admin - es rol de cliente)
  const isInternalTeam = user.role === 'super_admin' || user.role === 'agent_admin' || user.role === 'agent';
  if (!isInternalTeam) {
    return c.text('No autorizado', 403);
  }
  
  try {
    const ticket = await c.env.DB
      .prepare('SELECT status, assigned_to, tenant_id FROM tickets WHERE id = ?')
      .bind(ticketId)
      .first<{ status: string; assigned_to: number | null; tenant_id: number }>();
    
    if (!ticket) {
      return c.text('Ticket no encontrado', 404);
    }
    
    // Verificar que el ticket esté abierto y sin asignar
    if (ticket.status !== 'open' || ticket.assigned_to) {
      return c.text('Este ticket ya está asignado o no está abierto', 400);
    }
    
    // Asignar y cambiar estado a in_progress
    await c.env.DB
      .prepare("UPDATE tickets SET assigned_to = ?, status = 'in_progress', updated_at = datetime('now') WHERE id = ?")
      .bind(user.id, ticketId)
      .run();
    
    // Añadir mensaje automático
    await c.env.DB
      .prepare('INSERT INTO messages (ticket_id, user_id, content, is_internal) VALUES (?, ?, ?, 0)')
      .bind(ticketId, user.id, `📋 ${user.name} se ha asignado este ticket y lo ha puesto en progreso.`)
      .run();
    
    return c.redirect(`/tickets/${ticketId}`);
    
  } catch (error) {
    console.error('Assign ticket error:', error);
    return c.text('Error al asignar ticket', 500);
  }
});

/**
 * POST /tickets/:id/reassign - Asignar o reasignar un ticket a un agente específico
 * Solo super_admin, admin y agent_admin pueden usar esta función
 */
ticketRoutes.post('/tickets/:id/reassign', requireAgentManager, async (c) => {
  const user = c.get('user')!;
  const ticketId = parseInt(c.req.param('id'));
  
  try {
    const formData = await c.req.formData();
    const agentIdStr = formData.get('agent_id') as string;
    
    if (!agentIdStr) {
      return c.text('Debes seleccionar un agente', 400);
    }
    
    const agentId = parseInt(agentIdStr);
    
    // Obtener información del ticket
    const ticket = await c.env.DB
      .prepare('SELECT status, assigned_to, tenant_id FROM tickets WHERE id = ?')
      .bind(ticketId)
      .first<{ status: string; assigned_to: number | null; tenant_id: number }>();
    
    if (!ticket) {
      return c.text('Ticket no encontrado', 404);
    }
    
    // No se puede reasignar tickets cerrados
    if (ticket.status === 'closed') {
      return c.text('No se puede reasignar un ticket cerrado', 400);
    }
    
    // Verificar que el agente existe y tiene un rol válido
    // Los agentes son globales y pueden trabajar con tickets de cualquier organización
    // Solo roles internos pueden ser asignados (no org_admin que es rol de cliente)
    const agent = await c.env.DB
      .prepare(`SELECT id, name, role FROM users WHERE id = ? AND is_active = 1 AND role IN ('super_admin', 'agent_admin', 'agent')`)
      .bind(agentId)
      .first<{ id: number; name: string; role: string }>();
    
    if (!agent) {
      return c.text('Agente no encontrado o inválido', 404);
    }
    
    // Si es la misma persona, no hacer nada
    if (ticket.assigned_to === agentId) {
      return c.redirect(`/tickets/${ticketId}`);
    }
    
    const previousAssigned = ticket.assigned_to;
    
    // Actualizar asignación y cambiar estado si es necesario
    const newStatus = ticket.status === 'open' ? 'in_progress' : ticket.status;
    await c.env.DB
      .prepare("UPDATE tickets SET assigned_to = ?, status = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(agentId, newStatus, ticketId)
      .run();
    
    // Añadir mensaje automático
    const messageContent = previousAssigned 
      ? `🔄 ${user.name} ha reasignado este ticket a ${agent.name}.`
      : `📋 ${user.name} ha asignado este ticket a ${agent.name}.`;
    
    await c.env.DB
      .prepare('INSERT INTO messages (ticket_id, user_id, content, is_internal) VALUES (?, ?, ?, 0)')
      .bind(ticketId, user.id, messageContent)
      .run();
    
    return c.redirect(`/tickets/${ticketId}`);
    
  } catch (error) {
    console.error('Reassign ticket error:', error);
    return c.text('Error al reasignar ticket', 500);
  }
});

/**
 * POST /tickets/:id/status - Cambiar estado del ticket
 */
ticketRoutes.post('/tickets/:id/status', requireAuth, async (c) => {
  const user = c.get('user')!;
  const ticketId = parseInt(c.req.param('id'));
  
  // Solo equipo interno puede cambiar estado (NO org_admin - es rol de cliente)
  const isInternalTeam = user.role === 'super_admin' || user.role === 'agent_admin' || user.role === 'agent';
  if (!isInternalTeam) {
    return c.text('No autorizado', 403);
  }
  
  try {
    const formData = await c.req.formData();
    const newStatus = formData.get('status') as string;
    const message = formData.get('message') as string;
    
    if (!message || message.trim().length === 0) {
      return c.text('Debes incluir un mensaje al cambiar el estado', 400);
    }
    
    const validStatuses = ['open', 'in_progress', 'pending', 'resolved', 'closed'];
    if (!validStatuses.includes(newStatus)) {
      return c.text('Estado inválido', 400);
    }
    
    const ticket = await c.env.DB
      .prepare('SELECT status, tenant_id FROM tickets WHERE id = ?')
      .bind(ticketId)
      .first<{ status: string; tenant_id: number }>();
    
    if (!ticket) {
      return c.text('Ticket no encontrado', 404);
    }
    
    // Si el ticket está cerrado, solo super_admin puede cambiar el estado
    if (ticket.status === 'closed' && user.role !== 'super_admin') {
      return c.text('Solo el super administrador puede cambiar el estado de un ticket cerrado', 403);
    }
    
    // Verificar acceso al tenant (excepto super_admin)
    if (user.role !== 'super_admin' && ticket.tenant_id !== user.tenant_id) {
      return c.text('No tienes acceso a este ticket', 403);
    }
    
    // Actualizar estado
    await c.env.DB
      .prepare("UPDATE tickets SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(newStatus, ticketId)
      .run();
    
    // Añadir mensaje con el cambio de estado
    const statusLabel = TICKET_STATUS_LABELS[newStatus] || newStatus;
    await c.env.DB
      .prepare('INSERT INTO messages (ticket_id, user_id, content, is_internal) VALUES (?, ?, ?, 0)')
      .bind(ticketId, user.id, `📌 Estado cambiado a "${statusLabel}"\n\n${message}`)
      .run();
    
    return c.redirect(`/tickets/${ticketId}`);
    
  } catch (error) {
    console.error('Change status error:', error);
    return c.text('Error al cambiar estado', 500);
  }
});

/**
 * POST /tickets/:id/participants - Añadir participante a un ticket
 */
ticketRoutes.post('/tickets/:id/participants', requireAuth, async (c) => {
  const user = c.get('user')!;
  const ticketId = parseInt(c.req.param('id'));
  
  try {
    const formData = await c.req.formData();
    const participantId = parseInt(formData.get('user_id') as string);
    
    if (!participantId) {
      return c.text('Debes seleccionar un usuario', 400);
    }
    
    // Obtener información del ticket
    const ticket = await c.env.DB
      .prepare('SELECT status, tenant_id, created_by FROM tickets WHERE id = ?')
      .bind(ticketId)
      .first<{ status: string; tenant_id: number; created_by: number }>();
    
    if (!ticket) {
      return c.text('Ticket no encontrado', 404);
    }
    
    // No se pueden añadir participantes a tickets cerrados
    if (ticket.status === 'closed') {
      return c.text('No se pueden añadir participantes a un ticket cerrado', 400);
    }
    
    // Verificar que el usuario actual tiene acceso al ticket
    const isInternalTeam = user.role === 'super_admin' || user.role === 'agent_admin' || user.role === 'agent';
    const isParticipant = await c.env.DB
      .prepare('SELECT 1 FROM ticket_participants WHERE ticket_id = ? AND user_id = ?')
      .bind(ticketId, user.id)
      .first();
    
    const hasAccess = isInternalTeam || 
      (user.role === 'org_admin' && ticket.tenant_id === user.tenant_id) ||
      ticket.created_by === user.id ||
      isParticipant;
    
    if (!hasAccess) {
      return c.text('No tienes acceso a este ticket', 403);
    }
    
    // Verificar que el participante a añadir pertenece a la misma organización del ticket
    const participantUser = await c.env.DB
      .prepare('SELECT tenant_id, is_active FROM users WHERE id = ?')
      .bind(participantId)
      .first<{ tenant_id: number; is_active: number }>();
    
    if (!participantUser) {
      return c.text('Usuario no encontrado', 404);
    }
    
    if (!participantUser.is_active) {
      return c.text('El usuario no está activo', 400);
    }
    
    if (participantUser.tenant_id !== ticket.tenant_id) {
      return c.text('Solo se pueden añadir participantes de la misma organización', 400);
    }
    
    // No añadir al creador del ticket
    if (participantId === ticket.created_by) {
      return c.text('El creador del ticket ya tiene acceso', 400);
    }
    
    // Insertar participante (UNIQUE constraint previene duplicados)
    await c.env.DB
      .prepare('INSERT INTO ticket_participants (ticket_id, user_id, added_by) VALUES (?, ?, ?)')
      .bind(ticketId, participantId, user.id)
      .run();
    
    // Obtener nombre del participante para el mensaje
    const participantName = await c.env.DB
      .prepare('SELECT name FROM users WHERE id = ?')
      .bind(participantId)
      .first<{ name: string }>();
    
    // Añadir mensaje automático
    await c.env.DB
      .prepare('INSERT INTO messages (ticket_id, user_id, content, is_internal) VALUES (?, ?, ?, 0)')
      .bind(ticketId, user.id, `👥 ${user.name} añadió a ${participantName?.name || 'un usuario'} como participante del ticket.`)
      .run();
    
    return c.redirect(`/tickets/${ticketId}`);
    
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return c.text('Este usuario ya es participante del ticket', 400);
    }
    console.error('Add participant error:', error);
    return c.text('Error al añadir participante', 500);
  }
});

// ================================================
// RUTAS DE CLAVES SEGURAS
// ================================================

/**
 * POST /tickets/:id/secure-keys - Añadir clave segura a un ticket
 */
ticketRoutes.post('/tickets/:id/secure-keys', requireAuth, async (c) => {
  const user = c.get('user')!;
  const ticketId = parseInt(c.req.param('id'));
  
  try {
    // Obtener información del ticket
    const ticket = await c.env.DB
      .prepare('SELECT status, tenant_id, created_by, assigned_to FROM tickets WHERE id = ?')
      .bind(ticketId)
      .first<{ status: string; tenant_id: number; created_by: number; assigned_to: number | null }>();
    
    if (!ticket) {
      return c.text('Ticket no encontrado', 404);
    }
    
    // No se pueden añadir claves a tickets cerrados
    if (ticket.status === 'closed') {
      return c.text('No se pueden añadir claves a un ticket cerrado', 400);
    }
    
    // Verificar acceso para añadir claves
    const isInternalTeam = user.role === 'super_admin' || user.role === 'agent_admin' || user.role === 'agent';
    const isParticipant = await c.env.DB
      .prepare('SELECT 1 FROM ticket_participants WHERE ticket_id = ? AND user_id = ?')
      .bind(ticketId, user.id)
      .first();
    
    const canAddKeys = isInternalTeam || 
      ticket.created_by === user.id ||
      ticket.assigned_to === user.id ||
      isParticipant;
    
    if (!canAddKeys) {
      return c.text('No tienes permiso para añadir claves a este ticket', 403);
    }
    
    const formData = await c.req.formData();
    const value = formData.get('value') as string;
    
    if (!value) {
      return c.text('El valor es requerido', 400);
    }
    
    // Crear clave segura usando el servicio
    await createSecureKey(c.env.DB, {
      ticketId,
      value,
      createdBy: user.id
    }, c.env.APP_SECRET);
    
    // Añadir nota interna automática
    await logSecureKeyCreation(c.env.DB, ticketId, user.id, user.name);
    
    return c.redirect(`/tickets/${ticketId}`);
    
  } catch (error) {
    console.error('Add secure key error:', error);
    return c.text('Error al añadir clave segura', 500);
  }
});

/**
 * GET /tickets/:id/secure-keys/:keyId/decrypt - Obtener valor desencriptado de una clave
 */
ticketRoutes.get('/tickets/:id/secure-keys/:keyId/decrypt', requireAuth, async (c) => {
  const user = c.get('user')!;
  const ticketId = parseInt(c.req.param('id'));
  const keyId = parseInt(c.req.param('keyId'));
  
  try {
    // Obtener información del ticket
    const ticket = await c.env.DB
      .prepare('SELECT tenant_id, created_by, assigned_to FROM tickets WHERE id = ?')
      .bind(ticketId)
      .first<{ tenant_id: number; created_by: number; assigned_to: number | null }>();
    
    if (!ticket) {
      return c.json({ error: 'Ticket no encontrado' }, 404);
    }
    
    // Verificar acceso para ver claves
    const isInternalTeam = user.role === 'super_admin' || user.role === 'agent_admin' || user.role === 'agent';
    const isParticipant = await c.env.DB
      .prepare('SELECT 1 FROM ticket_participants WHERE ticket_id = ? AND user_id = ?')
      .bind(ticketId, user.id)
      .first();
    
    const canViewKeys = isInternalTeam || 
      ticket.created_by === user.id ||
      ticket.assigned_to === user.id ||
      isParticipant;
    
    if (!canViewKeys) {
      return c.json({ error: 'No tienes permiso para ver esta clave' }, 403);
    }
    
    // Obtener la clave usando el servicio
    const secureKey = await getSecureKeyById(c.env.DB, keyId);
    
    if (!secureKey || secureKey.ticket_id !== ticketId) {
      return c.json({ error: 'Clave no encontrada' }, 404);
    }
    
    // Desencriptar usando el servicio
    const decryptedValue = await decryptSecureKey(secureKey, c.env.APP_SECRET);
    
    return c.json({ value: decryptedValue });
    
  } catch (error) {
    console.error('Decrypt key error:', error);
    return c.json({ error: 'Error al desencriptar la clave' }, 500);
  }
});

/**
 * POST /tickets/:id/secure-keys/:keyId/delete - Eliminar una clave segura
 */
ticketRoutes.post('/tickets/:id/secure-keys/:keyId/delete', requireAuth, async (c) => {
  const user = c.get('user')!;
  const ticketId = parseInt(c.req.param('id'));
  const keyId = parseInt(c.req.param('keyId'));
  
  try {
    // Obtener información del ticket
    const ticket = await c.env.DB
      .prepare('SELECT status, tenant_id, created_by FROM tickets WHERE id = ?')
      .bind(ticketId)
      .first<{ status: string; tenant_id: number; created_by: number }>();
    
    if (!ticket) {
      return c.text('Ticket no encontrado', 404);
    }
    
    // No se pueden eliminar claves de tickets cerrados
    if (ticket.status === 'closed') {
      return c.text('No se pueden modificar claves de un ticket cerrado', 400);
    }
    
    // Solo equipo interno o el creador del ticket pueden eliminar claves
    const isInternalTeam = user.role === 'super_admin' || user.role === 'agent_admin' || user.role === 'agent';
    const canDeleteKeys = isInternalTeam || ticket.created_by === user.id;
    
    if (!canDeleteKeys) {
      return c.text('No tienes permiso para eliminar claves', 403);
    }
    
    // Obtener info de la clave antes de eliminar usando el servicio
    const secureKey = await getSecureKeyById(c.env.DB, keyId);
    
    if (!secureKey || secureKey.ticket_id !== ticketId) {
      return c.text('Clave no encontrada', 404);
    }
    
    // Eliminar la clave usando el servicio
    await deleteSecureKey(c.env.DB, keyId);
    
    // Añadir nota interna automática
    await logSecureKeyDeletion(c.env.DB, ticketId, user.id, user.name);
    
    return c.redirect(`/tickets/${ticketId}`);
    
  } catch (error) {
    console.error('Delete secure key error:', error);
    return c.text('Error al eliminar clave segura', 500);
  }
});

/**
 * POST /tickets/:id/messages - Añadir mensaje a ticket
 */
ticketRoutes.post('/tickets/:id/messages', requireAuth, async (c) => {
  const user = c.get('user')!;
  const ticketId = parseInt(c.req.param('id'));
  
  try {
    // Obtener ticket para verificar estado
    const ticket = await c.env.DB
      .prepare('SELECT status, tenant_id, created_by, assigned_to FROM tickets WHERE id = ?')
      .bind(ticketId)
      .first<{ status: string; tenant_id: number; created_by: number; assigned_to: number | null }>();
    
    if (!ticket) {
      return c.text('Ticket no encontrado', 404);
    }
    
    // Verificar acceso al ticket
    // super_admin y agent_admin tienen acceso global, pero agent solo si está asignado
    const isManager = user.role === 'super_admin' || user.role === 'agent_admin';
    const isAssignedAgent = user.role === 'agent' && ticket.assigned_to === user.id;
    const isInternalTeam = isManager || isAssignedAgent;
    const isParticipant = await c.env.DB
      .prepare('SELECT 1 FROM ticket_participants WHERE ticket_id = ? AND user_id = ?')
      .bind(ticketId, user.id)
      .first();
    
    const hasAccess = isInternalTeam || 
      (user.role === 'org_admin' && ticket.tenant_id === user.tenant_id) ||
      ticket.created_by === user.id ||
      isParticipant;
    
    if (!hasAccess) {
      return c.text('No tienes acceso a este ticket', 403);
    }
    
    const formData = await c.req.formData();
    const content = formData.get('content') as string;
    let isInternal = formData.get('is_internal') === '1' ? 1 : 0;
    
    // Obtener participantes a mantener y añadir
    const keepParticipants = formData.getAll('keep_participant').map(v => parseInt(v as string));
    const addParticipants = formData.getAll('add_participant').map(v => parseInt(v as string));
    
    if (!content) {
      return c.text('El contenido es requerido', 400);
    }
    
    const isClosed = ticket.status === 'closed';
    
    // Si el ticket está cerrado
    if (isClosed) {
      // Solo equipo interno puede añadir notas en tickets cerrados
      if (!isInternalTeam) {
        return c.text('No puedes añadir mensajes a un ticket cerrado', 403);
      }
      // Solo notas internas en tickets cerrados
      isInternal = 1;
    }
    
    // Solo equipo interno puede añadir notas internas
    if (isInternal === 1 && !isInternalTeam) {
      isInternal = 0; // Forzar a público si no es equipo interno
    }
    
    // Procesar cambios de participantes (solo si no está cerrado)
    if (!isClosed) {
      // Verificar que el usuario puede gestionar participantes
      const canManageParticipants = isInternalTeam || 
        (user.role === 'org_admin' && ticket.tenant_id === user.tenant_id) ||
        ticket.created_by === user.id;
      
      if (canManageParticipants) {
        // Obtener participantes actuales (excluyendo al creador)
        const currentParticipants = await c.env.DB
          .prepare('SELECT user_id FROM ticket_participants WHERE ticket_id = ?')
          .bind(ticketId)
          .all<{ user_id: number }>();
        
        const currentIds = currentParticipants.results?.map(p => p.user_id) || [];
        const participantChanges: string[] = [];
        
        // Quitar participantes que no están marcados
        for (const currentId of currentIds) {
          if (!keepParticipants.includes(currentId)) {
            // Obtener nombre antes de eliminar
            const removedUser = await c.env.DB
              .prepare('SELECT name FROM users WHERE id = ?')
              .bind(currentId)
              .first<{ name: string }>();
            
            await c.env.DB
              .prepare('DELETE FROM ticket_participants WHERE ticket_id = ? AND user_id = ?')
              .bind(ticketId, currentId)
              .run();
            
            if (removedUser) {
              participantChanges.push(`❌ ${removedUser.name} fue removido del ticket`);
            }
          }
        }
        
        // Añadir nuevos participantes
        for (const newId of addParticipants) {
          // Verificar que el usuario existe y está en el mismo tenant
          const newUser = await c.env.DB
            .prepare('SELECT id, name, tenant_id FROM users WHERE id = ? AND is_active = 1')
            .bind(newId)
            .first<{ id: number; name: string; tenant_id: number | null }>();
          
          if (newUser && newUser.tenant_id === ticket.tenant_id) {
            try {
              await c.env.DB
                .prepare('INSERT INTO ticket_participants (ticket_id, user_id, added_by) VALUES (?, ?, ?)')
                .bind(ticketId, newId, user.id)
                .run();
              participantChanges.push(`✅ ${newUser.name} fue añadido al ticket`);
            } catch (e) {
              // Ignorar si ya existe
            }
          }
        }
        
        // Añadir nota automática de cambios de participantes
        if (participantChanges.length > 0) {
          const changeNote = `👥 Cambios de participantes:\n${participantChanges.join('\n')}`;
          await c.env.DB
            .prepare('INSERT INTO messages (ticket_id, user_id, content, is_internal) VALUES (?, ?, ?, 1)')
            .bind(ticketId, user.id, changeNote)
            .run();
        }
      }
    }
    
    // Insertar mensaje
    const messageResult = await c.env.DB
      .prepare('INSERT INTO messages (ticket_id, user_id, content, is_internal) VALUES (?, ?, ?, ?)')
      .bind(ticketId, user.id, content, isInternal)
      .run();
    
    // Obtener el ID del mensaje insertado
    const messageId = messageResult.meta?.last_row_id;
    
    // Procesar clave segura si se envió
    const secureKeyValue = (formData.get('secure_key_value') as string)?.trim();
    const secureKeyConfirmed = formData.get('secure_key_confirmed') === '1';
    
    // VALIDACIÓN DEL SERVIDOR: Si hay clave pero no confirmación, rechazar
    if (secureKeyValue && !secureKeyConfirmed) {
      return c.text('Debes aceptar los riesgos para enviar datos sensibles', 400);
    }
    
    if (secureKeyValue && secureKeyConfirmed && messageId) {
      // Crear clave segura vinculada al mensaje usando el servicio
      await createSecureKey(c.env.DB, {
        ticketId,
        value: secureKeyValue,
        createdBy: user.id,
        messageId: Number(messageId)
      }, c.env.APP_SECRET);
    }
    
    // Actualizar fecha de actualización del ticket
    await c.env.DB
      .prepare("UPDATE tickets SET updated_at = datetime('now') WHERE id = ?")
      .bind(ticketId)
      .run();
    
    // Si el ticket estaba en "Resuelto" y se añade un mensaje público, volver a "En Progreso"
    if (ticket.status === 'resolved' && isInternal === 0) {
      await c.env.DB
        .prepare("UPDATE tickets SET status = 'in_progress' WHERE id = ?")
        .bind(ticketId)
        .run();
      
      // Añadir nota automática
      await c.env.DB
        .prepare('INSERT INTO messages (ticket_id, user_id, content, is_internal) VALUES (?, ?, ?, 1)')
        .bind(ticketId, user.id, '🔄 El ticket ha vuelto a "En Progreso" debido a un nuevo mensaje.')
        .run();
    }
    
    return c.redirect(`/tickets/${ticketId}`);
    
  } catch (error) {
    console.error('Add message error:', error);
    return c.text('Error al añadir mensaje', 500);
  }
});

export { ticketRoutes };
