/**
 * ActionQ - Rutas de Autenticación
 * 
 * Maneja setup inicial, login, registro y logout.
 */

import { Hono } from 'hono';
import type { AppEnv, SessionUser, User } from '../types';
import { Layout, MinimalLayout } from '../views/Layout';
import { SetupPage, LoginPage, RegisterPage, ResetPasswordPage, SetupSuccessPage } from '../views/pages';
import { 
  requireAuth,
  setSessionCookie, 
  clearSessionCookie,
  hashPassword,
  verifyPassword,
  generateSalt
} from '../middleware/auth';
import { 
  onlyIfNotInstalledMiddleware,
  markSystemAsInstalled 
} from '../middleware/setup';
import {
  sendEmail,
  sendEmailWithTemplate,
  getEmailConfig,
  welcomeEmailTemplate
} from '../services/email.service';
import {
  getSystemConfig,
  getZeptoMailTemplates
} from '../services/config.service';
import {
  createOTP,
  validateOTP
} from '../services/otp.service';

const authRoutes = new Hono<AppEnv>();

// ================================================
// RUTAS DE SETUP (Primera instalación)
// ================================================

/**
 * GET /setup - Formulario de configuración inicial (interactivo)
 */
authRoutes.get('/setup', async (c) => {
  try {
    const db = c.env.DB;

    // Verificar si el setup fue completado
    const configResult = await db
      .prepare(
        "SELECT value FROM system_config WHERE key = 'setup_completed'"
      )
      .first();

    if (configResult) {
      // Ya existe admin, redirigir al login
      return c.redirect('/login');
    }

    // Mostrar página de setup
    return c.html(
      <MinimalLayout title="Configuración Inicial">
        <SetupPage />
      </MinimalLayout>
    );
  } catch (error) {
    console.error("Error en GET /setup:", error);
    // Si hay error consultando, mostrar la página de setup igual
    // (la tabla podría no existir aún)
    return c.html(
      <MinimalLayout title="Configuración Inicial">
        <SetupPage />
      </MinimalLayout>
    );
  }
});

/**
 * POST /setup - Crea el usuario administrador con los datos del formulario
 */
authRoutes.post('/setup', async (c) => {
  try {
    const db = c.env.DB;
    const formData = await c.req.formData();
    const organization = formData.get('organization') as string;
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirm_password') as string;

    // Validar organización
    if (!organization || organization.trim().length < 2) {
      return c.html(
        <MinimalLayout title="Configuración Inicial">
          <SetupPage error="Por favor proporciona un nombre de organización válido" />
        </MinimalLayout>
      );
    }

    // Validar nombre
    if (!name || name.trim().length < 2) {
      return c.html(
        <MinimalLayout title="Configuración Inicial">
          <SetupPage error="Por favor proporciona un nombre válido" />
        </MinimalLayout>
      );
    }

    // Validar email
    if (!email || !email.includes('@')) {
      return c.html(
        <MinimalLayout title="Configuración Inicial">
          <SetupPage error="Por favor proporciona un correo electrónico válido" />
        </MinimalLayout>
      );
    }

    // Validar que las contraseñas coincidan
    if (password !== confirmPassword) {
      return c.html(
        <MinimalLayout title="Configuración Inicial">
          <SetupPage error="Las contraseñas no coinciden" />
        </MinimalLayout>
      );
    }

    // Validar longitud mínima de contraseña
    if (password.length < 8) {
      return c.html(
        <MinimalLayout title="Configuración Inicial">
          <SetupPage error="La contraseña debe tener al menos 8 caracteres" />
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

    // Hash de la contraseña
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const storedHash = `${salt}:${passwordHash}`;

    console.log("Intentando crear tenant:", organization.trim(), slug);

    // 1. Crear tenant (organización)
    const tenantInsert = await db
      .prepare('INSERT INTO tenants (name, slug) VALUES (?, ?)')
      .bind(organization.trim(), slug)
      .run();

    if (!tenantInsert.success) {
      throw new Error('No se pudo crear la organización');
    }

    // Obtener el ID del tenant recién creado
    const tenantResult = await db
      .prepare('SELECT id FROM tenants WHERE slug = ?')
      .bind(slug)
      .first<{ id: number }>();

    if (!tenantResult) {
      throw new Error('No se pudo obtener el ID de la organización');
    }

    console.log("Tenant creado con ID:", tenantResult.id);

    // 2. Crear usuario admin asociado al tenant
    const result = await db
      .prepare(
        `INSERT INTO users (tenant_id, email, password_hash, name, role, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(tenantResult.id, email, storedHash, name.trim(), "super_admin", 1)
      .run();

    console.log("Usuario creado:", result.success);

    if (!result.success) {
      throw new Error("No se pudo crear el usuario admin");
    }

    // Marcar setup como completado
    await db
      .prepare(
        `INSERT OR REPLACE INTO system_config (key, value) 
         VALUES ('setup_completed', '1')`
      )
      .run();

    // Mostrar página de éxito
    return c.html(
      <MinimalLayout title="Configuración Completada">
        <SetupSuccessPage name={name.trim()} />
      </MinimalLayout>
    );
  } catch (error) {
    console.error("Error en POST /setup:", error instanceof Error ? error.message : error);
    console.error("Stack:", error instanceof Error ? error.stack : "No stack");
    return c.html(
      <MinimalLayout title="Configuración Inicial">
        <SetupPage error="Ocurrió un error creando el administrador. Intenta nuevamente." />
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
authRoutes.get('/login', (c) => {
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
authRoutes.post('/login', async (c) => {
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
    
    // Verificar si el usuario está activo
    if (!user.is_active) {
      return c.html(
        <MinimalLayout title="Error">
          <LoginPage error="Tu cuenta está desactivada. Contacta al administrador." />
        </MinimalLayout>
      );
    }
    
    // Verificar si la organización está activa (excepto super_admin)
    if (user.tenant_id && user.role !== 'super_admin') {
      const tenant = await c.env.DB
        .prepare('SELECT is_active FROM tenants WHERE id = ?')
        .bind(user.tenant_id)
        .first<{ is_active: number }>();
      
      if (!tenant || !tenant.is_active) {
        return c.html(
          <MinimalLayout title="Error">
            <LoginPage error="Tu organización está desactivada. Contacta al administrador." />
          </MinimalLayout>
        );
      }
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
 * GET /reset-password - Formulario para restablecer contraseña
 */
authRoutes.get('/reset-password', (c) => {
  const user = c.get('user');
  if (user) {
    return c.redirect('/dashboard');
  }
  
  return c.html(
    <MinimalLayout title="Restablecer Contraseña">
      <ResetPasswordPage />
    </MinimalLayout>
  );
});

/**
 * POST /reset-password - Procesar restablecimiento de contraseña con OTP
 */
authRoutes.post('/reset-password', async (c) => {
  try {
    const formData = await c.req.formData();
    const email = (formData.get('email') as string || '').toLowerCase().trim();
    const step = (formData.get('step') as string) || 'email';
    const tempToken = (formData.get('temp_token') as string) || '';
    
    // Validar OTP está habilitado
    const config = await getSystemConfig(c.env.DB);
    if (!config.otpEnabled) {
      return c.html(
        <MinimalLayout title="Error">
          <ResetPasswordPage error="OTP no está habilitado en el sistema" />
        </MinimalLayout>
      );
    }
    
    // ===== PASO 1: Solicitar OTP =====
    if (step === 'email' && email) {
      // Verificar que el email existe
      const user = await c.env.DB
        .prepare('SELECT id FROM users WHERE email = ?')
        .bind(email)
        .first<{ id: number }>();
      
      if (!user) {
        // Por seguridad, responder como si existiera
        return c.html(
          <MinimalLayout title="Código Enviado">
            <ResetPasswordPage 
              step="otp"
              email={email}
            />
          </MinimalLayout>
        );
      }
      
      // Crear OTP
      const otpResult = await createOTP(c.env.OTP_STORE, email, 'password_reset', {
        length: 6,
        ttlSeconds: 900
      });
      
      if (!otpResult.success) {
        return c.html(
          <MinimalLayout title="Error">
            <ResetPasswordPage 
              step="otp"
              email={email}
              error={otpResult.error}
              nextRequestIn={otpResult.nextRequestIn || 0}
              requestsRemaining={otpResult.requestsRemaining}
            />
          </MinimalLayout>
        );
      }
      
      // Enviar OTP por correo
      const emailConfig = getEmailConfig(c.env);
      const templates = await getZeptoMailTemplates(c.env.DB);
      
      if (templates.otp) {
        const appName = c.env.APP_NAME || 'ActionQ';
        
        try {
          const emailResult = await sendEmailWithTemplate(emailConfig, {
            to: [{ email, name: email }],
            templateKey: templates.otp,
            mergeInfo: {
              otp_code: otpResult.code,
              otp_expires_minutes: '15',
              app_name: appName,
              otp_title: 'Restablecimiento de Contraseña',
              otp_message: 'Usa este código para restablecer tu contraseña'
            }
          });
          
          console.log('[Email] Password reset OTP sent:', emailResult);
        } catch (err) {
          console.error('[Email] Error sending password reset OTP:', err);
        }
      }
      
      const isResend = formData.get('resend') === 'true';
      
      return c.html(
        <MinimalLayout title="Código Enviado">
          <ResetPasswordPage 
            step="otp"
            email={email}
            otpResent={isResend}
            requestsRemaining={otpResult.requestsRemaining}
            nextRequestIn={otpResult.nextRequestIn}
          />
        </MinimalLayout>
      );
    }
    
    // ===== PASO 2: Verificar OTP =====
    if (step === 'otp' && email) {
      const code = (formData.get('code') as string || '').trim();
      
      if (!code) {
        return c.html(
          <MinimalLayout title="Error">
            <ResetPasswordPage 
              step="otp"
              email={email}
              error="Código requerido"
            />
          </MinimalLayout>
        );
      }
      
      const result = await validateOTP(c.env.OTP_STORE, email, code, 'password_reset', {
        length: 6,
        ttlSeconds: 900,
        maxAttempts: 3
      });
      
      if (!result.success) {
        return c.html(
          <MinimalLayout title="Error">
            <ResetPasswordPage 
              step="otp"
              email={email}
              error={result.error}
            />
          </MinimalLayout>
        );
      }
      
      // Crear token temporal
      const token = crypto.randomUUID();
      await c.env.OTP_STORE.put(
        `reset_token:${token}`,
        JSON.stringify({ email, verifiedAt: new Date().toISOString() }),
        { expirationTtl: 600 }
      );
      
      return c.html(
        <MinimalLayout title="Actualizar Contraseña">
          <ResetPasswordPage 
            step="form"
            email={email}
          />
        </MinimalLayout>
      );
    }
    
    // ===== PASO 3: Actualizar contraseña =====
    if (step === 'complete' && email) {
      const password = formData.get('password') as string;
      const passwordConfirm = formData.get('password_confirm') as string;
      
      // Validar contraseñas
      if (!password || password.length < 8) {
        return c.html(
          <MinimalLayout title="Error">
            <ResetPasswordPage 
              step="form"
              email={email}
              error="La contraseña debe tener al menos 8 caracteres"
            />
          </MinimalLayout>
        );
      }
      
      if (password !== passwordConfirm) {
        return c.html(
          <MinimalLayout title="Error">
            <ResetPasswordPage 
              step="form"
              email={email}
              error="Las contraseñas no coinciden"
            />
          </MinimalLayout>
        );
      }
      
      // Actualizar contraseña
      const salt = generateSalt();
      const hash = await hashPassword(password, salt);
      const storedHash = `${salt}:${hash}`;
      
      try {
        await c.env.DB
          .prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE email = ?')
          .bind(storedHash, email)
          .run();
        
        return c.html(
          <MinimalLayout title="Éxito">
            <ResetPasswordPage success={true} />
          </MinimalLayout>
        );
      } catch (err) {
        return c.html(
          <MinimalLayout title="Error">
            <ResetPasswordPage 
              step="form"
              email={email}
              error="Error al actualizar la contraseña"
            />
          </MinimalLayout>
        );
      }
    }
    
    return c.html(
      <MinimalLayout title="Error">
        <ResetPasswordPage error="Paso inválido" />
      </MinimalLayout>
    );
    
  } catch (error) {
    console.error('Reset password error:', error);
    return c.html(
      <MinimalLayout title="Error">
        <ResetPasswordPage error="Error al procesar solicitud" />
      </MinimalLayout>
    );
  }
});

/**
 * GET /register - Formulario de registro público
 */
authRoutes.get('/register', (c) => {
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
 * POST /register - Procesar registro público con OTP
 * Paso 1: Email -> solicitar OTP
 * Paso 2: OTP -> verificar código
 * Paso 3: Datos -> crear cuenta
 */
authRoutes.post('/register', async (c) => {
  try {
    const formData = await c.req.formData();
    const email = (formData.get('email') as string || '').toLowerCase().trim();
    const step = (formData.get('step') as string) || 'email';
    
    // Validar OTP está habilitado
    const config = await getSystemConfig(c.env.DB);
    if (!config.otpEnabled) {
      return c.html(
        <MinimalLayout title="Error">
          <RegisterPage error="OTP no está habilitado en el sistema" />
        </MinimalLayout>
      );
    }
    
    // ===== PASO 1: Solicitar OTP =====
    if (step === 'email' && email) {
      // Validar email
      if (!email.includes('@')) {
        return c.html(
          <MinimalLayout title="Error">
            <RegisterPage error="Email inválido" />
          </MinimalLayout>
        );
      }
      
      // Verificar que el email no existe
      const existingUser = await c.env.DB
        .prepare('SELECT id FROM users WHERE email = ?')
        .bind(email)
        .first();
      
      if (existingUser) {
        return c.html(
          <MinimalLayout title="Error">
            <RegisterPage error="Este email ya está registrado" />
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
      
      // Verificar que existe una organización para este dominio
      const allTenants = await c.env.DB
        .prepare('SELECT id, name, allowed_domains FROM tenants WHERE is_active = 1')
        .all<{ id: number; name: string; allowed_domains: string }>();
      
      let tenantExists = false;
      for (const t of allTenants.results || []) {
        const domains: string[] = JSON.parse(t.allowed_domains || '[]');
        if (domains.includes(emailDomain)) {
          tenantExists = true;
          break;
        }
      }
      
      if (!tenantExists) {
        return c.html(
          <MinimalLayout title="Error">
            <RegisterPage error={`No existe una organización registrada para el dominio "${emailDomain}".`} />
          </MinimalLayout>
        );
      }
      
      // Crear OTP
      const otpResult = await createOTP(c.env.OTP_STORE, email, 'registration', {
        length: 6,
        ttlSeconds: 900
      });
      
      if (!otpResult.success) {
        console.error('[OTP] Error creating OTP for registration:', otpResult.error);
        return c.html(
          <MinimalLayout title="Error">
            <RegisterPage 
              step="otp"
              email={email}
              error={otpResult.error}
              nextRequestIn={otpResult.nextRequestIn || 0}
              requestsRemaining={otpResult.requestsRemaining}
            />
          </MinimalLayout>
        );
      }
      
      console.log('[OTP] Created OTP for registration:', email, 'Code:', otpResult.code);
      
      // Enviar OTP por correo
      const emailConfig = getEmailConfig(c.env);
      const templates = await getZeptoMailTemplates(c.env.DB);
      
      console.log('[Email] Email config:', {
        hasToken: !!emailConfig.apiToken,
        tokenValid: emailConfig.apiToken !== 'not-configured',
        fromEmail: emailConfig.fromEmail,
        hasTemplate: !!templates.otp
      });
      
      if (templates.otp) {
        const appName = c.env.APP_NAME || 'ActionQ';
        
        try {
          const emailResult = await sendEmailWithTemplate(emailConfig, {
            to: [{ email, name: email }],
            templateKey: templates.otp,
            mergeInfo: {
              otp_code: otpResult.code,
              otp_expires_minutes: '15',
              app_name: appName,
              otp_title: 'Verificación de Registro',
              otp_message: 'Usa este código para completar tu registro en ActionQ'
            }
          });
          
          console.log('[Email] Email send result:', emailResult);
          
          if (!emailResult.success) {
            console.error('[Email] Failed to send OTP email:', emailResult.error);
          }
        } catch (err) {
          console.error('[Email] Error sending OTP:', err);
        }
      } else {
        console.error('[Email] No OTP template configured');
      }
      
      // Detectar si es reenvío
      const isResend = formData.get('resend') === 'true';
      
      return c.html(
        <MinimalLayout title="Código Enviado">
          <RegisterPage 
            step="otp"
            email={email}
            otpResent={isResend}
            requestsRemaining={otpResult.requestsRemaining}
            nextRequestIn={otpResult.nextRequestIn}
          />
        </MinimalLayout>
      );
    }
    
    // ===== PASO 2: Verificar OTP =====
    if (step === 'otp' && email) {
      const code = (formData.get('code') as string || '').trim();
      
      if (!code) {
        return c.html(
          <MinimalLayout title="Error">
            <RegisterPage 
              step="otp"
              email={email}
              error="Código requerido"
            />
          </MinimalLayout>
        );
      }
      
      const result = await validateOTP(c.env.OTP_STORE, email, code, 'registration', {
        length: 6,
        ttlSeconds: 900,
        maxAttempts: 3
      });
      
      if (!result.success) {
        return c.html(
          <MinimalLayout title="Error">
            <RegisterPage 
              step="otp"
              email={email}
              error={result.error}
            />
          </MinimalLayout>
        );
      }
      
      // Crear token temporal
      const token = crypto.randomUUID();
      await c.env.OTP_STORE.put(
        `register_token:${token}`,
        JSON.stringify({ email, verifiedAt: new Date().toISOString() }),
        { expirationTtl: 600 }
      );
      
      return c.html(
        <MinimalLayout title="Crear Cuenta">
          <RegisterPage 
            step="form"
            email={email}
          />
        </MinimalLayout>
      );
    }
    
    // ===== PASO 3: Crear cuenta =====
    if (step === 'complete' && email) {
      const name = (formData.get('name') as string || '').trim();
      const password = formData.get('password') as string;
      const passwordConfirm = formData.get('password_confirm') as string;
      
      // Validar todos los campos
      if (!name || !password || !passwordConfirm) {
        return c.html(
          <MinimalLayout title="Error">
            <RegisterPage 
              step="form"
              email={email}
              error="Todos los campos son requeridos"
            />
          </MinimalLayout>
        );
      }
      
      if (password !== passwordConfirm) {
        return c.html(
          <MinimalLayout title="Error">
            <RegisterPage 
              step="form"
              email={email}
              error="Las contraseñas no coinciden"
            />
          </MinimalLayout>
        );
      }
      
      if (password.length < 8) {
        return c.html(
          <MinimalLayout title="Error">
            <RegisterPage 
              step="form"
              email={email}
              error="La contraseña debe tener al menos 8 caracteres"
            />
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
      
      // Buscar la organización
      const allTenants = await c.env.DB
        .prepare('SELECT id, name, allowed_domains FROM tenants WHERE is_active = 1')
        .all<{ id: number; name: string; allowed_domains: string }>();
      
      let tenant: { id: number; name: string } | null = null;
      for (const t of allTenants.results || []) {
        const domains: string[] = JSON.parse(t.allowed_domains || '[]');
        if (domains.includes(emailDomain)) {
          tenant = { id: t.id, name: t.name };
          break;
        }
      }
      
      if (!tenant) {
        return c.html(
          <MinimalLayout title="Error">
            <RegisterPage error={`No existe una organización registrada para el dominio "${emailDomain}".`} />
          </MinimalLayout>
        );
      }
      
      // Hashear contraseña
      const salt = generateSalt();
      const hash = await hashPassword(password, salt);
      const storedHash = `${salt}:${hash}`;
      
      // Crear usuario con rol "user"
      try {
        const result = await c.env.DB
          .prepare(`
            INSERT INTO users (
              tenant_id, email, name, password_hash, 
              role, is_active, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, 'user', 1, datetime('now'), datetime('now'))
          `)
          .bind(tenant.id, email, name, storedHash)
          .run();
        
        // Enviar email de bienvenida
        const appName = c.env.APP_NAME || 'ActionQ';
        const appUrl = c.env.APP_URL || `https://${c.req.header('host')}`;
        const emailConfig = getEmailConfig(c.env);
        const welcomeEmail = welcomeEmailTemplate(
          name,
          email,
          tenant.name,
          `${appUrl}/login`,
          appName
        );
        
        sendEmail(emailConfig, {
          to: [{ email, name }],
          subject: welcomeEmail.subject,
          htmlBody: welcomeEmail.html
        }).catch(err => console.error('Error enviando email de bienvenida:', err));
        
        return c.html(
          <MinimalLayout title="Registro Exitoso">
            <RegisterPage success={true} />
          </MinimalLayout>
        );
      } catch (err) {
        console.error('Registration error:', err);
        return c.html(
          <MinimalLayout title="Error">
            <RegisterPage 
              step="form"
              email={email}
              error="No se pudo crear la cuenta. Intenta de nuevo."
            />
          </MinimalLayout>
        );
      }
    }
    
    return c.html(
      <MinimalLayout title="Error">
        <RegisterPage error="Paso inválido" />
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
 * GET /register - Formulario de registro público
 */
authRoutes.get('/register', (c) => {
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
 * GET/POST /logout - Cerrar sesión
 */
authRoutes.all('/logout', (c) => {
  clearSessionCookie(c);
  return c.redirect('/login');
});

/**
 * POST /session/keepalive - Mantener sesión activa
 * Simplemente responde OK si el usuario está autenticado
 */
authRoutes.post('/session/keepalive', requireAuth, (c) => {
  return c.json({ status: 'ok' });
});

export { authRoutes };
