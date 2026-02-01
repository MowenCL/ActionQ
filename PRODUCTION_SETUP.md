# ActionQ - Configuración de Producción

## Estado Actual ✅

La aplicación está configurada para producción con:

### Base de Datos
- **D1 Database ID**: `c87de620-a2ac-4a4d-b876-cd0e6f417ed8`
- **Database Name**: `actionq-db`
- **Status**: ✅ Creada y vinculada
- **Region**: ENAM

### KV Store (OTP Storage)
- **Namespace ID**: `1c6b892402224bd792d7988cb58754c3`
- **Binding**: `OTP_STORE`
- **Purpose**: Almacenamiento temporal de códigos OTP
- **TTL**: Automático (15 minutos para OTP)

### Secretos Configurados
- **APP_SECRET**: ✅ Configurado en Cloudflare
  - Usado para firmar cookies y tokens de sesión
  - Se establece con: `npx wrangler secret put APP_SECRET`

### Variables de Entorno
```toml
[vars]
APP_NAME = "ActionQ"
APP_VERSION = "1.0.0"
```

### Worker
- **Name**: `actionq`
- **URL**: https://actionq.ezzekmilofuentesxd.workers.dev
- **Current Version**: `0e98f932-067b-4bf8-9ed2-9eae8c3fabad`

---

## Próximos Pasos - Instalación Limpia

### 1. Acceder al Setup Inicial

Abre la aplicación en el navegador:
```
https://actionq.ezzekmilofuentesxd.workers.dev/setup
```

### 2. Primera Ejecución

En la primera ejecución:
- Se crearán las tablas automáticamente
- Se creará el Super Admin con las credenciales de `.dev.vars`:
  - Email: `admin@actionq.local`
  - Password: `ActionQ@Dev2024!Secure`

⚠️ **IMPORTANTE**: Cambia estas credenciales inmediatamente después del login

### 3. Configuración de Email (ZeptoMail)

Para enviar OTPs y notificaciones:

1. Accede a `/admin/settings/email-provider`
2. Configura:
   - **ZeptoMail API Token**: Tu token de ZeptoMail
   - **Bounce Address**: Tu dirección de bounce (ej: bounce@tudominio.com)
   - **From Address**: Dirección del remitente
3. Guarda y prueba

### 4. Habilitar OTP

1. Accede a `/admin/settings/otp`
2. Activa "Habilitar OTP para registro y reset de contraseña"
3. Revisa los parámetros:
   - Longitud: 6 dígitos
   - TTL: 900 segundos (15 minutos)
   - Intentos: 3

---

## Configuración de Secretos en Producción

Para variables sensibles, usar `wrangler secret`:

```bash
# APP_SECRET (ya configurado)
npx wrangler secret put APP_SECRET

# Si necesitas ZeptoMail en producción:
npx wrangler secret put ZEPTOMAIL_API_TOKEN

# Ver todos los secretos:
npx wrangler secret list
```

---

## Variables de Desarrollo Local (.dev.vars)

Este archivo contiene credenciales para desarrollo local:
```
APP_SECRET=a8f9e2b1d4c7a3f5e8b2d9c1a4f7e0b3c6d9e2f5a8b1c4d7e0f3a6b9c2e5f8
ADMIN_INIT_EMAIL=admin@actionq.local
ADMIN_INIT_PASSWORD=ActionQ@Dev2024!Secure
```

⚠️ Este archivo está en `.gitignore` y NO se sube a GitHub

---

## Verificación de Salud

### Comprobar que todo está en orden:

```bash
# Ver Worker actual
npx wrangler whoami

# Ver bindings
npx wrangler deployments list

# Verificar D1
npx wrangler d1 info actionq-db

# Verificar KV
npx wrangler kv:key list --namespace-id 1c6b892402224bd792d7988cb58754c3
```

### Monitorear logs en vivo:
```bash
npx wrangler tail
```

---

## Flujo Completo de OTP

### Registro con OTP
1. Usuario accede a `/register`
2. Ingresa email → Click "Continuar"
3. Se envía OTP a su email
4. Código cuenta con cooldown: 60 segundos (no puede solicitar nuevo)
5. Máximo 3 solicitudes de código
6. Ingresa código → Crea contraseña → Cuenta creada

### Reset de Contraseña con OTP
1. Usuario accede a `/reset-password`
2. Ingresa email → Click "Continuar"
3. Se envía OTP a su email
4. Mismo flujo de cooldown y límites
5. Ingresa código → Nueva contraseña → Contraseña reseteada

### Limitaciones de OTP
- **TTL**: 15 minutos
- **Cooldown entre solicitudes**: 60 segundos
- **Máximo de solicitudes**: 3 por sesión
- **Intentos fallidos**: 3 antes de bloquear
- **Auto-limpieza**: Se elimina código anterior al crear uno nuevo

---

## Mantenimiento

### Limpiar KV Store (si es necesario)
```bash
npx wrangler kv:key delete --namespace-id 1c6b892402224bd792d7988cb58754c3 <KEY>

# O listar todas las keys:
npx wrangler kv:key list --namespace-id 1c6b892402224bd792d7988cb58754c3
```

### Backup de Base de Datos
```bash
npx wrangler d1 backup create actionq-db
```

### Ver backups
```bash
npx wrangler d1 backup list actionq-db
```

---

## Troubleshooting

### OTP no se envía
1. Verificar que email está habilitado: `/admin/settings/email-provider`
2. Revisar credenciales de ZeptoMail
3. Ver logs: `npx wrangler tail`
4. Verificar que el dominio está configurado en ZeptoMail

### Countdown timer no funciona
1. Abrir consola del navegador (F12)
2. Buscar errores JavaScript
3. Verificar que `nextRequestIn` viene del servidor
4. Limpiar caché del navegador

### No puedo crear usuario
1. Verificar que `/setup` se ejecutó correctamente
2. Revisar logs de base de datos
3. Confirmar que la tabla `users` existe

---

## Contacts & Support

- **GitHub**: https://github.com/MowenCL/ActionQ
- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Worker URL**: https://actionq.ezzekmilofuentesxd.workers.dev

