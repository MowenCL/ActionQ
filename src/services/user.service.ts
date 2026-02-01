/**
 * ActionQ - Servicio de Usuarios
 * 
 * Maneja las operaciones de base de datos relacionadas con usuarios.
 */

import type { User } from '../types';

// ================================================
// TIPOS
// ================================================

export interface UserWithTenant extends User {
  tenant_name?: string;
}

// ================================================
// CONSULTAS DE USUARIOS
// ================================================

/**
 * Obtiene un usuario por ID
 */
export async function getUserById(db: D1Database, userId: number): Promise<User | null> {
  return db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first<User>();
}

/**
 * Obtiene un usuario por email
 */
export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
  return db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first<User>();
}

/**
 * Obtiene el nombre de un usuario por ID
 */
export async function getUserName(db: D1Database, userId: number): Promise<string | null> {
  const user = await db
    .prepare('SELECT name FROM users WHERE id = ?')
    .bind(userId)
    .first<{ name: string }>();
  
  return user?.name || null;
}

/**
 * Obtiene usuarios del equipo interno (super_admin, agent_admin, agent)
 */
export async function getInternalTeamUsers(db: D1Database): Promise<UserWithTenant[]> {
  const result = await db
    .prepare(`
      SELECT u.*, t.name as tenant_name 
      FROM users u 
      LEFT JOIN tenants t ON u.tenant_id = t.id 
      WHERE u.role IN ('super_admin', 'agent_admin', 'agent') 
      ORDER BY u.created_at DESC
    `)
    .all<UserWithTenant>();
  
  return result.results || [];
}

/**
 * Obtiene usuarios de una organización
 */
export async function getUsersByTenant(
  db: D1Database, 
  tenantId: number
): Promise<User[]> {
  const result = await db
    .prepare('SELECT * FROM users WHERE tenant_id = ? ORDER BY name')
    .bind(tenantId)
    .all<User>();
  
  return result.results || [];
}

/**
 * Obtiene usuarios activos de una organización
 */
export async function getActiveUsersByTenant(
  db: D1Database, 
  tenantId: number
): Promise<{ id: number; name: string; email: string }[]> {
  const result = await db
    .prepare('SELECT id, name, email FROM users WHERE tenant_id = ? AND is_active = 1 ORDER BY name')
    .bind(tenantId)
    .all<{ id: number; name: string; email: string }>();
  
  return result.results || [];
}

// ================================================
// OPERACIONES DE USUARIOS
// ================================================

/**
 * Crea un nuevo usuario
 */
export async function createUser(
  db: D1Database,
  data: {
    email: string;
    name: string;
    passwordHash: string;
    salt: string;
    role: string;
    tenantId: number | null;
  }
): Promise<number> {
  const result = await db
    .prepare(`
      INSERT INTO users (email, name, password_hash, salt, role, tenant_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
      RETURNING id
    `)
    .bind(
      data.email.toLowerCase(),
      data.name,
      data.passwordHash,
      data.salt,
      data.role,
      data.tenantId
    )
    .first<{ id: number }>();
  
  return result?.id || 0;
}

/**
 * Actualiza el rol de un usuario
 */
export async function updateUserRole(
  db: D1Database, 
  userId: number, 
  role: string
): Promise<void> {
  await db
    .prepare('UPDATE users SET role = ? WHERE id = ?')
    .bind(role, userId)
    .run();
}

/**
 * Activa o desactiva un usuario
 */
export async function toggleUserActive(
  db: D1Database, 
  userId: number
): Promise<boolean> {
  await db
    .prepare('UPDATE users SET is_active = NOT is_active WHERE id = ?')
    .bind(userId)
    .run();
  
  const user = await getUserById(db, userId);
  return user?.is_active === 1;
}

/**
 * Elimina un usuario
 */
export async function deleteUser(db: D1Database, userId: number): Promise<void> {
  await db
    .prepare('DELETE FROM users WHERE id = ?')
    .bind(userId)
    .run();
}

/**
 * Verifica si un usuario existe por email
 */
export async function userExistsByEmail(db: D1Database, email: string): Promise<boolean> {
  const user = await getUserByEmail(db, email);
  return !!user;
}
