import { Context, Next } from 'hono';

/**
 * Middleware que verifica si el usuario debe cambiar su contraseña
 * Si debe cambiar, redirige a /force-change-password
 * Excepto en ciertas rutas permitidas
 */
export function forcePasswordChangeMiddleware() {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    
    // Si no hay usuario, continuar sin hacer nada
    if (!user) {
      return next();
    }
    
    // Rutas permitidas sin cambiar contraseña
    const allowedPaths = [
      '/force-change-password',
      '/logout',
      '/api/force-change-password'
    ];
    
    const currentPath = c.req.path;
    const isAllowedPath = allowedPaths.some(path => currentPath.startsWith(path));
    
    // Si está en una ruta permitida, continuar
    if (isAllowedPath) {
      return next();
    }
    
    // Si el usuario debe cambiar contraseña, redirigir
    if (user.must_change_password) {
      return c.redirect('/force-change-password');
    }
    
    return next();
  };
}
