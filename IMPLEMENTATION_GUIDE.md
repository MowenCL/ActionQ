# 🤖 INSTRUCCIONES PARA LA PRÓXIMA IA

## CONTEXTO ACTUAL

La aplicación ActionQ necesita un **Setup Interactivo** para que el usuario pueda:
1. Acceder a `/setup` en primer arranque
2. Ingresar su email
3. Recibir una contraseña temporal aleatoria
4. Cambiar la contraseña en el primer login

## IMPLEMENTACIÓN PASO A PASO

### PASO 1: Preparar Infraestructura

El usuario ya limpió todo. Necesitas:

```bash
# 1. Crear D1 Database
npx wrangler d1 create actionq-db

# 2. Crear KV Namespace
npx wrangler kv:namespace create "OTP_STORE"

# 3. Actualizar wrangler.toml con los IDs nuevos
# (Copiar los IDs del output anterior y pegarlos en el archivo)

# 4. Deploy
npm run deploy

# 5. Ejecutar migrations (si existen)
npx wrangler d1 execute actionq-db --file=src/db/schema.sql
```

### PASO 2: Agregar Columna a Tabla Users

Antes de implementar, verifica que la tabla `users` tenga la columna `must_change_password`:

```sql
-- En src/db/schema.sql, agregar a la tabla users:
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 1;
```

O en la creación inicial:

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  tenant_id INTEGER NOT NULL,
  is_admin BOOLEAN DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  must_change_password BOOLEAN DEFAULT 1,  -- ← AGREGAR ESTA LÍNEA
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

### PASO 3: Crear Utilidad de Generador de Contraseña

**Archivo**: `src/utils/password-generator.ts`

```typescript
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
```

### PASO 4: Modificar Setup Route

**Archivo**: `src/routes/setup.routes.tsx`

**GET /setup** - Mostrar formulario o redirigir:

```typescript
authRoutes.get('/setup', async (c) => {
  // Verificar si ya está configurado
  const result = await c.env.DB
    .prepare('SELECT value FROM system_config WHERE key = "setup_completed"')
    .first();
  
  if (result?.value === 'true') {
    // Ya está configurado, redirigir a login
    return c.redirect('/login');
  }
  
  // Mostrar formulario de setup
  return c.html(
    <MinimalLayout title="Instalación Inicial">
      <SetupPage />
    </MinimalLayout>
  );
});

// POST /setup - Procesar formulario
authRoutes.post('/setup', async (c) => {
  const formData = await c.req.formData();
  const email = (formData.get('email') as string || '').toLowerCase().trim();
  
  // Validar email
  if (!email.includes('@')) {
    return c.html(
      <MinimalLayout title="Error">
        <SetupPage error="Email inválido" />
      </MinimalLayout>
    );
  }
  
  // Verificar que no exista usuario con este email
  const existingUser = await c.env.DB
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();
  
  if (existingUser) {
    return c.html(
      <MinimalLayout title="Error">
        <SetupPage error="Este email ya está registrado" />
      </MinimalLayout>
    );
  }
  
  // Generar contraseña temporal
  const tempPassword = generateSecurePassword(16);
  
  // Hash de la contraseña
  const salt = generateSalt();
  const hash = await hashPassword(tempPassword, salt);
  const storedHash = `${salt}:${hash}`;
  
  try {
    // Crear Super Admin (tenant_id = 1 por defecto)
    await c.env.DB
      .prepare(`
        INSERT INTO users (email, password_hash, tenant_id, is_admin, must_change_password)
        VALUES (?, ?, 1, 1, 1)
      `)
      .bind(storedHash, email, 1, 1, 1)
      .run();
    
    // Marcar setup como completado
    await c.env.DB
      .prepare('UPDATE system_config SET value = "true" WHERE key = "setup_completed"')
      .run();
    
    // Mostrar credenciales temporales
    return c.html(
      <MinimalLayout title="✅ Setup Completado">
        <SetupSuccessPage 
          email={email} 
          tempPassword={tempPassword}
        />
      </MinimalLayout>
    );
  } catch (error) {
    return c.html(
      <MinimalLayout title="Error">
        <SetupPage error="Error al crear administrador" />
      </MinimalLayout>
    );
  }
});
```

### PASO 5: Crear Componentes de Setup

**Archivo**: `src/views/pages.tsx`

Agregar dos componentes:

```typescript
// Formulario de Setup
export function SetupPage({ error }: { error?: string }) {
  return (
    <div class="max-w-md mx-auto py-12 px-4">
      <div class="bg-white rounded-lg shadow-lg p-8">
        <h1 class="text-3xl font-bold mb-2">ActionQ Setup</h1>
        <p class="text-gray-600 mb-8">
          Configura tu administrador para comenzar
        </p>
        
        {error && (
          <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p class="text-red-800">{error}</p>
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
              required
              placeholder="admin@ejemplo.com"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p class="mt-1 text-xs text-gray-500">
              Este será tu usuario de administrador
            </p>
          </div>
          
          <button
            type="submit"
            class="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            Crear Administrador
          </button>
        </form>
      </div>
    </div>
  );
}

// Página de éxito con credenciales
export function SetupSuccessPage({ email, tempPassword }: { email: string; tempPassword: string }) {
  return (
    <div class="max-w-md mx-auto py-12 px-4">
      <div class="bg-white rounded-lg shadow-lg p-8">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-green-600">✅ Listo</h1>
          <p class="text-gray-600 mt-2">Tu administrador fue creado exitosamente</p>
        </div>
        
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <p class="text-sm text-gray-600 mb-4">
            <strong>Email:</strong> {email}
          </p>
          <p class="text-sm text-gray-600 mb-4">
            <strong>Contraseña temporal:</strong>
          </p>
          <div class="bg-white border border-blue-300 rounded p-3 font-mono text-sm break-all">
            {tempPassword}
          </div>
        </div>
        
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
          <p class="text-sm text-amber-800">
            ⚠️ <strong>IMPORTANTE:</strong> Esta contraseña es temporal. 
            Deberás cambiarla en tu primer acceso.
          </p>
        </div>
        
        <a
          href="/login"
          class="block w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-center"
        >
          Ir a Login
        </a>
      </div>
    </div>
  );
}
```

### PASO 6: Middleware de Validación de Password

**Archivo**: `src/middleware/force-password-change.ts`

```typescript
export function createForcePasswordChangeMiddleware() {
  return async (c: Context, next: () => Promise<void>) => {
    const user = c.get('user');
    
    // Si no hay usuario, continuar
    if (!user) {
      return next();
    }
    
    // Si la ruta es para cambiar contraseña, permitir
    if (c.req.path === '/force-change-password') {
      return next();
    }
    
    // Si la ruta es logout, permitir
    if (c.req.path === '/logout') {
      return next();
    }
    
    // Si el usuario debe cambiar contraseña, redirigir
    if (user.must_change_password) {
      return c.redirect('/force-change-password');
    }
    
    return next();
  };
}
```

### PASO 7: Route para Cambio Forzado de Contraseña

**Archivo**: `src/routes/auth.routes.tsx`

```typescript
// GET /force-change-password
authRoutes.get('/force-change-password', (c) => {
  const user = c.get('user');
  
  if (!user || !user.must_change_password) {
    return c.redirect('/dashboard');
  }
  
  return c.html(
    <MinimalLayout title="Cambiar Contraseña">
      <ForceChangePasswordPage />
    </MinimalLayout>
  );
});

// POST /force-change-password
authRoutes.post('/force-change-password', async (c) => {
  const user = c.get('user');
  
  if (!user) {
    return c.redirect('/login');
  }
  
  const formData = await c.req.formData();
  const newPassword = (formData.get('new_password') as string || '').trim();
  const confirmPassword = (formData.get('confirm_password') as string || '').trim();
  
  // Validaciones
  if (newPassword !== confirmPassword) {
    return c.html(
      <MinimalLayout title="Error">
        <ForceChangePasswordPage error="Las contraseñas no coinciden" />
      </MinimalLayout>
    );
  }
  
  const validation = isSecurePassword(newPassword);
  if (!validation.valid) {
    return c.html(
      <MinimalLayout title="Error">
        <ForceChangePasswordPage 
          error={`Contraseña insegura: ${validation.errors.join(', ')}`}
        />
      </MinimalLayout>
    );
  }
  
  // Actualizar contraseña
  const salt = generateSalt();
  const hash = await hashPassword(newPassword, salt);
  const storedHash = `${salt}:${hash}`;
  
  try {
    await c.env.DB
      .prepare(
        'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?'
      )
      .bind(storedHash, user.id)
      .run();
    
    return c.redirect('/dashboard');
  } catch (error) {
    return c.html(
      <MinimalLayout title="Error">
        <ForceChangePasswordPage error="Error al actualizar contraseña" />
      </MinimalLayout>
    );
  }
});
```

### PASO 8: Componente ForceChangePasswordPage

**Archivo**: `src/views/pages.tsx`

```typescript
export function ForceChangePasswordPage({ error }: { error?: string }) {
  return (
    <div class="max-w-md mx-auto py-12 px-4">
      <div class="bg-white rounded-lg shadow-lg p-8">
        <h1 class="text-2xl font-bold mb-4">Cambiar Contraseña</h1>
        
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p class="text-sm text-blue-800">
            Por seguridad, debes cambiar tu contraseña temporal en el primer acceso.
          </p>
        </div>
        
        {error && (
          <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p class="text-red-800">{error}</p>
          </div>
        )}
        
        <form method="post" action="/force-change-password" class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Nueva Contraseña
            </label>
            <input
              type="password"
              name="new_password"
              required
              minLength={8}
              placeholder="Min. 8 caracteres"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p class="mt-1 text-xs text-gray-500">
              Debe incluir mayúscula, minúscula y número
            </p>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Confirmar Contraseña
            </label>
            <input
              type="password"
              name="confirm_password"
              required
              minLength={8}
              placeholder="Repite la contraseña"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            type="submit"
            class="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            Cambiar Contraseña
          </button>
        </form>
      </div>
    </div>
  );
}
```

### PASO 9: Actualizar schema.sql

**Archivo**: `src/db/schema.sql`

Asegurar que la tabla users tenga la columna `must_change_password`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  tenant_id INTEGER NOT NULL,
  is_admin BOOLEAN DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  must_change_password BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

### PASO 10: Testing

```bash
# 1. Deploy
npm run deploy

# 2. Ir a https://actionq.workers.dev (o tu dominio)
#    Debería redirigir a /setup

# 3. Ingresar email: test@ejemplo.com

# 4. Copiar contraseña temporal mostrada

# 5. Ir a /login

# 6. Debería redirigir a /force-change-password

# 7. Ingresar nueva contraseña

# 8. Debería ir a /dashboard

# 9. Refrescar página - no debe redirigir (ya cambió)
```

---

## CHECKLIST FINAL

- [ ] Crear D1 Database
- [ ] Crear KV Namespace
- [ ] Actualizar wrangler.toml
- [ ] Crear password-generator.ts
- [ ] Actualizar setup.routes.tsx (GET y POST)
- [ ] Crear SetupPage y SetupSuccessPage
- [ ] Crear componente ForceChangePasswordPage
- [ ] Crear middleware force-password-change.ts
- [ ] Agregar route POST /force-change-password
- [ ] Actualizar schema.sql con must_change_password
- [ ] Deploy y test

**¡Cuando termines, actualiza PRODUCTION_SETUP.md y marca las tareas como completadas!**

