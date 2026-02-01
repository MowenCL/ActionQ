# ActionQ - Configuración de Producción - IMPLEMENTACIÓN LIMPIA

## ⚠️ ESTADO ACTUAL

Este documento describe la **próxima implementación** de ActionQ con un flujo de setup interactivo mejorado.

**Status**: En desarrollo
- ❌ KV Store: Eliminado
- ❌ D1 Database: Eliminado  
- ❌ Worker: Necesita recreación
- ❌ Setup interactivo: Necesita implementación

---

## 🎯 OBJETIVO PARA LA PRÓXIMA IA

### Problema a Resolver
El setup actual requiere variables de entorno hardcodeadas (.dev.vars), lo que es inflexible. 

**Solución**: Crear un **Setup Interactivo** donde:
1. Usuario accede a `/setup` por primera vez
2. Sistema detecta que es primer setup (tabla `system_config` vacía)
3. Muestra formulario para:
   - **Email del Admin**: Usuario lo ingresa
   - **Contraseña Temporal**: Sistema genera una aleatoria y segura
4. En el **primer login**, obliga a cambiar la contraseña

---

## 📋 TAREAS PARA LA PRÓXIMA IA

### TAREA 1: Crear flujo de Setup Interactivo
**Archivo**: `src/routes/setup.routes.tsx`

**Requerimientos**:
- [ ] GET `/setup` debe verificar si es primer setup
  - Si `system_config` está vacía → mostrar formulario
  - Si ya existe config → redirigir a `/login`
  
- [ ] Formulario debe pedir:
  - Email del Super Admin (validación email)
  - Campo para confirmar email
  - NO pedir contraseña (se genera automáticamente)
  
- [ ] POST `/setup` debe:
  - Generar contraseña aleatoria segura (12+ caracteres, mayús, minús, números, símbolos)
  - Mostrar contraseña temporal al usuario con mensaje:
    ```
    ✅ Super Admin creado exitosamente
    
    Email: usuario@ejemplo.com
    Contraseña temporal: TemP@ssw0rd2024!
    
    ⚠️ Esta contraseña es temporal. Deberás cambiarla en tu primer login.
    ```
  - Crear usuario en tabla `users`
  - Marcar en tabla `system_config` que setup fue completado

### TAREA 2: Forzar cambio de contraseña en primer login
**Archivo**: `src/middleware/auth.ts` o nuevo middleware `password-force-change.ts`

**Requerimientos**:
- [ ] Crear columna en `users`: `must_change_password` (default: true)
- [ ] Después del login, verificar esta columna
- [ ] Si es true → redirigir a `/force-change-password`
- [ ] Usuario no puede acceder a nada más hasta cambiar
- [ ] Después de cambiar → marcar como false

### TAREA 3: Página de cambio forzado de contraseña
**Archivo**: `src/views/pages.tsx` (nuevo componente `ForceChangePasswordPage`)

**Requerimientos**:
- [ ] URL: `/force-change-password`
- [ ] Mostrar mensaje: "Por seguridad, debes cambiar tu contraseña temporal en el primer acceso"
- [ ] Campos:
  - Contraseña actual (pre-llenada pero oculta)
  - Nueva contraseña
  - Confirmar nueva contraseña
  - Botón "Cambiar Contraseña"
- [ ] Validaciones:
  - Mínimo 8 caracteres
  - Al menos 1 mayúscula, 1 minúscula, 1 número
- [ ] POST `/force-change-password` debe actualizar y marcar `must_change_password = false`

### TAREA 4: Eliminación de dependencias hardcodeadas
**Archivos afectados**: 
- `src/routes/setup.routes.tsx` (línea donde usa ADMIN_INIT_EMAIL)
- `.dev.vars` (actualizar si es necesario)
- `wrangler.toml` (sin cambios)

**Requerimientos**:
- [ ] Remover todas las referencias a `ADMIN_INIT_EMAIL`
- [ ] Remover todas las referencias a `ADMIN_INIT_PASSWORD`
- [ ] El sistema debe funcionar SIN estas variables

### TAREA 5: Base de datos y KV
**Infraestructura necesaria**:
- [ ] Crear nueva D1 Database: `npx wrangler d1 create actionq-db`
- [ ] Crear nuevo KV Namespace: `npx wrangler kv:namespace create "OTP_STORE"`
- [ ] Actualizar `wrangler.toml` con los IDs nuevos
- [ ] Ejecutar migrations para crear tablas
- [ ] Asegurar tabla `users` tiene columna `must_change_password`

### TAREA 6: Testing
**Verificaciones**:
- [ ] Acceder a `/setup` muestra formulario si es primer setup
- [ ] Después de crear admin, `/setup` redirige a `/login`
- [ ] Login con admin temporal funciona
- [ ] Después del login, redirige a `/force-change-password`
- [ ] No puedo ir a otros URLs sin cambiar contraseña
- [ ] Cambio de contraseña funciona
- [ ] Próximo login usa nueva contraseña
- [ ] Ya no me pide cambiar contraseña

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### Flujo de Setup Completo

```
1. Usuario accede a https://actionq.workers.dev
   ↓
2. Detecta primer setup → redirige a /setup
   ↓
3. Formulario pide email
   ↓
4. Genera password temporal aleatoria
   ↓
5. Crea Super Admin en DB
   ↓
6. Muestra: "Email: X, Password: Y (temporal)"
   ↓
7. Usuario va a /login
   ↓
8. Sistema detecta must_change_password=true
   ↓
9. Redirige a /force-change-password
   ↓
10. Usuario ingresa nueva contraseña
    ↓
11. Valida y actualiza DB (must_change_password=false)
    ↓
12. Acceso a dashboard/admin
```

### Función para Generar Contraseña Aleatoria

Crear en `src/utils/password-generator.ts`:

```typescript
export function generateSecurePassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const all = uppercase + lowercase + numbers + symbols;
  let password = '';
  
  // Asegurar al menos 1 de cada tipo
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Llenar el resto aleatorio
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  
  // Mezclar
  return password.split('').sort(() => Math.random() - 0.5).join('');
}
```

### Cambios en tabla `users`

Agregar columna:
```sql
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 1;
```

### Cambios en tabla `system_config`

Agregar fila si no existe:
```sql
INSERT INTO system_config (key, value) VALUES ('setup_completed', 'false');
```

Después del setup:
```sql
UPDATE system_config SET value = 'true' WHERE key = 'setup_completed';
```

---

## 🚀 CHECKLIST ANTES DE IMPLEMENTAR

- [ ] Clonar repo limpio
- [ ] `npm install`
- [ ] Crear D1 Database limpia
- [ ] Crear KV Namespace limpio
- [ ] Actualizar `wrangler.toml`
- [ ] Ejecutar `npm run deploy`
- [ ] Acceder a `/setup`
- [ ] Ingresar email y completar setup
- [ ] Verificar que funciona flujo completo

---

## 📞 PREGUNTAS FRECUENTES (Para la próxima IA)

**P: ¿Dónde se almacena el email temporalmente?**
A: En la base de datos D1, tabla `users`, durante el setup.

**P: ¿Qué pasa si alguien accede a `/setup` dos veces?**
A: Sistema debe verificar `system_config` y redirigir a `/login` si ya está completado.

**P: ¿Cómo valido que el email es único?**
A: Consulta `SELECT * FROM users WHERE email = ?` antes de crear.

**P: ¿Debo permitir que edite el email después de setup?**
A: Sí, en `/admin/settings/profile`, pero debe validar unicidad.

**P: ¿Dónde se valida el cambio de contraseña?**
A: En el endpoint POST `/force-change-password`, verificar patrón seguro.

---

## 📊 ESTADO DE TAREAS

| Tarea | Status | Prioridad | Asignado a |
|-------|--------|-----------|-----------|
| Setup Interactivo | ⏳ Pendiente | 🔴 Alta | Próxima IA |
| Cambio Forzado Password | ⏳ Pendiente | 🔴 Alta | Próxima IA |
| Generador de Password | ⏳ Pendiente | 🟡 Media | Próxima IA |
| Testing | ⏳ Pendiente | 🟡 Media | Próxima IA |
| D1 + KV Setup | ⏳ Pendiente | 🔴 Alta | Próxima IA |

---

## 📝 NOTAS IMPORTANTES

1. **NO uses variables de entorno** para admin credentials
2. **TODO debe ser interactivo** - el usuario decide
3. **Primera contraseña es temporal** - validar en middleware
4. **Generador de contraseña segura** - mínimo 12 caracteres
5. **Setup único** - después no se puede re-correr

---

## 🔗 REFERENCIAS

- [Tabla Users Schema](./src/db/schema.sql) - Ver estructura actual
- [Setup Routes Actuales](./src/routes/setup.routes.tsx) - Base para implementación
- [Auth Middleware](./src/middleware/auth.ts) - Dónde validar must_change_password

Última actualización: 2026-02-01
Próxima IA: Implementar Setup Interactivo

