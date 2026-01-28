/**
 * ActionQ - Componentes de Páginas
 * 
 * Páginas principales de la aplicación.
 */

import type { FC } from 'hono/jsx';
import type { SessionUser, Ticket } from '../types';

// ================================================
// PÁGINA DE SETUP (Primera instalación)
// ================================================

interface SetupPageProps {
  adminEmail: string;
  error?: string;
}

export const SetupPage: FC<SetupPageProps> = ({ adminEmail, error }) => {
  return (
    <div class="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
      <div class="text-center mb-8">
        <span class="text-5xl">🎫</span>
        <h1 class="mt-4 text-2xl font-bold text-gray-900">Configuración Inicial</h1>
        <p class="mt-2 text-sm text-gray-600">
          Bienvenido a ActionQ. Configura tu cuenta de administrador.
        </p>
      </div>
      
      {error && (
        <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-600">{error}</p>
        </div>
      )}
      
      <form method="post" action="/setup" class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Email del Administrador
          </label>
          <input 
            type="email" 
            name="email"
            value={adminEmail}
            readonly
            class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
          />
          <p class="mt-1 text-xs text-gray-500">
            Configurado en variables de entorno
          </p>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Nombre
          </label>
          <input 
            type="text" 
            name="name"
            required
            placeholder="Tu nombre completo"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Nombre de la Organización
          </label>
          <input 
            type="text" 
            name="organization"
            required
            placeholder="Mi Empresa"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <button 
          type="submit"
          class="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Completar Configuración
        </button>
      </form>
    </div>
  );
};

// ================================================
// PÁGINA DE LOGIN
// ================================================

interface LoginPageProps {
  error?: string;
}

export const LoginPage: FC<LoginPageProps> = ({ error }) => {
  return (
    <div class="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
      <div class="text-center mb-8">
        <span class="text-5xl">🎫</span>
        <h1 class="mt-4 text-2xl font-bold text-gray-900">Iniciar Sesión</h1>
        <p class="mt-2 text-sm text-gray-600">
          Accede a tu cuenta de ActionQ
        </p>
      </div>
      
      {error && (
        <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-600">{error}</p>
        </div>
      )}
      
      <form method="post" action="/login" class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input 
            type="email" 
            name="email"
            required
            placeholder="tu@email.com"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Contraseña
          </label>
          <input 
            type="password" 
            name="password"
            required
            placeholder="••••••••"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <button 
          type="submit"
          class="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Entrar
        </button>
      </form>
      
      <div class="mt-6 text-center">
        <p class="text-sm text-gray-600">
          ¿No tienes cuenta?{' '}
          <a href="/register" class="text-blue-600 hover:text-blue-700 font-medium">
            Regístrate
          </a>
        </p>
      </div>
    </div>
  );
};

// ================================================
// PÁGINA DE REGISTRO
// ================================================

interface RegisterPageProps {
  error?: string;
  success?: boolean;
}

export const RegisterPage: FC<RegisterPageProps> = ({ error, success }) => {
  return (
    <div class="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
      <div class="text-center mb-8">
        <span class="text-5xl">🎫</span>
        <h1 class="mt-4 text-2xl font-bold text-gray-900">Crear Cuenta</h1>
        <p class="mt-2 text-sm text-gray-600">
          Regístrate en ActionQ
        </p>
      </div>
      
      {error && (
        <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-600">{error}</p>
        </div>
      )}
      
      {success && (
        <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p class="text-sm text-green-600">
            ✅ Cuenta creada exitosamente.{' '}
            <a href="/login" class="font-medium underline">Inicia sesión</a>
          </p>
        </div>
      )}
      
      {!success && (
        <form method="post" action="/register" class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input 
              type="text" 
              name="name"
              required
              placeholder="Tu nombre"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Email corporativo
            </label>
            <input 
              type="email" 
              name="email"
              required
              placeholder="tu@empresa.com"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p class="mt-1 text-xs text-gray-500">
              Usa tu email corporativo autorizado
            </p>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input 
              type="password" 
              name="password"
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Confirmar contraseña
            </label>
            <input 
              type="password" 
              name="password_confirm"
              required
              minLength={8}
              placeholder="Repite la contraseña"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <button 
            type="submit"
            class="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Crear cuenta
          </button>
        </form>
      )}
      
      <div class="mt-6 text-center">
        <p class="text-sm text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <a href="/login" class="text-blue-600 hover:text-blue-700 font-medium">
            Inicia sesión
          </a>
        </p>
      </div>
    </div>
  );
};

// ================================================
// PÁGINA DE DASHBOARD
// ================================================

interface DashboardPageProps {
  user: SessionUser;
  stats: {
    totalTickets: number;
    openTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
  };
  recentTickets: Ticket[];
}

export const DashboardPage: FC<DashboardPageProps> = ({ user, stats, recentTickets }) => {
  return (
    <div class="space-y-6">
      {/* Bienvenida */}
      <div class="bg-white rounded-lg shadow p-6">
        <h1 class="text-2xl font-bold text-gray-900">
          Bienvenido, {user.name} 👋
        </h1>
        <p class="mt-1 text-gray-600">
          Aquí tienes un resumen de tu actividad
        </p>
      </div>
      
      {/* Estadísticas */}
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          title="Total Tickets" 
          value={stats.totalTickets} 
          icon="📊" 
          color="gray"
        />
        <StatCard 
          title="Abiertos" 
          value={stats.openTickets} 
          icon="📬" 
          color="blue"
        />
        <StatCard 
          title="En Progreso" 
          value={stats.inProgressTickets} 
          icon="⏳" 
          color="yellow"
        />
        <StatCard 
          title="Resueltos" 
          value={stats.resolvedTickets} 
          icon="✅" 
          color="green"
        />
      </div>
      
      {/* Tickets recientes */}
      <div class="bg-white rounded-lg shadow">
        <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-900">Tickets Recientes</h2>
          <a href="/tickets/new" class="text-sm text-blue-600 hover:text-blue-700 font-medium">
            + Nuevo Ticket
          </a>
        </div>
        
        {recentTickets.length > 0 ? (
          <ul class="divide-y divide-gray-200">
            {recentTickets.map((ticket) => (
              <li key={ticket.id} class="px-6 py-4 hover:bg-gray-50">
                <a href={`/tickets/${ticket.id}`} class="flex items-center justify-between">
                  <div>
                    <p class="font-medium text-gray-900">{ticket.title}</p>
                    <p class="text-sm text-gray-500">#{ticket.id}</p>
                  </div>
                  <div class="flex items-center space-x-2">
                    <StatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                  </div>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div class="px-6 py-12 text-center">
            <span class="text-4xl">📭</span>
            <p class="mt-2 text-gray-500">No hay tickets todavía</p>
            <a 
              href="/tickets/new" 
              class="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Crear primer ticket
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

// ================================================
// COMPONENTES AUXILIARES
// ================================================

interface StatCardProps {
  title: string;
  value: number;
  icon: string;
  color: 'gray' | 'blue' | 'yellow' | 'green';
}

const StatCard: FC<StatCardProps> = ({ title, value, icon, color }) => {
  const colorClasses = {
    gray: 'bg-gray-50 text-gray-600',
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    green: 'bg-green-50 text-green-600',
  };
  
  return (
    <div class={`rounded-lg p-6 ${colorClasses[color]}`}>
      <div class="flex items-center justify-between">
        <span class="text-2xl">{icon}</span>
        <span class="text-3xl font-bold">{value}</span>
      </div>
      <p class="mt-2 text-sm font-medium">{title}</p>
    </div>
  );
};

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: FC<StatusBadgeProps> = ({ status }) => {
  const statusConfig: Record<string, { label: string; class: string }> = {
    open: { label: 'Abierto', class: 'bg-blue-100 text-blue-800' },
    in_progress: { label: 'En Progreso', class: 'bg-yellow-100 text-yellow-800' },
    pending: { label: 'Pendiente', class: 'bg-orange-100 text-orange-800' },
    resolved: { label: 'Resuelto', class: 'bg-green-100 text-green-800' },
    closed: { label: 'Cerrado', class: 'bg-gray-100 text-gray-800' },
  };
  
  const config = statusConfig[status] || statusConfig.open;
  
  return (
    <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.class}`}>
      {config.label}
    </span>
  );
};

interface PriorityBadgeProps {
  priority: string;
}

const PriorityBadge: FC<PriorityBadgeProps> = ({ priority }) => {
  const priorityConfig: Record<string, { label: string; class: string }> = {
    low: { label: 'Baja', class: 'bg-gray-100 text-gray-600' },
    medium: { label: 'Media', class: 'bg-blue-100 text-blue-600' },
    high: { label: 'Alta', class: 'bg-orange-100 text-orange-600' },
    urgent: { label: 'Urgente', class: 'bg-red-100 text-red-600' },
  };
  
  const config = priorityConfig[priority] || priorityConfig.medium;
  
  return (
    <span class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.class}`}>
      {config.label}
    </span>
  );
};

// Exportar componentes auxiliares para uso en otras páginas
export { StatusBadge, PriorityBadge, StatCard };
