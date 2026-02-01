/**
 * ActionQ - Servicio de OTP (One-Time Password)
 * 
 * Genera, valida y gestiona OTPs usando Cloudflare KV
 * Soporta flujos de registro y restablecimiento de contraseña
 */

// ================================================
// TIPOS
// ================================================

export interface OTPConfig {
  length?: number;           // Longitud del OTP (default: 6)
  ttlSeconds?: number;       // Tiempo de vida en segundos (default: 900 = 15 min)
  maxAttempts?: number;      // Máximo de intentos fallidos (default: 3)
}

export interface OTPData {
  code: string;              // Código OTP
  email: string;             // Email asociado
  type: 'registration' | 'password_reset'; // Tipo de OTP
  attempts: number;          // Intentos fallidos
  createdAt: number;         // Timestamp de creación
  expiresAt: number;         // Timestamp de expiración
  requestCount?: number;     // Contador de solicitudes (máx 3)
  lastRequestAt?: number;    // Timestamp del último request
}

// ================================================
// SERVICIO OTP
// ================================================

/**
 * Genera un código OTP aleatorio
 */
function generateOTPCode(length: number = 6): string {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return code;
}

/**
 * Crea y almacena un nuevo OTP en Cloudflare KV
 */
export async function createOTP(
  kv: KVNamespace,
  email: string,
  type: 'registration' | 'password_reset',
  config: OTPConfig = {}
): Promise<{ 
  success: boolean
  code?: string
  error?: string
  expiresIn?: number
  nextRequestIn?: number
  requestsRemaining?: number
}> {
  try {
    const length = config.length || 6;
    const ttlSeconds = config.ttlSeconds || 900; // 15 minutos por defecto
    const maxRequests = 3; // Máximo 3 códigos por email
    const requestCooldownSeconds = 60; // 1 minuto entre solicitudes
    
    const existingKey = `otp:${type}:${email}`;
    const existing = await kv.get(existingKey);
    
    let requestCount = 1;
    let lastRequestAt = Date.now();
    
    if (existing) {
      const otpData = JSON.parse(existing) as OTPData;
      const now = Date.now();
      
      // Verificar si ha pasado 1 minuto desde la última solicitud
      const timeSinceLastRequest = Math.floor((now - (otpData.lastRequestAt || otpData.createdAt)) / 1000);
      const nextRequestIn = requestCooldownSeconds - timeSinceLastRequest;
      
      if (nextRequestIn > 0) {
        return {
          success: false,
          error: `Debes esperar ${nextRequestIn} segundo${nextRequestIn !== 1 ? 's' : ''} antes de solicitar un nuevo código.`,
          nextRequestIn
        };
      }
      
      // Contar solicitudes previas
      requestCount = (otpData.requestCount || 1) + 1;
      
      // Verificar límite de 3 solicitudes
      if (requestCount > maxRequests) {
        return {
          success: false,
          error: 'Has alcanzado el límite de solicitudes de OTP. Intenta de nuevo más tarde.',
          requestsRemaining: 0
        };
      }
      
      // Eliminar OTP anterior antes de crear uno nuevo
      await kv.delete(existingKey);
    }
    
    // Generar nuevo OTP
    const code = generateOTPCode(length);
    const now = Date.now();
    const expiresAt = now + (ttlSeconds * 1000);
    
    const otpData: OTPData = {
      code,
      email,
      type,
      attempts: 0,
      createdAt: now,
      expiresAt,
      requestCount,
      lastRequestAt
    };
    
    // Guardar en KV con TTL
    await kv.put(existingKey, JSON.stringify(otpData), {
      expirationTtl: ttlSeconds
    });
    
    console.log(`[OTP] Created ${type} OTP for ${email} (request ${requestCount}/${maxRequests})`);
    
    return {
      success: true,
      code,
      expiresIn: ttlSeconds,
      nextRequestIn: requestCooldownSeconds,
      requestsRemaining: maxRequests - requestCount
    };
    
  } catch (error) {
    console.error('[OTP] Error creating OTP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear OTP'
    };
  }
}

/**
 * Valida un código OTP
 */
export async function validateOTP(
  kv: KVNamespace,
  email: string,
  code: string,
  type: 'registration' | 'password_reset',
  config: OTPConfig = {}
): Promise<{ success: boolean; error?: string; remaining?: number }> {
  try {
    const maxAttempts = config.maxAttempts || 3;
    const key = `otp:${type}:${email}`;
    
    // Obtener OTP del KV
    const otpEntry = await kv.get(key);
    
    if (!otpEntry) {
      return {
        success: false,
        error: 'No hay un OTP activo. Solicita uno nuevo.'
      };
    }
    
    const otpData = JSON.parse(otpEntry) as OTPData;
    
    // Verificar expiración
    if (otpData.expiresAt < Date.now()) {
      await kv.delete(key);
      return {
        success: false,
        error: 'El OTP ha expirado. Solicita uno nuevo.'
      };
    }
    
    // Verificar intentos fallidos
    if (otpData.attempts >= maxAttempts) {
      await kv.delete(key);
      return {
        success: false,
        error: `Máximo de intentos excedido. Solicita un nuevo OTP.`
      };
    }
    
    // Validar código
    if (otpData.code !== code) {
      otpData.attempts++;
      const remaining = maxAttempts - otpData.attempts;
      
      // Actualizar intentos en KV
      await kv.put(key, JSON.stringify(otpData), {
        expirationTtl: config.ttlSeconds || 900
      });
      
      return {
        success: false,
        error: remaining > 0 
          ? `Código incorrecto. Intentos restantes: ${remaining}`
          : `Máximo de intentos excedido. Solicita un nuevo OTP.`,
        remaining
      };
    }
    
    // OTP válido - eliminarlo del KV
    await kv.delete(key);
    
    console.log(`[OTP] Validated ${type} OTP for ${email}`);
    
    return {
      success: true
    };
    
  } catch (error) {
    console.error('[OTP] Error validating OTP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al validar OTP'
    };
  }
}

/**
 * Obtiene información del OTP (sin revelar el código)
 */
export async function getOTPInfo(
  kv: KVNamespace,
  email: string,
  type: 'registration' | 'password_reset'
): Promise<{ 
  exists: boolean
  expiresIn?: number
  attempts?: number
  nextRequestIn?: number
  requestsRemaining?: number
  error?: string 
}> {
  try {
    const key = `otp:${type}:${email}`;
    const otpEntry = await kv.get(key);
    
    if (!otpEntry) {
      return { exists: false };
    }
    
    const otpData = JSON.parse(otpEntry) as OTPData;
    
    // Verificar si está expirado
    if (otpData.expiresAt < Date.now()) {
      await kv.delete(key);
      return { exists: false };
    }
    
    const expiresIn = Math.ceil((otpData.expiresAt - Date.now()) / 1000);
    const maxAttempts = 3;
    const remaining = maxAttempts - otpData.attempts;
    
    // Calcular tiempo restante para nueva solicitud
    const now = Date.now();
    const timeSinceLastRequest = Math.floor((now - (otpData.lastRequestAt || otpData.createdAt)) / 1000);
    const requestCooldownSeconds = 60;
    const nextRequestIn = Math.max(0, requestCooldownSeconds - timeSinceLastRequest);
    
    const maxRequests = 3;
    const requestsRemaining = maxRequests - (otpData.requestCount || 1);
    
    return {
      exists: true,
      expiresIn,
      attempts: remaining,
      nextRequestIn,
      requestsRemaining
    };
    
  } catch (error) {
    console.error('[OTP] Error getting OTP info:', error);
    return {
      exists: false,
      error: error instanceof Error ? error.message : 'Error al obtener información del OTP'
    };
  }
}

/**
 * Elimina un OTP (útil para limpiar después de uso exitoso)
 */
export async function deleteOTP(
  kv: KVNamespace,
  email: string,
  type: 'registration' | 'password_reset'
): Promise<void> {
  const key = `otp:${type}:${email}`;
  await kv.delete(key);
}

/**
 * Template para email de OTP
 */
export function otpEmailTemplate(
  email: string,
  code: string,
  type: 'registration' | 'password_reset',
  expiresInMinutes: number = 15,
  appName: string = 'ActionQ'
): { subject: string; html: string } {
  const titles = {
    registration: 'Verificación de Email - Registro',
    password_reset: 'Verificación de Email - Restablecer Contraseña'
  };
  
  const messages = {
    registration: 'Para completar tu registro en ActionQ, por favor confirma tu email con el siguiente código:',
    password_reset: 'Para restablecer tu contraseña en ActionQ, por favor confirma tu email con el siguiente código:'
  };
  
  const subject = titles[type];
  const message = messages[type];
  
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; background-color: #3b82f6; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">🎫 ${appName}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 20px;">🔐 ${subject}</h2>
              <p style="margin: 0 0 16px 0; color: #374151; line-height: 1.6;">
                ${message}
              </p>
              
              <!-- OTP Code Box -->
              <table style="margin: 30px 0; background-color: #dbeafe; border-radius: 8px; width: 100%; border: 2px solid #3b82f6;">
                <tr>
                  <td style="padding: 30px; text-align: center;">
                    <p style="margin: 0 0 12px 0; color: #1e40af; font-size: 14px; font-weight: 600;">Código de Verificación</p>
                    <p style="margin: 0; color: #1e40af; font-size: 42px; font-weight: 900; font-family: 'Courier New', monospace; letter-spacing: 8px;">
                      ${code.split('').join(' ')}
                    </p>
                    <p style="margin: 12px 0 0 0; color: #1e40af; font-size: 13px;">
                      Este código expira en <strong>${expiresInMinutes} minutos</strong>
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Instructions -->
              <div style="margin: 24px 0; padding: 16px; background-color: #f9fafb; border-radius: 6px; border-left: 4px solid #3b82f6;">
                <p style="margin: 0 0 8px 0; color: #111827; font-size: 14px; font-weight: 600;">📝 Instrucciones:</p>
                <ol style="margin: 8px 0 0 0; padding-left: 20px; color: #374151; font-size: 14px;">
                  <li>Copia el código de verificación de arriba</li>
                  <li>Regresa a ${appName} y pégalo en el campo correspondiente</li>
                  <li>Haz clic en "Verificar" para continuar</li>
                </ol>
              </div>
              
              <!-- Security Warning -->
              <table style="margin: 20px 0; background-color: #fee2e2; border-radius: 8px; width: 100%; border-left: 4px solid #ef4444;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; color: #7f1d1d; font-size: 13px; line-height: 1.6;">
                      <strong>🛡️ Por tu seguridad:</strong> Nunca compartas este código con nadie. ${appName} nunca te pedirá este código por teléfono o chat.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Not You Section -->
              <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                <strong>¿No solicitaste esto?</strong> Si no fuiste tú quien solicitó este código, puedes ignorar este email de forma segura. Tu cuenta está protegida.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                Este es un correo automático de ${appName}. Por favor no responda a este mensaje.
              </p>
              <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 11px; text-align: center;">
                Código de verificación válido por ${expiresInMinutes} minutos
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
