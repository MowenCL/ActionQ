/**
 * ActionQ - Componentes de Páginas
 * 
 * Páginas principales de la aplicación.
 */

import type { FC } from 'hono/jsx';
import type { SessionUser, Ticket } from '../types';

// ================================================
// PÁGINA DE SETUP (Primera instalación - Interactiva)
// ================================================

interface SetupPageProps {
  error?: string;
}

export const SetupPage: FC<SetupPageProps> = ({ error }) => {
  return (
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-12">
      <div class="w-full max-w-md">
        <div class="bg-white rounded-lg shadow-lg p-8">
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-gray-900">ActionQ</h1>
            <p class="mt-2 text-gray-600">Instalación Inicial</p>
          </div>
          
          <p class="text-center text-gray-600 mb-8">
            Configura tu administrador para comenzar
          </p>
          
          {error && (
            <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p class="text-sm text-red-800 font-medium">⚠️ {error}</p>
            </div>
          )}
          
          <form method="post" action="/setup" class="space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Email del Administrador
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="admin@ejemplo.com"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p class="mt-1 text-xs text-gray-500">
                Este será tu usuario para acceder al sistema
              </p>
            </div>
            
            <button
              type="submit"
              class="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Crear Administrador
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ================================================
// PÁGINA DE SETUP EXITOSO (Mostrar credenciales)
// ================================================

interface SetupSuccessPageProps {
  email: string;
  tempPassword: string;
}

export const SetupSuccessPage: FC<SetupSuccessPageProps> = ({ email, tempPassword }) => {
  return (
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 px-4 py-12">
      <div class="w-full max-w-md">
        <div class="bg-white rounded-lg shadow-lg p-8">
          <div class="text-center mb-8">
            <div class="text-5xl mb-4">✅</div>
            <h1 class="text-3xl font-bold text-gray-900">¡Listo!</h1>
            <p class="mt-2 text-gray-600">Tu administrador fue creado exitosamente</p>
          </div>
          
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <p class="text-sm text-gray-700 mb-4">
              <span class="font-medium">Email:</span>
            </p>
            <p class="text-sm font-mono bg-white border border-blue-200 rounded p-3 mb-4 text-center">
              {email}
            </p>
            
            <p class="text-sm text-gray-700 mb-4">
              <span class="font-medium">Contraseña temporal:</span>
            </p>
            <p class="text-sm font-mono bg-white border border-blue-200 rounded p-3 text-center break-all">
              {tempPassword}
            </p>
          </div>
          
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
            <p class="text-sm text-amber-900">
              <span class="font-bold">⚠️ IMPORTANTE:</span> Esta contraseña es temporal. 
              Deberás cambiarla en tu primer acceso.
            </p>
          </div>
          
          <a
            href="/login"
            class="block w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Ir a Login
          </a>
        </div>
      </div>
    </div>
  );
};

// ================================================
// PÁGINA DE CAMBIO FORZADO DE CONTRASEÑA
// ================================================

interface ForceChangePasswordPageProps {
  error?: string;
}

export const ForceChangePasswordPage: FC<ForceChangePasswordPageProps> = ({ error }) => {
  return (
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-12">
      <div class="w-full max-w-md">
        <div class="bg-white rounded-lg shadow-lg p-8">
          <div class="text-center mb-8">
            <h1 class="text-2xl font-bold text-gray-900">Cambiar Contraseña</h1>
            <p class="mt-2 text-sm text-gray-600">Primer acceso</p>
          </div>
          
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p class="text-sm text-blue-900">
              Por seguridad, debes cambiar tu contraseña temporal en tu primer acceso.
            </p>
          </div>
          
          {error && (
            <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p class="text-sm text-red-800 font-medium">⚠️ {error}</p>
            </div>
          )}
          
          <form method="post" action="/force-change-password" class="space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Nueva Contraseña
              </label>
              <input
                type="password"
                name="new_password"
                required
                minLength={8}
                placeholder="Mín. 8 caracteres"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p class="mt-1 text-xs text-gray-500">
                Debe incluir mayúscula, minúscula y número
              </p>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Confirmar Contraseña
              </label>
              <input
                type="password"
                name="confirm_password"
                required
                minLength={8}
                placeholder="Repite la contraseña"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <button
              type="submit"
              class="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Cambiar Contraseña
            </button>
          </form>
        </div>
      </div>
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
      
      <div class="mt-6 text-center space-y-3">
        <div>
          <p class="text-sm text-gray-600">
            ¿No tienes cuenta?{' '}
            <a href="/register" class="text-blue-600 hover:text-blue-700 font-medium">
              Regístrate
            </a>
          </p>
        </div>
        <div class="border-t border-gray-200 pt-3">
          <p class="text-sm text-gray-600">
            ¿Olvidaste tu contraseña?{' '}
            <a href="/reset-password" class="text-blue-600 hover:text-blue-700 font-medium">
              Restablece aquí
            </a>
          </p>
        </div>
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
  step?: 'email' | 'otp' | 'form';
  email?: string;
  otpRequired?: boolean;
  otpResent?: boolean;
  requestsRemaining?: number;
  nextRequestIn?: number;
}

export const RegisterPage: FC<RegisterPageProps> = ({ 
  error, 
  success, 
  step = 'email',
  email = '',
  otpRequired = true,
  otpResent = false,
  requestsRemaining = 3,
  nextRequestIn = 60
}) => {
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
      
      {otpResent && !error && (
        <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p class="text-sm text-green-600">
            ✅ Nuevo código enviado. Revisa tu correo.
          </p>
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
      
      {!success && step === 'email' && (
        /* Paso 1: Solicitar email */
        <form method="post" action="/register" class="space-y-6">
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
          
          <button 
            type="submit"
            class="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Continuar
          </button>
        </form>
      )}
      
      {!success && step === 'otp' && (
        <>
        <form 
          method="post" 
          action="/register"
          class="space-y-6"
        >
          <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p class="text-sm text-blue-900">
              Se ha enviado un código de 6 dígitos a <strong>{email}</strong>
            </p>
          </div>
          
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="step" value="otp" />
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Código OTP
            </label>
            <input 
              type="text" 
              name="code"
              required
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="000000"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-2xl tracking-widest font-mono"
            />
            <p class="mt-1 text-xs text-gray-500">
              El código expirará en 15 minutos
            </p>
          </div>
          
          <button 
            type="submit"
            class="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Verificar Código
          </button>
          
          {requestsRemaining && requestsRemaining < 3 && (
            <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p class="text-xs text-amber-800">
                ℹ️ Solicitudes de código restantes: <strong>{requestsRemaining}/{3}</strong>
              </p>
            </div>
          )}
          
          {requestsRemaining === 0 && (
            <div class="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p class="text-xs text-red-800">
                🚫 Has alcanzado el límite de solicitudes de OTP. Por favor, intenta de nuevo más tarde.
              </p>
            </div>
          )}
        </form>
          
        <form method="post" action="/register" class="mt-4">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="step" value="email" />
          <input type="hidden" name="resend" value="true" />
          <button 
            type="submit"
            id="resend-btn"
            disabled={nextRequestIn > 0}
            class="w-full py-2 px-4 text-blue-600 font-medium hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:text-gray-400 disabled:cursor-not-allowed disabled:bg-gray-50"
          >
            <span id="resend-text">🔄 Solicitar nuevo código</span>
            <span id="countdown" style={nextRequestIn > 0 ? '' : 'display:none'}>
              ({nextRequestIn}s)
            </span>
          </button>
        </form>
        
        <script dangerouslySetInnerHTML={{__html: `
          (function() {
            let timeLeft = ${nextRequestIn};
            const btn = document.getElementById('resend-btn');
            const countdown = document.getElementById('countdown');
            
            if (!btn || !countdown) {
              console.error('Countdown elements not found');
              return;
            }
            
            function updateCountdown() {
              if (timeLeft > 0) {
                countdown.textContent = '(' + timeLeft + 's)';
                countdown.style.display = 'inline';
                timeLeft--;
                setTimeout(updateCountdown, 1000);
              } else {
                countdown.style.display = 'none';
                btn.removeAttribute('disabled');
              }
            }
            
            if (timeLeft > 0) {
              updateCountdown();
            }
          })();
        `}} />
        </>
      )}
      
      {!success && step === 'form' && (
        /* Paso 3: Datos de registro */
        <form method="post" action="/register" class="space-y-6">
          <input type="hidden" name="step" value="complete" />
          <input type="hidden" name="email" value={email} />
          
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
// PÁGINA DE RESTABLECIMIENTO DE CONTRASEÑA
// ================================================

interface ResetPasswordPageProps {
  error?: string;
  success?: boolean;
  step?: 'email' | 'otp' | 'form';
  email?: string;
  otpResent?: boolean;
  requestsRemaining?: number;
  nextRequestIn?: number;
}

export const ResetPasswordPage: FC<ResetPasswordPageProps> = ({ 
  error, 
  success, 
  step = 'email',
  email = '',
  otpResent = false,
  requestsRemaining = 3,
  nextRequestIn = 60
}) => {
  return (
    <div class="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
      <div class="text-center mb-8">
        <span class="text-5xl">🔑</span>
        <h1 class="mt-4 text-2xl font-bold text-gray-900">Restablecer Contraseña</h1>
        <p class="mt-2 text-sm text-gray-600">
          Recupera acceso a tu cuenta
        </p>
      </div>
      
      {error && (
        <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-600">{error}</p>
        </div>
      )}
      
      {otpResent && !error && (
        <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p class="text-sm text-green-600">
            ✅ Nuevo código enviado. Revisa tu correo.
          </p>
        </div>
      )}
      
      {success && (
        <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p class="text-sm text-green-600">
            ✅ Contraseña actualizada exitosamente.{' '}
            <a href="/login" class="font-medium underline">Inicia sesión</a>
          </p>
        </div>
      )}
      
      {!success && step === 'email' && (
        /* Paso 1: Solicitar email */
        <form method="post" action="/reset-password" class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Email de la cuenta
            </label>
            <input 
              type="email" 
              name="email"
              required
              placeholder="tu@empresa.com"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p class="mt-1 text-xs text-gray-500">
              Recibirás un código en este email
            </p>
          </div>
          
          <button 
            type="submit"
            class="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Continuar
          </button>
        </form>
      )}
      
      {!success && step === 'otp' && (
        <>
        <form 
          method="post" 
          action="/reset-password" 
          class="space-y-6"
        >
          <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p class="text-sm text-blue-900">
              Se ha enviado un código de 6 dígitos a <strong>{email}</strong>
            </p>
          </div>
          
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="type" value="password_reset" />
          <input type="hidden" name="step" value="otp" />
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Código OTP
            </label>
            <input 
              type="text" 
              name="code"
              required
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="000000"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-2xl tracking-widest font-mono"
            />
            <p class="mt-1 text-xs text-gray-500">
              El código expirará en 15 minutos
            </p>
          </div>
          
          <button 
            type="submit"
            class="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Verificar Código
          </button>
          
          {requestsRemaining < 3 && requestsRemaining > 0 && (
            <div class="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p class="text-sm text-amber-800">
                ℹ️ Solicitudes restantes: {requestsRemaining}/3
              </p>
            </div>
          )}
          
          {requestsRemaining === 0 && (
            <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p class="text-sm text-red-800">
                ❌ Límite de solicitudes alcanzado. Intenta más tarde.
              </p>
            </div>
          )}
        </form>
          
        <form method="post" action="/reset-password" class="mt-4">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="step" value="email" />
          <input type="hidden" name="resend" value="true" />
          <button 
            type="submit"
            id="resend-btn"
            disabled={nextRequestIn > 0}
            class="w-full py-2 px-4 text-blue-600 font-medium hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:text-gray-400 disabled:cursor-not-allowed disabled:bg-gray-50"
          >
            <span id="resend-text">🔄 Solicitar nuevo código</span>
            <span id="countdown" style={nextRequestIn > 0 ? '' : 'display:none'}>
              ({nextRequestIn}s)
            </span>
          </button>
        </form>

        <script dangerouslySetInnerHTML={{__html: `
          (function() {
            let timeLeft = ${nextRequestIn};
            const btn = document.getElementById('resend-btn');
            const countdown = document.getElementById('countdown');
            
            if (!btn || !countdown) {
              console.error('Countdown elements not found');
              return;
            }
            
            function updateCountdown() {
              if (timeLeft > 0) {
                countdown.textContent = '(' + timeLeft + 's)';
                countdown.style.display = 'inline';
                timeLeft--;
                setTimeout(updateCountdown, 1000);
              } else {
                countdown.style.display = 'none';
                btn.removeAttribute('disabled');
              }
            }
            
            if (timeLeft > 0) {
              updateCountdown();
            }
          })();
        `}} />
        </>
      )}
      
      {!success && step === 'form' && (
        /* Paso 3: Nueva contraseña */
        <form method="post" action="/reset-password" class="space-y-6">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="step" value="complete" />
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Nueva contraseña
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
            Actualizar Contraseña
          </button>
        </form>
      )}
      
      <div class="mt-6 text-center">
        <p class="text-sm text-gray-600">
          ¿Recuerdas tu contraseña?{' '}
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

// Tipo extendido para tickets con info de actividad
interface RecentTicket extends Ticket {
  assigned_to_name?: string | null;
  last_message?: string | null;
  last_message_by?: string | null;
}

interface DashboardPageProps {
  user: SessionUser;
  stats: {
    totalTickets: number;
    openTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
  };
  recentTickets: RecentTicket[];
}

// Helper para generar descripción de actividad
const getActivityDescription = (ticket: RecentTicket): string => {
  if (ticket.last_message_by) {
    return `Nuevo mensaje de ${ticket.last_message_by}`;
  }
  if (ticket.assigned_to_name) {
    return `Asignado a ${ticket.assigned_to_name}`;
  }
  if (ticket.status === 'open') {
    return 'Ticket abierto';
  }
  if (ticket.status === 'in_progress') {
    return 'En progreso';
  }
  if (ticket.status === 'pending') {
    return 'Esperando respuesta';
  }
  if (ticket.status === 'closed') {
    return 'Cerrado';
  }
  return 'Sin asignar';
};

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
          title="Cerrados" 
          value={stats.resolvedTickets} 
          icon="✅" 
          color="green"
        />
      </div>
      
      {/* Tickets actualizados recientemente */}
      <div class="bg-white rounded-lg shadow">
        <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-900">Actualizados Recientemente</h2>
          <a href="/tickets/new" class="text-sm text-blue-600 hover:text-blue-700 font-medium">
            + Nuevo Ticket
          </a>
        </div>
        
        {recentTickets.length > 0 ? (
          <ul class="divide-y divide-gray-200">
            {recentTickets.map((ticket) => (
              <li key={ticket.id} class="px-6 py-4 hover:bg-gray-50">
                <a href={`/tickets/${ticket.id}`} class="flex items-center justify-between">
                  <div class="min-w-0 flex-1">
                    <p class="font-medium text-gray-900 truncate">{ticket.title}</p>
                    <p class="text-sm text-gray-500">
                      <span class="text-gray-400">#{ticket.id}</span>
                      <span class="mx-2">•</span>
                      <span class="text-blue-600">{getActivityDescription(ticket)}</span>
                    </p>
                  </div>
                  <div class="flex items-center space-x-2 ml-4 flex-shrink-0">
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
    pending: { label: 'Esperando', class: 'bg-purple-100 text-purple-800' },
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
