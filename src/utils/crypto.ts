/**
 * ActionQ - Utilidades de Criptografía
 * 
 * Funciones para encriptación y desencriptación usando AES-256-GCM.
 * Utiliza Web Crypto API disponible en Cloudflare Workers.
 */

/**
 * Deriva una clave AES-256 desde un secreto usando PBKDF2
 * @param secret - El secreto base (APP_SECRET)
 * @returns CryptoKey para usar con AES-GCM
 */
async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('ActionQ-SecureKeys-v1'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encripta un valor usando AES-256-GCM
 * @param value - Valor a encriptar
 * @param secret - Secreto para derivar la clave
 * @returns Objeto con valor encriptado e IV en base64
 */
export async function encryptValue(
  value: string, 
  secret: string
): Promise<{ encrypted: string; iv: string }> {
  const key = await deriveKey(secret);
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV para AES-GCM
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(value)
  );
  
  // Convertir a base64
  const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  const ivBase64 = btoa(String.fromCharCode(...iv));
  
  return { encrypted: encryptedBase64, iv: ivBase64 };
}

/**
 * Desencripta un valor usando AES-256-GCM
 * @param encryptedBase64 - Valor encriptado en base64
 * @param ivBase64 - IV en base64
 * @param secret - Secreto para derivar la clave
 * @returns Valor desencriptado
 */
export async function decryptValue(
  encryptedBase64: string, 
  ivBase64: string, 
  secret: string
): Promise<string> {
  const key = await deriveKey(secret);
  
  // Convertir de base64
  const encrypted = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );
  
  return new TextDecoder().decode(decrypted);
}
