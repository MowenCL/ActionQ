# 🤖 INSTRUCCIONES PARA INSTALACION

## CONTEXTO ACTUAL

La aplicación ActionQ necesita un **Setup Interactivo** para que el usuario pueda:
1. Acceder a `/setup` en primer arranque
2. Ingresar sus datos y la primera empresa

## IMPLEMENTACIÓN PASO A PASO

# Iniciar sesion en cloudflare
npx wrangler login

### PASO 1: Preparar Infraestructura

Necesitas:

```bash
# 1. Crear D1 Database
npx wrangler d1 create actionq_db

# 2. Crear KV Namespace
npx wrangler kv namespace create "ACTIONQ_OTP_STORE"

# 3. Actualizar wrangler.toml con los IDs nuevos
# (Copiar los IDs del output anterior y pegarlos en el archivo)

# 4. Crea las tablas
npx wrangler d1 execute actionq_db --remote --file=src/db/schema.sql

# 5. Deploy
npm wrangler deploy

# 6. Generar clave secreta para firmar cookies y tokens de sesión
openssl rand -hex 32

# Guarda el secreto cuando se te pida
npx wrangler secret put APP_SECRET

# (Opcional) Configura zeptomail para envio de correos
npx wrangler secret put ZEPTOMAIL_TOKEN         #Ej. Zoho-enczapikey wSsV....
npx wrangler secret put ZEPTOMAIL_FROM_EMAIL    #Ej. noreply@mowen.cl
npx wrangler secret put ZEPTOMAIL_FROM_NAME     #Ej. Gestor de Tickets - Mowen