/**
 * ActionQ - Servicio de Tickets
 * 
 * Maneja las operaciones de base de datos relacionadas con tickets.
 */

import type { Ticket } from '../types';
import { PRIORITY_ORDER_SQL } from '../config/constants';

// ================================================
// TIPOS
// ================================================

export interface TicketWithDetails extends Ticket {
  user_name?: string;
  tenant_name?: string;
  agent_name?: string | null;
}

export interface TicketMessage {
  id: number;
  content: string;
  is_internal: number;
  created_at: string;
  user_name: string;
  secure_key_id: number | null;
  encrypted_value: string | null;
  iv: string | null;
}

export interface TicketParticipant {
  id: number;
  user_id: number;
  created_at: string;
  name: string;
  email: string;
  added_by_name: string;
}

// ================================================
// CONSULTAS DE TICKETS
// ================================================

/**
 * Obtiene un ticket por ID
 */
export async function getTicketById(db: D1Database, ticketId: number): Promise<Ticket | null> {
  return db
    .prepare('SELECT * FROM tickets WHERE id = ?')
    .bind(ticketId)
    .first<Ticket>();
}

/**
 * Obtiene tickets activos (no cerrados) para el equipo interno
 */
export async function getActiveTicketsForInternalTeam(
  db: D1Database
): Promise<TicketWithDetails[]> {
  const result = await db.prepare(`
    SELECT t.*, u.name as user_name, ten.name as tenant_name, agent.name as agent_name 
    FROM tickets t 
    LEFT JOIN users u ON t.created_by = u.id 
    LEFT JOIN tenants ten ON t.tenant_id = ten.id 
    LEFT JOIN users agent ON t.assigned_to = agent.id 
    WHERE t.status NOT IN ('closed')
    ORDER BY ${PRIORITY_ORDER_SQL}, t.created_at DESC
  `).all<TicketWithDetails>();
  
  return result.results || [];
}

/**
 * Obtiene tickets activos para una organización específica
 */
export async function getActiveTicketsForTenant(
  db: D1Database, 
  tenantId: number
): Promise<TicketWithDetails[]> {
  const result = await db.prepare(`
    SELECT t.*, u.name as user_name, ten.name as tenant_name, agent.name as agent_name 
    FROM tickets t 
    LEFT JOIN users u ON t.created_by = u.id 
    LEFT JOIN tenants ten ON t.tenant_id = ten.id 
    LEFT JOIN users agent ON t.assigned_to = agent.id 
    WHERE t.tenant_id = ? AND t.status NOT IN ('closed')
    ORDER BY ${PRIORITY_ORDER_SQL}, t.created_at DESC
  `).bind(tenantId).all<TicketWithDetails>();
  
  return result.results || [];
}

/**
 * Obtiene tickets activos para un usuario específico (incluyendo donde es participante)
 */
export async function getActiveTicketsForUser(
  db: D1Database, 
  userId: number
): Promise<TicketWithDetails[]> {
  const result = await db.prepare(`
    SELECT DISTINCT t.*, ten.name as tenant_name, agent.name as agent_name 
    FROM tickets t 
    LEFT JOIN tenants ten ON t.tenant_id = ten.id 
    LEFT JOIN users agent ON t.assigned_to = agent.id 
    LEFT JOIN ticket_participants tp ON t.id = tp.ticket_id
    WHERE (t.created_by = ? OR tp.user_id = ?) AND t.status NOT IN ('closed')
    ORDER BY ${PRIORITY_ORDER_SQL}, t.created_at DESC
  `).bind(userId, userId).all<TicketWithDetails>();
  
  return result.results || [];
}

/**
 * Obtiene tickets cerrados para el equipo interno
 */
export async function getClosedTicketsForInternalTeam(
  db: D1Database
): Promise<TicketWithDetails[]> {
  const result = await db.prepare(`
    SELECT t.*, u.name as user_name, ten.name as tenant_name, agent.name as agent_name 
    FROM tickets t 
    LEFT JOIN users u ON t.created_by = u.id 
    LEFT JOIN tenants ten ON t.tenant_id = ten.id 
    LEFT JOIN users agent ON t.assigned_to = agent.id 
    WHERE t.status = 'closed'
    ORDER BY t.updated_at DESC
  `).all<TicketWithDetails>();
  
  return result.results || [];
}

/**
 * Obtiene tickets cerrados para una organización
 */
export async function getClosedTicketsForTenant(
  db: D1Database, 
  tenantId: number
): Promise<TicketWithDetails[]> {
  const result = await db.prepare(`
    SELECT t.*, u.name as user_name, ten.name as tenant_name, agent.name as agent_name 
    FROM tickets t 
    LEFT JOIN users u ON t.created_by = u.id 
    LEFT JOIN tenants ten ON t.tenant_id = ten.id 
    LEFT JOIN users agent ON t.assigned_to = agent.id 
    WHERE t.tenant_id = ? AND t.status = 'closed'
    ORDER BY t.updated_at DESC
  `).bind(tenantId).all<TicketWithDetails>();
  
  return result.results || [];
}

/**
 * Obtiene tickets cerrados para un usuario
 */
export async function getClosedTicketsForUser(
  db: D1Database, 
  userId: number
): Promise<TicketWithDetails[]> {
  const result = await db.prepare(`
    SELECT DISTINCT t.*, ten.name as tenant_name, agent.name as agent_name 
    FROM tickets t 
    LEFT JOIN tenants ten ON t.tenant_id = ten.id 
    LEFT JOIN users agent ON t.assigned_to = agent.id 
    LEFT JOIN ticket_participants tp ON t.id = tp.ticket_id
    WHERE (t.created_by = ? OR tp.user_id = ?) AND t.status = 'closed'
    ORDER BY t.updated_at DESC
  `).bind(userId, userId).all<TicketWithDetails>();
  
  return result.results || [];
}

// ================================================
// OPERACIONES DE TICKETS
// ================================================

/**
 * Crea un nuevo ticket
 */
export async function createTicket(
  db: D1Database,
  data: {
    tenantId: number;
    title: string;
    description: string;
    priority: string;
    createdBy: number;
    createdByAgent?: number | null;
  }
): Promise<number> {
  const result = await db
    .prepare(`
      INSERT INTO tickets (tenant_id, title, description, priority, status, created_by, created_by_agent) 
      VALUES (?, ?, ?, ?, 'open', ?, ?)
      RETURNING id
    `)
    .bind(
      data.tenantId, 
      data.title, 
      data.description, 
      data.priority, 
      data.createdBy, 
      data.createdByAgent || null
    )
    .first<{ id: number }>();
  
  return result?.id || 0;
}

/**
 * Actualiza el estado de un ticket
 */
export async function updateTicketStatus(
  db: D1Database, 
  ticketId: number, 
  status: string
): Promise<void> {
  await db
    .prepare("UPDATE tickets SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(status, ticketId)
    .run();
}

/**
 * Asigna un ticket a un agente
 */
export async function assignTicket(
  db: D1Database, 
  ticketId: number, 
  agentId: number
): Promise<void> {
  await db
    .prepare("UPDATE tickets SET assigned_to = ?, status = 'in_progress', updated_at = datetime('now') WHERE id = ?")
    .bind(agentId, ticketId)
    .run();
}

/**
 * Actualiza la fecha de actualización de un ticket
 */
export async function touchTicket(db: D1Database, ticketId: number): Promise<void> {
  await db
    .prepare("UPDATE tickets SET updated_at = datetime('now') WHERE id = ?")
    .bind(ticketId)
    .run();
}

// ================================================
// MENSAJES
// ================================================

/**
 * Obtiene los mensajes de un ticket
 */
export async function getTicketMessages(
  db: D1Database, 
  ticketId: number, 
  includeInternal: boolean = true
): Promise<TicketMessage[]> {
  const query = includeInternal
    ? `SELECT m.*, u.name as user_name,
              sk.id as secure_key_id, sk.encrypted_value, sk.iv
       FROM messages m 
       JOIN users u ON m.user_id = u.id 
       LEFT JOIN secure_keys sk ON sk.message_id = m.id
       WHERE m.ticket_id = ? 
       ORDER BY m.created_at ASC`
    : `SELECT m.*, u.name as user_name,
              sk.id as secure_key_id, sk.encrypted_value, sk.iv
       FROM messages m 
       JOIN users u ON m.user_id = u.id 
       LEFT JOIN secure_keys sk ON sk.message_id = m.id
       WHERE m.ticket_id = ? AND m.is_internal = 0
       ORDER BY m.created_at ASC`;
  
  const result = await db.prepare(query).bind(ticketId).all<TicketMessage>();
  return result.results || [];
}

/**
 * Añade un mensaje a un ticket
 */
export async function addTicketMessage(
  db: D1Database,
  ticketId: number,
  userId: number,
  content: string,
  isInternal: boolean = false
): Promise<number> {
  const result = await db
    .prepare('INSERT INTO messages (ticket_id, user_id, content, is_internal) VALUES (?, ?, ?, ?) RETURNING id')
    .bind(ticketId, userId, content, isInternal ? 1 : 0)
    .first<{ id: number }>();
  
  return result?.id || 0;
}

// ================================================
// PARTICIPANTES
// ================================================

/**
 * Verifica si un usuario es participante de un ticket
 */
export async function isUserParticipant(
  db: D1Database, 
  ticketId: number, 
  userId: number
): Promise<boolean> {
  const result = await db
    .prepare('SELECT 1 FROM ticket_participants WHERE ticket_id = ? AND user_id = ?')
    .bind(ticketId, userId)
    .first();
  
  return !!result;
}

/**
 * Obtiene los participantes de un ticket
 */
export async function getTicketParticipants(
  db: D1Database, 
  ticketId: number
): Promise<TicketParticipant[]> {
  const result = await db
    .prepare(`
      SELECT tp.id, tp.user_id, tp.created_at, u.name, u.email, added.name as added_by_name
      FROM ticket_participants tp
      JOIN users u ON tp.user_id = u.id
      JOIN users added ON tp.added_by = added.id
      WHERE tp.ticket_id = ?
      ORDER BY tp.created_at ASC
    `)
    .bind(ticketId)
    .all<TicketParticipant>();
  
  return result.results || [];
}

/**
 * Añade un participante a un ticket
 */
export async function addTicketParticipant(
  db: D1Database,
  ticketId: number,
  userId: number,
  addedBy: number
): Promise<void> {
  await db
    .prepare('INSERT INTO ticket_participants (ticket_id, user_id, added_by) VALUES (?, ?, ?)')
    .bind(ticketId, userId, addedBy)
    .run();
}

/**
 * Elimina un participante de un ticket
 */
export async function removeTicketParticipant(
  db: D1Database,
  ticketId: number,
  participantId: number
): Promise<void> {
  await db
    .prepare('DELETE FROM ticket_participants WHERE ticket_id = ? AND id = ?')
    .bind(ticketId, participantId)
    .run();
}

/**
 * Obtiene usuarios disponibles para añadir como participantes
 */
export async function getAvailableParticipants(
  db: D1Database,
  tenantId: number,
  excludeUserIds: number[]
): Promise<{ id: number; name: string; email: string }[]> {
  const result = await db
    .prepare(`
      SELECT id, name, email 
      FROM users 
      WHERE tenant_id = ? 
        AND is_active = 1 
        AND id NOT IN (${excludeUserIds.join(',')})
      ORDER BY name
    `)
    .bind(tenantId)
    .all<{ id: number; name: string; email: string }>();
  
  return result.results || [];
}

/**
 * Obtiene agentes disponibles para asignación
 */
export async function getAvailableAgents(
  db: D1Database
): Promise<{ id: number; name: string }[]> {
  const result = await db
    .prepare(`SELECT id, name FROM users WHERE role IN ('super_admin', 'agent_admin', 'agent') AND is_active = 1 ORDER BY name`)
    .all<{ id: number; name: string }>();
  
  return result.results || [];
}
