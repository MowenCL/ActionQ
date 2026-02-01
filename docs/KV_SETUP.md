# 🔑 Setup de Cloudflare KV para OTP

Este archivo contiene instrucciones paso a paso para configurar Cloudflare KV.

## 📋 Paso a Paso

### 1. Crear KV Namespace

```bash
# Crear namespace para producción
npx wrangler kv:namespace create "OTP_STORE"
```

Verás un output similar a:

```
✓ Successfully created namespace: OTP_STORE
✓ Add the following to your wrangler.toml:

[[kv_namespaces]]
binding = "OTP_STORE"
id = "abc123def456789"
preview_id = "xyz789uvw012345"
```

### 2. Copiar los IDs

De tu output anterior, copia:
- `id = "abc123def456789"` (reemplaza con el tuyo)
- `preview_id = "xyz789uvw012345"` (reemplaza con el tuyo)

### 3. Actualizar wrangler.toml

Abre `wrangler.toml` y descomenta y actualiza la sección de KV:

**Antes:**
```toml
# [[kv_namespaces]]
# binding = "OTP_STORE"
# id = ""  # Reemplaza con tu KV namespace ID de producción
# preview_id = ""  # Reemplaza con tu KV namespace ID de preview (desarrollo)
```

**Después:**
```toml
[[kv_namespaces]]
binding = "OTP_STORE"
id = "abc123def456789"  # Reemplaza con tu ID
preview_id = "xyz789uvw012345"  # Reemplaza con tu preview ID
```

### 4. Verificar la Configuración

```bash
# En desarrollo
npm run dev

# Deberías ver en los bindings:
# - OTP_STORE: KVNamespace
```

### 5. Verificar en Cloudflare Dashboard

1. Ve a https://dash.cloudflare.com/
2. Selecciona tu cuenta
3. En la barra lateral, ve a **Workers & Pages** → **KV**
4. Deberías ver tu namespace "OTP_STORE" listado

---

## ✅ Verificación Rápida

Para asegurarte que KV está correctamente configurado:

```bash
# Ejecuta esto en una ruta de prueba
const result = await c.env.OTP_STORE.put('test-key', 'test-value');
const value = await c.env.OTP_STORE.get('test-key');
console.log('KV Working:', value === 'test-value'); // Debería ser true
```

---

## 🐛 Solución de Problemas

### Error: "OTP_STORE is undefined"
- Verifica que `wrangler.toml` tiene la sección `[[kv_namespaces]]` descomentada
- Verifica que los IDs no están vacíos
- Reinicia el servidor de desarrollo con `npm run dev`

### Error: "Invalid ID format"
- Asegúrate de copiar los IDs correctamente desde el output del comando
- Los IDs suelen ser cadenas hexadecimales (abc123...)
- No incluyas comillas adicionales

### Los cambios no se reflejan
- KV puede tomar unos segundos en sincronizar
- Espera 5-10 segundos y recarga
- En desarrollo, los cambios de KV se reflejan de inmediato

### El OTP_STORE no aparece en Cloudflare Dashboard
- Espera 2-3 minutos después de crear el namespace
- Refresca la página del dashboard
- Verifica que estés en la cuenta de Cloudflare correcta

---

## 🔄 Separar Dev y Producción (Opcional)

Si deseas tener KV separado para desarrollo y producción:

```bash
# Crear namespaces separados (opcional)
npx wrangler kv:namespace create "OTP_STORE" --preview
npx wrangler kv:namespace create "OTP_STORE_PROD"
npx wrangler kv:namespace create "OTP_STORE_PROD" --preview
```

Luego en `wrangler.toml`:

```toml
# Para desarrollo (env default)
[[kv_namespaces]]
binding = "OTP_STORE"
id = "dev-id-aqui"
preview_id = "dev-preview-id-aqui"

# Para producción
[env.production]
[[env.production.kv_namespaces]]
binding = "OTP_STORE"
id = "prod-id-aqui"
preview_id = "prod-preview-id-aqui"
```

---

## 📚 Referencias

- [Cloudflare KV Documentation](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [Wrangler KV CLI](https://developers.cloudflare.com/workers/wrangler/commands/#kv)

---

**¿Necesitas ayuda?** Consulta [OTP_GUIDE.md](../docs/OTP_GUIDE.md) para más detalles sobre el sistema OTP.
