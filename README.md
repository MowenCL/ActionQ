# 🎫 ActionQ

**Sistema de Tickets Open Source** basado en Cloudflare Workers, Hono y D1.

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![Hono](https://img.shields.io/badge/Hono-v4-E36002?logo=hono)](https://hono.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 📋 Descripción

ActionQ es una **plantilla reutilizable (boilerplate)** para crear sistemas de gestión de tickets. Está diseñado para que cualquier administrador de sistemas pueda clonarlo y desplegarlo en su propia cuenta de Cloudflare **sin modificar el código fuente**, configurando únicamente variables de entorno.

### Características

- ✅ **Multi-tenant**: Soporte para múltiples organizaciones aisladas
- 🔐 **Autenticación segura**: Sesiones con cookies firmadas
- 🎨 **UI moderna**: TailwindCSS + HTMX (vía CDN, sin build)
- 🚀 **Serverless**: Cloudflare Workers (edge computing global)
- 💾 **Base de datos**: Cloudflare D1 (SQLite distribuido)
- 📦 **Zero Config**: Solo configura variables y despliega
- 🔧 **First-Run Setup**: Wizard de configuración inicial automático

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| **Runtime** | Cloudflare Workers |
| **Framework** | Hono.js v4 (con JSX/SSR) |
| **Base de Datos** | Cloudflare D1 (SQLite) |
| **Frontend** | HTML + TailwindCSS (CDN) + HTMX (CDN) |
| **Autenticación** | Cookies firmadas con SHA-256 |

---

## 📁 Estructura del Proyecto

```
ActionQ/
├── src/
│   ├── index.tsx              # 🚀 Entrada principal (Hono app)
│   ├── types.ts               # 📝 Definiciones TypeScript
│   ├── db/
│   │   └── schema.sql         # 💾 Esquema de base de datos
│   ├── middleware/
│   │   ├── auth.ts            # 🔐 Autenticación y sesiones
│   │   └── setup.ts           # ⚙️ Detección de primera instalación
│   └── views/
│       ├── Layout.tsx         # 🎨 Layout principal (Tailwind/HTMX)
│       └── pages.tsx          # 📄 Componentes de páginas
├── wrangler.toml.example      # ⚙️ Plantilla de configuración
├── .dev.vars.example          # 🔑 Plantilla de variables secretas
├── .gitignore                 # 🚫 Archivos ignorados
├── package.json               # 📦 Dependencias
├── tsconfig.json              # ⚡ Configuración TypeScript
└── README.md                  # 📖 Esta documentación
```

---

## 🚀 Guía de Instalación

### Prerrequisitos

- [Node.js](https://nodejs.org/) v18 o superior
- [Cuenta de Cloudflare](https://dash.cloudflare.com/sign-up) (gratis)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) instalado

### Paso 1: Clonar el Repositorio

```bash
git clone https://github.com/MowenCL/ActionQ.git
cd ActionQ
```

### Paso 2: Instalar Dependencias

```bash
npm install
```

### Paso 3: Configurar Wrangler

Copia el archivo de ejemplo y edítalo:

```bash
cp wrangler.toml.example wrangler.toml
```

### Paso 4: Crear la Base de Datos D1

```bash
npx wrangler d1 create actionq-db
```

Esto te dará un output como:

```toml
[[d1_databases]]
binding = "DB"
database_name = "actionq-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**📝 Copia el `database_id`** y pégalo en tu archivo `wrangler.toml`.

### Paso 5: Ejecutar el Esquema de Base de Datos

Para **desarrollo local**:

```bash
npm run db:local
```

Para **producción**:

```bash
npm run db:remote
```

### Paso 6: Configurar Variables de Entorno

#### Para Desarrollo Local

Copia el archivo de ejemplo:

```bash
cp .dev.vars.example .dev.vars
```

Edita `.dev.vars` con tus valores:

```env
# Genera una clave secreta segura (mínimo 32 caracteres)
APP_SECRET=tu-clave-super-secreta-de-al-menos-32-caracteres

# Email del primer administrador
ADMIN_INIT_EMAIL=admin@tudominio.com

# Contraseña temporal (cámbiala después del primer login)
ADMIN_INIT_PASSWORD=TuPasswordSeguro123!
```

> 💡 **Tip**: Genera una clave secreta con:
> ```bash
> openssl rand -hex 32
> ```

#### Para Producción

Configura los secretos en Cloudflare:

```bash
npx wrangler secret put APP_SECRET
# Ingresa tu clave secreta cuando se te pida

npx wrangler secret put ADMIN_INIT_EMAIL
# Ingresa el email del administrador

npx wrangler secret put ADMIN_INIT_PASSWORD
# Ingresa la contraseña temporal
```

### Paso 7: Iniciar en Desarrollo

```bash
npm run dev
```

Abre http://localhost:8787 en tu navegador.

### Paso 8: Desplegar a Producción

```bash
npm run deploy
```

Tu aplicación estará disponible en `https://actionq.<tu-subdominio>.workers.dev`

---

## ⚙️ Primera Configuración (First-Run)

Cuando accedas por primera vez a la aplicación:

1. Serás redirigido automáticamente a `/setup`
2. El email del administrador estará pre-configurado (desde `ADMIN_INIT_EMAIL`)
3. Completa tu nombre y el nombre de tu organización
4. Click en "Completar Configuración"
5. Inicia sesión con el email y contraseña configurados

> ⚠️ **Importante**: Cambia la contraseña del administrador inmediatamente después del primer login.

---

## 📊 Esquema de Base de Datos

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `system_config` | Configuración del sistema (ej: setup_complete) |
| `tenants` | Organizaciones/empresas |
| `users` | Usuarios del sistema |
| `tickets` | Tickets de soporte |
| `messages` | Mensajes/comentarios en tickets |

### Roles de Usuario

| Rol | Descripción |
|-----|-------------|
| `super_admin` | Acceso total a todas las organizaciones |
| `admin` | Administrador de una organización |
| `agent` | Agente de soporte |
| `user` | Usuario final (crea tickets) |

---

## 🔐 Seguridad

- ✅ **Sin secretos hardcodeados**: Todo se configura vía variables de entorno
- ✅ **Cookies firmadas**: Sesiones protegidas con SHA-256 + APP_SECRET
- ✅ **Headers de seguridad**: CSP, X-Frame-Options, etc. via Hono
- ✅ **Aislamiento multi-tenant**: Usuarios solo ven datos de su organización

---

## 🧪 Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia servidor de desarrollo local |
| `npm run deploy` | Despliega a Cloudflare Workers |
| `npm run db:local` | Ejecuta schema en D1 local |
| `npm run db:remote` | Ejecuta schema en D1 producción |
| `npm run types` | Genera tipos de Cloudflare |

---

## 🗺️ Roadmap

- [ ] Gestión de usuarios desde panel admin
- [ ] Notificaciones por email
- [ ] API REST para integraciones
- [ ] Exportación de tickets (CSV/PDF)
- [ ] Búsqueda avanzada con filtros
- [ ] Dashboard con métricas y gráficos
- [ ] Soporte para archivos adjuntos

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Por favor:

1. Fork el repositorio
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Añade nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

---

## 💬 Soporte

- 📝 [Abrir un Issue](https://github.com/MowenCL/ActionQ/issues)
- 💡 [Discusiones](https://github.com/MowenCL/ActionQ/discussions)

---

<p align="center">
  Hecho con ❤️ usando <a href="https://hono.dev">Hono</a> y <a href="https://workers.cloudflare.com">Cloudflare Workers</a>
</p>
