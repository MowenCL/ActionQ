-- Migración para añadir agent_admin al rol de usuarios
PRAGMA foreign_keys = OFF;

-- Crear tabla temporal
CREATE TABLE users_temp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('super_admin', 'admin', 'agent_admin', 'agent', 'user')),
    is_active INTEGER DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Copiar datos
INSERT INTO users_temp SELECT * FROM users;

-- Eliminar tabla antigua
DROP TABLE users;

-- Renombrar
ALTER TABLE users_temp RENAME TO users;

-- Recrear índices
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_role ON users(role);

-- Recrear trigger
CREATE TRIGGER update_users_timestamp 
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

PRAGMA foreign_keys = ON;
