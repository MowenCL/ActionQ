/**
 * ActionQ - Servicio de Claves Seguras
 * 
 * Maneja las operaciones de claves encriptadas en tickets.
 */

import { encryptValue, decryptValue } from '../utils/crypto';

// ================================================
// TIPOS
// ================================================

export interface SecureKey {
  id: number;
  ticket_id: number;
  message_id: number | null;
  encrypted_value: string;
  iv: string;
  created_by: number;
  created_at: string;
}

// ================================================
// CONSULTAS
// ================================================

/**
 * Obtiene una clave segura por ID
 */
export async function getSecureKeyById(
  db: D1Database, 
  keyId: number
): Promise<SecureKey | null> {
  return db
    .prepare('SELECT * FROM secure_keys WHERE id = ?')
    .bind(keyId)
    .first<SecureKey>();
}

/**
 * Obtiene todas las claves seguras de un ticket
 */
export async function getSecureKeysByTicket(
  db: D1Database, 
  ticketId: number
): Promise<SecureKey[]> {
  const result = await db
    .prepare('SELECT * FROM secure_keys WHERE ticket_id = ? ORDER BY created_at ASC')
    .bind(ticketId)
    .all<SecureKey>();
  
  return result.results || [];
}

// ================================================
// OPERACIONES
// ================================================

/**
 * Crea una nueva clave segura encriptada
 */
export async function createSecureKey(
  db: D1Database,
  data: {
    ticketId: number;
    value: string;
    createdBy: number;
    messageId?: number | null;
  },
  appSecret: string
): Promise<number> {
  // Encriptar el valor
  const { encrypted, iv } = await encryptValue(data.value, appSecret);
  
  const result = await db
    .prepare(`
      INSERT INTO secure_keys (ticket_id, encrypted_value, iv, created_by, message_id) 
      VALUES (?, ?, ?, ?, ?)
      RETURNING id
    `)
    .bind(
      data.ticketId,
      encrypted, 
      iv, 
      data.createdBy, 
      data.messageId || null
    )
    .first<{ id: number }>();
  
  return result?.id || 0;
}

/**
 * Desencripta el valor de una clave segura
 */
export async function decryptSecureKey(
  secureKey: SecureKey,
  appSecret: string
): Promise<string> {
  return decryptValue(secureKey.encrypted_value, secureKey.iv, appSecret);
}

/**
 * Elimina una clave segura
 */
export async function deleteSecureKey(
  db: D1Database, 
  keyId: number
): Promise<void> {
  await db
    .prepare('DELETE FROM secure_keys WHERE id = ?')
    .bind(keyId)
    .run();
}

/**
 * Añade un mensaje de log cuando se elimina una clave
 */
export async function logSecureKeyDeletion(
  db: D1Database,
  ticketId: number,
  userId: number,
  userName: string
): Promise<void> {
  await db
    .prepare('INSERT INTO messages (ticket_id, user_id, content, is_internal) VALUES (?, ?, ?, 1)')
    .bind(ticketId, userId, `🗑️ ${userName} eliminó una clave segura del ticket.`)
    .run();
}

/**
 * Añade un mensaje de log cuando se crea una clave
 */
export async function logSecureKeyCreation(
  db: D1Database,
  ticketId: number,
  userId: number,
  userName: string
): Promise<void> {
  await db
    .prepare('INSERT INTO messages (ticket_id, user_id, content, is_internal) VALUES (?, ?, ?, 1)')
    .bind(ticketId, userId, `🔐 ${userName} añadió una clave segura al ticket.`)
    .run();
}
