/**
 * ActionQ - Servicio de Organizaciones (Tenants)
 * 
 * Maneja las operaciones de base de datos relacionadas con organizaciones.
 */

import type { Tenant } from '../types';

// ================================================
// TIPOS
// ================================================

export interface TenantWithStats extends Tenant {
  user_count?: number;
  domains?: string[];
}

// ================================================
// CONSULTAS DE ORGANIZACIONES
// ================================================

/**
 * Obtiene una organización por ID
 */
export async function getTenantById(db: D1Database, tenantId: number): Promise<Tenant | null> {
  return db
    .prepare('SELECT * FROM tenants WHERE id = ?')
    .bind(tenantId)
    .first<Tenant>();
}

/**
 * Obtiene una organización por nombre
 */
export async function getTenantByName(db: D1Database, name: string): Promise<Tenant | null> {
  return db
    .prepare('SELECT * FROM tenants WHERE name = ?')
    .bind(name)
    .first<Tenant>();
}

/**
 * Obtiene todas las organizaciones
 */
export async function getAllTenants(db: D1Database): Promise<Tenant[]> {
  const result = await db
    .prepare('SELECT * FROM tenants ORDER BY created_at DESC')
    .all<Tenant>();
  
  return result.results || [];
}

/**
 * Obtiene todas las organizaciones con estadísticas
 */
export async function getAllTenantsWithStats(db: D1Database): Promise<TenantWithStats[]> {
  const result = await db.prepare(`
    SELECT t.*, 
           (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count
    FROM tenants t 
    ORDER BY t.name
  `).all<Tenant & { user_count: number }>();
  
  return (result.results || []).map(t => ({
    ...t,
    domains: JSON.parse(t.allowed_domains || '[]'),
    user_count: t.user_count || 0
  }));
}

/**
 * Busca una organización que tenga un dominio específico
 */
export async function findTenantByDomain(
  db: D1Database, 
  domain: string
): Promise<Tenant | null> {
  const allTenants = await db
    .prepare('SELECT * FROM tenants WHERE is_active = 1')
    .all<Tenant>();
  
  for (const tenant of allTenants.results || []) {
    const domains: string[] = JSON.parse(tenant.allowed_domains || '[]');
    if (domains.includes(domain)) {
      return tenant;
    }
  }
  
  return null;
}

// ================================================
// OPERACIONES DE ORGANIZACIONES
// ================================================

/**
 * Crea una nueva organización
 */
export async function createTenant(
  db: D1Database,
  name: string,
  allowedDomains: string[] = []
): Promise<number> {
  const result = await db
    .prepare(`
      INSERT INTO tenants (name, allowed_domains, is_active)
      VALUES (?, ?, 1)
      RETURNING id
    `)
    .bind(name, JSON.stringify(allowedDomains))
    .first<{ id: number }>();
  
  return result?.id || 0;
}

/**
 * Actualiza los dominios permitidos de una organización
 */
export async function updateTenantDomains(
  db: D1Database, 
  tenantId: number, 
  domains: string[]
): Promise<void> {
  await db
    .prepare('UPDATE tenants SET allowed_domains = ? WHERE id = ?')
    .bind(JSON.stringify(domains), tenantId)
    .run();
}

/**
 * Añade un dominio a una organización
 */
export async function addTenantDomain(
  db: D1Database, 
  tenantId: number, 
  domain: string
): Promise<void> {
  const tenant = await getTenantById(db, tenantId);
  if (!tenant) throw new Error('Organización no encontrada');
  
  const domains: string[] = JSON.parse(tenant.allowed_domains || '[]');
  if (!domains.includes(domain)) {
    domains.push(domain);
    await updateTenantDomains(db, tenantId, domains);
  }
}

/**
 * Elimina un dominio de una organización
 */
export async function removeTenantDomain(
  db: D1Database, 
  tenantId: number, 
  domain: string
): Promise<void> {
  const tenant = await getTenantById(db, tenantId);
  if (!tenant) throw new Error('Organización no encontrada');
  
  const domains: string[] = JSON.parse(tenant.allowed_domains || '[]');
  const filteredDomains = domains.filter(d => d !== domain);
  await updateTenantDomains(db, tenantId, filteredDomains);
}

/**
 * Activa o desactiva una organización
 */
export async function toggleTenantActive(
  db: D1Database, 
  tenantId: number
): Promise<boolean> {
  await db
    .prepare('UPDATE tenants SET is_active = NOT is_active WHERE id = ?')
    .bind(tenantId)
    .run();
  
  const tenant = await getTenantById(db, tenantId);
  return tenant?.is_active === 1;
}

/**
 * Obtiene los dominios de una organización
 */
export function getTenantDomains(tenant: Tenant): string[] {
  return JSON.parse(tenant.allowed_domains || '[]');
}
