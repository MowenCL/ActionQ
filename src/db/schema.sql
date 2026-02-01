-- ================================================
-- ActionQ - Esquema de Base de Datos D1
-- ================================================
--
-- INSTRUCCIONES:
-- 1. Asegúrate de tener wrangler.toml configurado
-- 2. Ejecuta para desarrollo local:
--    npm run db:local
-- 3. Ejecuta para producción:
--    npm run db:remote
--
-- ================================================

-- ================================================
-- TABLA: system_config
-- ================================================
-- Almacena configuración del sistema.
-- Clave 'setup_complete' = 'true' indica que la instalación finalizó.

CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ================================================
-- TABLA: tenants
-- ================================================
-- Organizaciones/empresas en el sistema multi-tenant.
-- Cada tenant tiene sus propios usuarios y tickets.
-- allowed_domains: JSON array de dominios de email permitidos para registro
--   Ejemplo: '["empresa.com", "subdominio.empresa.com"]'

CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    is_active INTEGER DEFAULT 1,
    settings TEXT DEFAULT '{}',
    allowed_domains TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Índice para búsqueda por slug
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- ================================================
-- TABLA: users
-- ================================================
-- Usuarios del sistema.
-- tenant_id = NULL para Super Admins (acceso global).

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('super_admin', 'agent_admin', 'agent', 'org_admin', 'user')),
    is_active INTEGER DEFAULT 1,
    must_change_password INTEGER DEFAULT 0,
    last_login_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ================================================
-- TABLA: tickets
-- ================================================
-- Tickets de soporte/incidencias.

CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'pending', 'closed')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_by_agent INTEGER REFERENCES users(id),
    assigned_to INTEGER REFERENCES users(id),
    tags TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);

-- ================================================
-- TABLA: messages
-- ================================================
-- Mensajes/comentarios en tickets.
-- is_internal = 1 para notas internas (no visibles al usuario final).

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    is_internal INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Índice para obtener mensajes de un ticket
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- ================================================
-- TABLA: ticket_participants
-- ================================================
-- Usuarios adicionales que pueden ver y participar en un ticket.
-- Permite añadir usuarios de la misma organización como observadores/involucrados.
-- Ejemplo: un empleado añade a su jefe para autorización.

CREATE TABLE IF NOT EXISTS ticket_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(ticket_id, user_id)
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_ticket_participants_ticket ON ticket_participants(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_participants_user ON ticket_participants(user_id);

-- ================================================
-- TABLA: secure_keys
-- ================================================
-- Claves/contraseñas encriptadas asociadas a tickets.
-- Solo visibles para participantes del ticket y agente asignado.
-- encrypted_value: valor encriptado con AES-GCM en base64
-- iv: initialization vector único en base64

CREATE TABLE IF NOT EXISTS secure_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    encrypted_value TEXT NOT NULL,
    iv TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_secure_keys_ticket ON secure_keys(ticket_id);
CREATE INDEX IF NOT EXISTS idx_secure_keys_message ON secure_keys(message_id);

-- ================================================
-- TRIGGERS: Actualizar updated_at automáticamente
-- ================================================

CREATE TRIGGER IF NOT EXISTS update_tenants_timestamp 
    AFTER UPDATE ON tenants
    BEGIN
        UPDATE tenants SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_tickets_timestamp 
    AFTER UPDATE ON tickets
    BEGIN
        UPDATE tickets SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_system_config_timestamp 
    AFTER UPDATE ON system_config
    BEGIN
        UPDATE system_config SET updated_at = datetime('now') WHERE key = NEW.key;
    END;
