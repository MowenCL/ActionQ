#!/usr/bin/env node

/**
 * Setup Wrangler - Genera wrangler.toml desde variables de entorno
 * Útil para CI/CD y deployments automáticos desde Cloudflare Pages
 */

const fs = require('fs');
const path = require('path');

// Leer variables de entorno requeridas
const requiredEnvVars = [
  'CLOUDFLARE_DATABASE_ID',
  'CLOUDFLARE_KV_NAMESPACE_ID'
];

// Variables opcionales
const optionalEnvVars = {
  'CLOUDFLARE_PREVIEW_KV_NAMESPACE_ID': null,
  'ZEPTOMAIL_TOKEN': null,
  'ZEPTOMAIL_FROM_EMAIL': null,
  'ZEPTOMAIL_FROM_NAME': null
};

console.log('🔧 Configurando wrangler.toml desde variables de entorno...\n');

// Validar variables requeridas
const missingVars = [];
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    missingVars.push(varName);
  }
}

if (missingVars.length > 0) {
  console.error('❌ Error: Variables de entorno faltantes:');
  missingVars.forEach(v => {
    console.error(`   - ${v}`);
  });
  console.error('\n📖 Ver SETUP.md para instrucciones detalladas');
  process.exit(1);
}

// Construir wrangler.toml
let wranglerConfig = `# ================================================
# ActionQ - Configuración de Cloudflare Workers
# ================================================
# Generado automáticamente por scripts/setup-wrangler.js
# Fecha: ${new Date().toISOString()}

name = "actionq"
main = "src/index.tsx"
compatibility_date = "2026-01-20"

# ================================================
# Base de Datos D1
# ================================================
[[d1_databases]]
binding = "DB"
database_name = "actionq-db"
database_id = "${process.env.CLOUDFLARE_DATABASE_ID}"

# ================================================
# KV Namespace - Almacenamiento de OTP
# ================================================
[[kv_namespaces]]
binding = "OTP_STORE"
id = "${process.env.CLOUDFLARE_KV_NAMESPACE_ID}"
`;

// Agregar preview ID si está disponible
if (process.env.CLOUDFLARE_PREVIEW_KV_NAMESPACE_ID) {
  wranglerConfig += `preview_id = "${process.env.CLOUDFLARE_PREVIEW_KV_NAMESPACE_ID}"\n`;
}

// Agregar variables
wranglerConfig += `
# ================================================
# Variables de Entorno (No sensibles)
# ================================================
[vars]
APP_NAME = "ActionQ"
APP_VERSION = "1.0.0"
`;

// Si existen variables de ZeptoMail, agregarlas
if (process.env.ZEPTOMAIL_FROM_EMAIL) {
  wranglerConfig += `ZEPTOMAIL_FROM_EMAIL = "${process.env.ZEPTOMAIL_FROM_EMAIL}"\n`;
}
if (process.env.ZEPTOMAIL_FROM_NAME) {
  wranglerConfig += `ZEPTOMAIL_FROM_NAME = "${process.env.ZEPTOMAIL_FROM_NAME}"\n`;
}

// Guardar archivo
const wranglerPath = path.join(__dirname, '..', 'wrangler.toml');

try {
  fs.writeFileSync(wranglerPath, wranglerConfig, 'utf8');
  console.log('✅ wrangler.toml generado exitosamente\n');
  console.log(`📍 Ubicación: ${wranglerPath}\n`);
  
  // Mostrar resumen
  console.log('📋 Configuración:\n');
  console.log(`   Database ID: ${process.env.CLOUDFLARE_DATABASE_ID}`);
  console.log(`   KV Namespace ID: ${process.env.CLOUDFLARE_KV_NAMESPACE_ID}`);
  if (process.env.CLOUDFLARE_PREVIEW_KV_NAMESPACE_ID) {
    console.log(`   KV Preview ID: ${process.env.CLOUDFLARE_PREVIEW_KV_NAMESPACE_ID}`);
  }
  console.log();
  console.log('✨ Listo para desplegar con: npm run deploy\n');
  
} catch (error) {
  console.error('❌ Error al crear wrangler.toml:', error.message);
  process.exit(1);
}
