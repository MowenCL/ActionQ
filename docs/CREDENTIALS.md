# 🔐 Obtener tus Credenciales de Cloudflare

Esta guía te ayuda a encontrar todos los IDs y tokens que necesitas para configurar ActionQ.

## 1️⃣ Account ID

1. Ve a https://dash.cloudflare.com/
2. En cualquier página, mira la URL:
   ```
   https://dash.cloudflare.com/c[AQUI_ESTA_TU_ID]/overview
   ```
3. Copia los caracteres después de `/c`

**Ejemplo**: Si la URL es `https://dash.cloudflare.com/c1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6/overview`, tu Account ID es `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6`

## 2️⃣ API Token

1. Ve a https://dash.cloudflare.com/profile/api-tokens
2. Haz click en **"Create Token"**
3. Selecciona el template **"Edit Cloudflare Workers"** (recomendado)
4. Configura los permisos:
   - **Permissions**: Account > Cloudflare Workers (Edit)
   - **Account Resources**: Todas las cuentas
   - **Zone Resources**: Ninguna
5. Copia el token generado

⚠️ **Importante**: El token solo se muestra UNA VEZ. Guárdalo en un lugar seguro.

## 3️⃣ Database ID (D1)

### Si ya tienes una base de datos creada:

```bash
npx wrangler d1 list
```

Busca en la salida algo como:
```
┌──────────────────────────────────────┬──────────────────────────────────────┐
│ name                                 │ id                                   │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ actionq-db                           │ 0771ebb6-1e82-4a2d-a6e5-f71b9082cf60 │
```

Copia el `id`.

### Si NO tienes una base de datos:

```bash
npx wrangler d1 create actionq-db
```

El output te mostrará algo como:

```toml
[[d1_databases]]
binding = "DB"
database_name = "actionq-db"
database_id = "0771ebb6-1e82-4a2d-a6e5-f71b9082cf60"
```

Copia el `database_id`.

## 4️⃣ KV Namespace ID

### Si ya tienes un namespace creado:

```bash
npx wrangler kv:namespace list
```

Busca en la salida:
```
┌──────────┬──────────────────────────────────────┐
│ title    │ id                                   │
├──────────┼──────────────────────────────────────┤
│ OTP_STORE│ c65e66dfb94e44a4b0c86aa2103acfe5    │
```

Copia el `id`.

### Si NO tienes un namespace:

```bash
npx wrangler kv:namespace create OTP_STORE
```

El output te mostrará:

```toml
[[kv_namespaces]]
binding = "OTP_STORE"
id = "c65e66dfb94e44a4b0c86aa2103acfe5"
preview_id = "d12345678901234567890123456789ab"
```

Copia tanto `id` como `preview_id` (este es importante para testing).

## 5️⃣ ZeptoMail Token (Opcional)

Si quieres enviar emails con OTP:

1. Ve a https://www.zoho.com/zeptomail/
2. Crea una cuenta (es gratuita)
3. Verifica tu dominio remitente
4. Ve a **Email Sending** → **Technical Details**
5. Copia el **API Key**

## 📋 Resumen de Credenciales

Cuando hayas recopilado todo, deberías tener:

```
✅ Account ID:                    1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6
✅ API Token:                     v1.0_abc123def456...
✅ Database ID (D1):              0771ebb6-1e82-4a2d-a6e5-f71b9082cf60
✅ KV Namespace ID (OTP_STORE):   c65e66dfb94e44a4b0c86aa2103acfe5
✅ KV Preview ID (OTP_STORE):     d12345678901234567890123456789ab
✅ ZeptoMail Token (opcional):    b2c48d7e9f1a3b5c7d9e1f3a5b7c9d1e (si usas emails)
```

## 🚀 Pasos Finales

### Para desarrollo local:

1. Crea `wrangler.toml`:
```bash
cp wrangler.toml.example wrangler.toml
```

2. Edita `wrangler.toml` y reemplaza:
   - `YOUR-D1-DATABASE-ID` con tu Database ID
   - Agrega tu KV Namespace ID en la sección de `kv_namespaces`

3. Configura variables locales (`.dev.vars`):
```bash
cp .dev.vars.example .dev.vars
```

4. Edita `.dev.vars` con:
   - `APP_SECRET`: Cualquier string de 32+ caracteres
   - `ADMIN_INIT_EMAIL`: Tu email
   - `ADMIN_INIT_PASSWORD`: Una contraseña temporal
   - `ZEPTOMAIL_TOKEN` (opcional)

5. Inicia el desarrollo:
```bash
npm run dev
```

### Para GitHub Actions (Cloudflare Pages):

1. En tu repositorio, ve a **Settings** → **Secrets and variables** → **Actions**

2. Agrega estos secretos:

| Nombre | Valor |
|--------|-------|
| `CLOUDFLARE_API_TOKEN` | Tu API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Tu Account ID |
| `CLOUDFLARE_DATABASE_ID` | Tu Database ID |
| `CLOUDFLARE_KV_NAMESPACE_ID` | Tu KV Namespace ID |
| `CLOUDFLARE_PREVIEW_KV_NAMESPACE_ID` | Tu KV Preview ID |
| `ZEPTOMAIL_TOKEN` | Tu ZeptoMail Token (opcional) |
| `ZEPTOMAIL_FROM_EMAIL` | Tu email remitente (opcional) |
| `ZEPTOMAIL_FROM_NAME` | Nombre remitente (opcional) |
| `APP_SECRET` | Generado: cualquier string 32+ caracteres |
| `ADMIN_INIT_EMAIL` | Tu email |
| `ADMIN_INIT_PASSWORD` | Contraseña temporal |

3. Haz un push a `main`:
```bash
git add .
git commit -m "Deploy to Cloudflare"
git push origin main
```

4. GitHub Actions desplegará automáticamente y configurará todo.

## ✅ Verificar que Funciona

```bash
# Ver si está desplegado
npx wrangler deployments list

# Ver logs en vivo
npx wrangler tail
```

## 🆘 Problemas Comunes

**"API Token invalid"**
- Verifica que el token no esté expirado
- Revisa que tenga permisos de "Workers"

**"Database not found"**
- Verifica que el Database ID sea correcto con `npx wrangler d1 list`

**"KV namespace not found"**
- Verifica que el ID sea correcto con `npx wrangler kv:namespace list`

---

¿Necesitas ayuda? Abre un issue: https://github.com/MowenCL/ActionQ/issues
