# 🔐 Sistema OTP (One-Time Password) en ActionQ

Este documento explica cómo configurar y usar el sistema OTP para:
- Verificación de email en registro de nuevos usuarios
- Restablecimiento seguro de contraseñas

## 📋 Índice

- [Configuración](#configuración)
- [API del Servicio OTP](#api-del-servicio-otp)
- [Flujos de Implementación](#flujos-de-implementación)
- [Variables de Email](#variables-de-email)
- [Seguridad](#seguridad)

---

## ⚙️ Configuración

### 1. Crear KV Namespace en Cloudflare

Primero, crea un nuevo namespace de KV:

```bash
# Crear namespace para producción
npx wrangler kv:namespace create "OTP_STORE"

# Crear namespace para preview (desarrollo)
npx wrangler kv:namespace create "OTP_STORE" --preview
```

El comando te dará un output como:

```
✓ Created namespace with id: abc123def456
✓ Created preview namespace with id: xyz789uvw012
```

### 2. Actualizar `wrangler.toml`

Copia los IDs y actualiza la sección de KV en `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "OTP_STORE"
id = "abc123def456"
preview_id = "xyz789uvw012"
```

### 3. Verificar la Configuración

```bash
# En desarrollo
npm run dev

# Ver que OTP_STORE está disponible en los bindings
```

---

## 🔌 API del Servicio OTP

### `createOTP(kv, email, type, config?)`

Crea y almacena un nuevo código OTP.

**Parámetros:**
- `kv: KVNamespace` - El binding de Cloudflare KV
- `email: string` - Email del usuario
- `type: 'registration' | 'password_reset'` - Tipo de OTP
- `config?: OTPConfig` - Configuración opcional
  - `length?: number` - Longitud del código (default: 6)
  - `ttlSeconds?: number` - Tiempo de vida en segundos (default: 900 = 15 min)
  - `maxAttempts?: number` - Máximo de intentos fallidos (default: 3)

**Retorna:**
```typescript
{
  success: boolean;
  code?: string;           // Solo para desarrollo/admin
  error?: string;
  expiresIn?: number;      // Segundos hasta expiración
}
```

**Ejemplo:**

```typescript
import { createOTP, otpEmailTemplate } from '../services/otp.service';
import { sendEmail } from '../services/email.service';

// Crear OTP
const result = await createOTP(c.env.OTP_STORE, 'user@example.com', 'registration');

if (result.success) {
  // Enviar email con OTP
  const template = otpEmailTemplate(
    'user@example.com',
    result.code!,
    'registration',
    15, // minutos
    'ActionQ'
  );
  
  await sendEmail(emailConfig, {
    to: [{ email: 'user@example.com' }],
    subject: template.subject,
    htmlBody: template.html
  });
} else {
  return c.text(result.error, 400);
}
```

---

### `validateOTP(kv, email, code, type, config?)`

Valida un código OTP.

**Parámetros:**
- `kv: KVNamespace` - El binding de Cloudflare KV
- `email: string` - Email del usuario
- `code: string` - Código OTP a validar
- `type: 'registration' | 'password_reset'` - Tipo de OTP
- `config?: OTPConfig` - Configuración opcional

**Retorna:**
```typescript
{
  success: boolean;
  error?: string;
  remaining?: number;    // Intentos restantes si falló
}
```

**Ejemplo:**

```typescript
import { validateOTP } from '../services/otp.service';

const result = await validateOTP(
  c.env.OTP_STORE,
  'user@example.com',
  '123456',
  'registration'
);

if (result.success) {
  // Crear usuario
  console.log('Email verificado, crear usuario...');
} else {
  return c.text(result.error, 400);
}
```

---

### `getOTPInfo(kv, email, type)`

Obtiene información de un OTP sin revelar el código.

**Parámetros:**
- `kv: KVNamespace` - El binding de Cloudflare KV
- `email: string` - Email del usuario
- `type: 'registration' | 'password_reset'` - Tipo de OTP

**Retorna:**
```typescript
{
  exists: boolean;
  expiresIn?: number;    // Segundos hasta expiración
  attempts?: number;     // Intentos restantes
  error?: string;
}
```

**Ejemplo:**

```typescript
const info = await getOTPInfo(c.env.OTP_STORE, 'user@example.com', 'registration');

if (info.exists) {
  return c.json({
    message: 'OTP enviado',
    expiresIn: info.expiresIn,
    attempts: info.attempts
  });
}
```

---

### `deleteOTP(kv, email, type)`

Elimina un OTP del almacenamiento (se usa automáticamente después de validación exitosa).

**Parámetros:**
- `kv: KVNamespace` - El binding de Cloudflare KV
- `email: string` - Email del usuario
- `type: 'registration' | 'password_reset'` - Tipo de OTP

**Ejemplo:**

```typescript
await deleteOTP(c.env.OTP_STORE, 'user@example.com', 'registration');
```

---

### `otpEmailTemplate(email, code, type, expiresInMinutes?, appName?)`

Genera el template HTML para email con OTP.

**Parámetros:**
- `email: string` - Email del usuario
- `code: string` - Código OTP (ej: "123456")
- `type: 'registration' | 'password_reset'` - Tipo de OTP
- `expiresInMinutes?: number` - Minutos hasta expiración (default: 15)
- `appName?: string` - Nombre de la app (default: "ActionQ")

**Retorna:**
```typescript
{
  subject: string;    // Título del email
  html: string;       // HTML completo del email
}
```

---

## 🔄 Flujos de Implementación

### Flujo 1: Registro de Nuevo Usuario con OTP

```
1. Usuario ingresa email en formulario de registro
   ↓
2. GET /auth/request-otp?email=user@example.com&type=registration
   - Generar OTP
   - Guardar en KV con TTL 15 min
   - Enviar email con OTP
   - Mostrar página con formulario de verificación
   ↓
3. Usuario ingresa código OTP
   ↓
4. POST /auth/verify-otp
   - Validar código
   - Si válido: mostrar formulario de registro
   - Si inválido: mostrar error con intentos restantes
   ↓
5. POST /auth/register
   - Crear usuario
   - Crear sesión
   - Redirigir a dashboard
```

### Flujo 2: Restablecimiento de Contraseña con OTP

```
1. Usuario hace clic en "¿Olvidaste tu contraseña?"
   ↓
2. Ingresa su email
   ↓
3. GET /auth/request-otp?email=user@example.com&type=password_reset
   - Generar OTP
   - Guardar en KV con TTL 15 min
   - Enviar email con OTP
   - Mostrar página con formulario de verificación
   ↓
4. Usuario ingresa código OTP
   ↓
5. POST /auth/verify-otp
   - Validar código
   - Si válido: mostrar formulario de nueva contraseña
   - Si inválido: mostrar error con intentos restantes
   ↓
6. POST /auth/reset-password
   - Validar nueva contraseña
   - Actualizar contraseña en base de datos
   - Redirigir a login
```

---

## 📧 Variables de Email

El template `otp-verification.html` usa las siguientes variables ZeptoMail:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `{{app_name}}` | Nombre de la aplicación | ActionQ |
| `{{otp_title}}` | Título según tipo de OTP | "Verificación de Email - Registro" |
| `{{otp_message}}` | Mensaje descriptivo | "Para completar tu registro..." |
| `{{otp_code}}` | Código OTP (6 dígitos con espacios) | "1 2 3 4 5 6" |
| `{{otp_expires_minutes}}` | Minutos de expiración | 15 |
| `{{app_url}}` | URL de la aplicación | https://actionq.example.com |

**Ejemplo de envío con ZeptoMail template:**

```typescript
// Primero crear y subir el template a ZeptoMail

await sendEmailWithTemplate(emailConfig, {
  to: [{ email: 'user@example.com' }],
  templateKey: 'tu-template-key-aqui',
  mergeInfo: {
    app_name: 'ActionQ',
    otp_title: 'Verificación de Email - Registro',
    otp_message: 'Para completar tu registro en ActionQ, por favor confirma tu email con el siguiente código:',
    otp_code: result.code!.split('').join(' '),
    otp_expires_minutes: 15,
    app_url: 'https://actionq.example.com'
  }
});
```

---

## 🛡️ Seguridad

### Características de Seguridad Implementadas:

1. **TTL Automático**
   - OTPs se eliminan automáticamente después de 15 minutos
   - Imposible usar OTPs expirados

2. **Rate Limiting de Intentos**
   - Máximo 3 intentos fallidos
   - Después se elimina el OTP
   - Usuario debe solicitar uno nuevo

3. **No Reutilizable**
   - OTP se elimina después de validación exitosa
   - No puede usarse de nuevo

4. **Diferentes Tipos**
   - OTPs de registro no funcionan para reset de contraseña
   - OTPs de reset no funcionan para registro

5. **Prevención de Duplicados**
   - Si hay un OTP activo para un email, no permite crear otro
   - Usuario debe esperar que expire o intentar de nuevo

### Mejores Prácticas:

1. **Nunca mostres el código OTP en el navegador**
   - Solo envía por email
   - El hash/código nunca debe estar en localStorage

2. **Valida en el servidor siempre**
   - No confíes en validaciones del cliente
   - Siempre llama a `validateOTP()` en el servidor

3. **Usa HTTPS en producción**
   - Los OTPs viajan en emails
   - Usa HTTPS para el formulario de validación

4. **Monitora intentos fallidos**
   - Log de intentos de validación
   - Detecta intentos de fuerza bruta

5. **Combina con CSRF protection**
   - Usa tokens CSRF en formularios de verificación
   - Previene ataques CSRF

---

## 🧪 Testing

### Testing Local

```typescript
// En tus rutas de test

const result = await createOTP(c.env.OTP_STORE, 'test@example.com', 'registration');
console.log('OTP Code:', result.code); // Solo en desarrollo

// Simular validación inmediata
const validation = await validateOTP(
  c.env.OTP_STORE,
  'test@example.com',
  result.code!,
  'registration'
);

console.log('Validation success:', validation.success);
```

### Testing en Producción

1. Usa una cuenta de prueba real
2. Verifica que el email llega correctamente
3. Prueba expiración esperando o manipulando tiempos
4. Prueba límite de intentos

---

## 📚 Referencias

- [Cloudflare KV Documentation](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [OTP Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Email Security](https://en.wikipedia.org/wiki/One-time_password)

---

**Versión:** 1.0.0  
**Última actualización:** 1 de febrero de 2026
