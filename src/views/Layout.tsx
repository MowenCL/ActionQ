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
}

/**
 * Layout principal de la aplicación.
 * Incluye cabecera, navegación y footer.
 */
export const Layout: FC<PropsWithChildren<LayoutProps>> = ({ 
  children, 
  title = 'ActionQ',
  user = null,
  showNav = true
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
                    {(user.role === 'super_admin' || user.role === 'admin') && (
                      <a href="/admin" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                        Administración
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
