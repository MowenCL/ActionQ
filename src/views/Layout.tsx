/**
 * ActionQ - Layout Principal
 * 
 * Componente base que envuelve todas las páginas.
 * Incluye TailwindCSS y HTMX via CDN.
 */

import type { FC, PropsWithChildren } from 'hono/jsx';
import type { SessionUser } from '../types';

interface LayoutProps {
  title?: string;
  user?: SessionUser | null;
  showNav?: boolean;
  sessionTimeoutMinutes?: number;
}

/**
 * Layout principal de la aplicación.
 * Incluye cabecera, navegación y footer.
 */
export const Layout: FC<PropsWithChildren<LayoutProps>> = ({ 
  children, 
  title = 'ActionQ',
  user = null,
  showNav = true,
  sessionTimeoutMinutes = 5
}) => {
  return (
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} | ActionQ</title>
        
        {/* TailwindCSS via CDN */}
        <script src="https://cdn.tailwindcss.com"></script>
        
        {/* HTMX para interactividad */}
        <script src="https://unpkg.com/htmx.org@2.0.4" integrity="sha384-HGfztofotfshcF7+8n44JQL2oJmowVChPTg48S+jvZoztPfvwD79OC/LTtG6dMp+" crossorigin="anonymous"></script>
        
        {/* Estilos adicionales */}
        <style dangerouslySetInnerHTML={{ __html: `
          /* Indicador de carga HTMX */
          .htmx-request .htmx-indicator {
            display: inline-block;
          }
          .htmx-indicator {
            display: none;
          }
          
          /* Transiciones suaves */
          .htmx-swapping {
            opacity: 0;
            transition: opacity .2s ease-out;
          }
        `}} />
      </head>
      <body class="min-h-screen bg-gray-50">
        {/* Navegación */}
        {showNav && (
          <nav class="bg-white shadow-sm border-b border-gray-200">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="flex justify-between h-16">
                {/* Logo */}
                <div class="flex items-center">
                  <a href="/" class="flex items-center space-x-2">
                    <span class="text-2xl">🎫</span>
                    <span class="font-bold text-xl text-gray-900">ActionQ</span>
                  </a>
                </div>
                
                {/* Navegación principal */}
                {user && (
                  <div class="hidden sm:flex sm:items-center sm:space-x-4">
                    <a href="/dashboard" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                      Dashboard
                    </a>
                    <a href="/tickets" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                      Tickets
                    </a>
                    {(user.role === 'super_admin' || user.role === 'org_admin') && (
                      <a href="/admin" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                        Administración
                      </a>
                    )}
                    {(user.role === 'super_admin' || user.role === 'agent_admin' || user.role === 'agent') && (
                      <a href="/admin/metrics" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                        Métricas
                      </a>
                    )}
                  </div>
                )}
                
                {/* Usuario / Auth */}
                <div class="flex items-center space-x-4">
                  {user ? (
                    <div class="flex items-center space-x-3">
                      <span class="text-sm text-gray-600">{user.name}</span>
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {user.role}
                      </span>
                      <a 
                        href="/logout" 
                        class="text-gray-500 hover:text-gray-700 text-sm"
                      >
                        Salir
                      </a>
                    </div>
                  ) : (
                    <a 
                      href="/login" 
                      class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Iniciar sesión
                    </a>
                  )}
                </div>
              </div>
            </div>
          </nav>
        )}
        
        {/* Contenido principal */}
        <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
        
        {/* Footer */}
        <footer class="bg-white border-t border-gray-200 mt-auto">
          <div class="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <p class="text-center text-sm text-gray-500">
              ActionQ - Sistema de Tickets Open Source
            </p>
          </div>
        </footer>
        
        {/* Modal de advertencia de sesión */}
        {user && (
          <div id="session-timeout-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 text-center">
              <span class="text-4xl">⏰</span>
              <h3 class="text-lg font-semibold text-gray-900 mt-3">Sesión por expirar</h3>
              <p class="text-gray-600 mt-2">
                Tu sesión se cerrará en <span id="session-countdown" class="font-bold text-red-600">30</span> segundos por inactividad.
              </p>
              <div class="mt-4 flex gap-3 justify-center">
                <a 
                  href="/logout" 
                  class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cerrar sesión
                </a>
                <button 
                  type="button"
                  id="keep-session-btn"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Mantener sesión activa
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Script de timeout de sesión */}
        {user && (
          <script dangerouslySetInnerHTML={{ __html: `
            (function() {
              const TIMEOUT_MINUTES = ${sessionTimeoutMinutes};
              const WARNING_SECONDS = 30;
              const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;
              const WARNING_MS = TIMEOUT_MS - (WARNING_SECONDS * 1000);
              
              let warningTimer = null;
              let logoutTimer = null;
              let countdownInterval = null;
              let countdownValue = WARNING_SECONDS;
              
              const modal = document.getElementById('session-timeout-modal');
              const countdownEl = document.getElementById('session-countdown');
              const keepBtn = document.getElementById('keep-session-btn');
              
              function showWarning() {
                countdownValue = WARNING_SECONDS;
                countdownEl.textContent = countdownValue;
                modal.classList.remove('hidden');
                
                countdownInterval = setInterval(() => {
                  countdownValue--;
                  countdownEl.textContent = countdownValue;
                  if (countdownValue <= 0) {
                    clearInterval(countdownInterval);
                  }
                }, 1000);
              }
              
              function hideWarning() {
                modal.classList.add('hidden');
                if (countdownInterval) {
                  clearInterval(countdownInterval);
                  countdownInterval = null;
                }
              }
              
              function logout() {
                window.location.href = '/logout?reason=timeout';
              }
              
              function resetTimers() {
                hideWarning();
                
                if (warningTimer) clearTimeout(warningTimer);
                if (logoutTimer) clearTimeout(logoutTimer);
                
                warningTimer = setTimeout(showWarning, WARNING_MS);
                logoutTimer = setTimeout(logout, TIMEOUT_MS);
              }
              
              function keepAlive() {
                fetch('/session/keepalive', { method: 'POST', credentials: 'same-origin' })
                  .then(() => resetTimers())
                  .catch(() => resetTimers());
              }
              
              // Eventos de actividad del usuario
              const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
              let lastActivity = Date.now();
              const DEBOUNCE_MS = 1000; // Solo resetear cada segundo máximo
              
              activityEvents.forEach(event => {
                document.addEventListener(event, () => {
                  const now = Date.now();
                  if (now - lastActivity > DEBOUNCE_MS && modal.classList.contains('hidden')) {
                    lastActivity = now;
                    resetTimers();
                  }
                }, { passive: true });
              });
              
              // Botón mantener sesión
              if (keepBtn) {
                keepBtn.addEventListener('click', keepAlive);
              }
              
              // Iniciar timers
              resetTimers();
            })();
          `}} />
        )}
      </body>
    </html>
  );
};

/**
 * Layout mínimo para páginas de autenticación y setup.
 */
export const MinimalLayout: FC<PropsWithChildren<{ title?: string }>> = ({ 
  children, 
  title = 'ActionQ' 
}) => {
  return (
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/htmx.org@2.0.4" integrity="sha384-HGfztofotfshcF7+8n44JQL2oJmowVChPTg48S+jvZoztPfvwD79OC/LTtG6dMp+" crossorigin="anonymous"></script>
      </head>
      <body class="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        {children}
      </body>
    </html>
  );
};
