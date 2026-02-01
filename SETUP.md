# 🚀 Guía de Configuración Inicial

Esta guía te ayudará a configurar ActionQ después de clonarlo desde GitHub.

## ⚠️ Importante: Configuración Obligatoria

El archivo `wrangler.toml` **NO está incluido en el repositorio** por seguridad (contiene IDs personales de tu cuenta Cloudflare). Debes crear uno tú mismo.

## 📋 Pasos de Configuración

### 1. Copiar la Plantilla de Configuración

```bash
cp wrangler.toml.example wrangler.toml
```

### 2. Crear la Base de Datos D1

Si no tienes una base de datos D1 creada, crea una ahora:

```bash
npx wrangler d1 create actionq-db
```

Cloudflare te mostrará algo como:

```
✓ Successfully created DB 'actionq-db'

[[d1_databases]]
binding = "DB"
database_name = "actionq-db"
database_id = "0771ebb6-1e82-4a2d-a6e5-f71b9082cf60"
```

### 3. Actualizar `wrangler.toml` con tu Database ID

Abre `wrangler.toml` y reemplaza:

```toml
[[d1_databases]]
binding = "DB"
database_name = "actionq-db"
database_id = "YOUR-D1-DATABASE-ID"  # ← REEMPLAZA ESTO
```

Reemplazando `YOUR-D1-DATABASE-ID` con el ID que obtuviste del paso anterior.

### 4. Crear el Namespace KV para OTP

```bash
npx wrangler kv:namespace create OTP_STORE
npx wrangler kv:namespace create OTP_STORE --preview
```

Cloudflare te mostrará:

```
[[kv_namespaces]]
binding = "OTP_STORE"
id = "c65e66dfb94e44a4b0c86aa2103acfe5"
preview_id = "d12345678901234567890123456789ab"
```

### 5. Copiar Variables de Entorno

```bash
cp .dev.vars.example .dev.vars
```

Edita `.dev.vars` con tus variables locales:

```bash
# Secreto para firmar cookies (genera uno aleatorio, mínimo 32 caracteres)
APP_SECRET=tu-secreto-muy-seguro-de-32-caracteres-minimo

# Primer administrador (temporal)
ADMIN_INIT_EMAIL=admin@ejemplo.com
ADMIN_INIT_PASSWORD=TempPassword123!

# (Opcional) Token de ZeptoMail para enviar emails
ZEPTOMAIL_TOKEN=tu-token-aqui
ZEPTOMAIL_FROM_EMAIL=noreply@tudominio.com
ZEPTOMAIL_FROM_NAME=ActionQ
```

### 6. Desarrollar Localmente

```bash
npm run dev
```

Abre http://localhost:8787 en tu navegador.

### 7. Desplegar a Producción

```bash
npm run deploy
```

O manualmente:

```bash
npx wrangler deploy
```

## 🔐 Configurar Secretos en Producción

Los archivos `.dev.vars` y `wrangler.toml` son **locales** y no se suben a GitHub. En producción, usa:

```bash
# Secreto de cookies
npx wrangler secret put APP_SECRET

# Credenciales del admin inicial
npx wrangler secret put ADMIN_INIT_EMAIL
npx wrangler secret put ADMIN_INIT_PASSWORD

# (Opcional) ZeptoMail
npx wrangler secret put ZEPTOMAIL_TOKEN
npx wrangler secret put ZEPTOMAIL_FROM_EMAIL
npx wrangler secret put ZEPTOMAIL_FROM_NAME
```

## ⚙️ Configuración en GitHub Actions

Si despliega desde GitHub Actions (Cloudflare Pages):

1. **Agregar secretos en GitHub** (Settings → Secrets and variables → Actions):
   - `CLOUDFLARE_API_TOKEN`: Tu token de API de Cloudflare
   - `CLOUDFLARE_ACCOUNT_ID`: Tu account ID
   - `WRANGLER_TOML_CONTENT`: Contenido codificado de tu `wrangler.toml`

2. **El workflow generará `wrangler.toml`** antes de desplegar

3. **Secretos de Wrangler** deben configurarse manualmente en Cloudflare Dashboard → Worker

## 🆘 Troubleshooting

### Error: "Missing entry-point to Worker script"

**Causa**: El archivo `wrangler.toml` no existe o está mal configurado.

**Solución**:
```bash
cp wrangler.toml.example wrangler.toml
# Edita wrangler.toml y agrega tu database_id
```

### Error: "Database not found"

**Causa**: El `database_id` en `wrangler.toml` es incorrecto.

**Solución**: Verifica que matches exactamente el ID de tu base de datos:
```bash
npx wrangler d1 list
```

### Error: "KV namespace not found"

**Causa**: No creaste el namespace `OTP_STORE`.

**Solución**:
```bash
npx wrangler kv:namespace create OTP_STORE
```

## 📚 Archivos Importantes

| Archivo | Propósito | Git |
|---------|-----------|-----|
| `wrangler.toml` | Configuración de Cloudflare | ❌ Ignorado |
| `wrangler.toml.example` | Plantilla de configuración | ✅ Incluido |
| `.dev.vars` | Variables locales | ❌ Ignorado |
| `.dev.vars.example` | Plantilla de variables | ✅ Incluido |
| `.env` | Variables de entorno | ❌ Ignorado |
| `src/index.tsx` | Entrada principal | ✅ Incluido |

## ✅ Verificar la Instalación

```bash
# Verificar que todo está configurado
npm run dev

# Debería mostrar:
# ✓ Ready at http://localhost:8787
```

Visita http://localhost:8787 y deberías ver el wizard de configuración inicial.

---

**¿Necesitas ayuda?** Abre un issue en GitHub: https://github.com/MowenCL/ActionQ/issues
