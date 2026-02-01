/**
 * Genera una contraseña segura aleatoria
 * - Mínimo 16 caracteres
 * - Incluye mayúsculas, minúsculas, números y símbolos
 */
export function generateSecurePassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const all = uppercase + lowercase + numbers + symbols;
  let password = '';
  
  // Asegurar al menos 1 de cada tipo (requerido)
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Llenar con caracteres aleatorios
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  
  // Mezclar la contraseña
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

/**
 * Valida si una contraseña cumple requisitos de seguridad
 */
export function isSecurePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Mínimo 8 caracteres');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Al menos 1 mayúscula');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Al menos 1 minúscula');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Al menos 1 número');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
