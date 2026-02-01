/**
 * ActionQ - Servicio de Email
 * 
 * Integración con ZeptoMail para envío de correos transaccionales.
 * Documentación: https://www.zoho.com/zeptomail/help/api/email-sending.html
 */

// ================================================
// TIPOS
// ================================================

export interface EmailConfig {
  apiToken: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
}

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  content: string; // Base64
  filename: string;
  mime_type: string;
}

export interface SendEmailParams {
  to: EmailRecipient[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  attachments?: EmailAttachment[];
}

interface ZeptoMailResponse {
  data?: {
    message: string;
    request_id: string;
  };
  error?: {
    code: string;
    details: { code: string; message: string; target: string }[];
    message: string;
    request_id: string;
  };
}

// ================================================
// SERVICIO DE EMAIL
// ================================================

/**
 * Envía un correo electrónico usando ZeptoMail API
 */
export async function sendEmail(
  config: EmailConfig,
  params: SendEmailParams
): Promise<{ success: boolean; error?: string; requestId?: string }> {
  
  // Si no hay token configurado, no enviar (modo desarrollo)
  if (!config.apiToken || config.apiToken === 'not-configured') {
    console.log('[Email] Token no configurado, saltando envío:', params.subject);
    return { success: true, requestId: 'dev-mode' };
  }
  
  try {
    const payload = {
      from: {
        address: config.fromEmail,
        name: config.fromName
      },
      to: params.to.map(r => ({
        email_address: {
          address: r.email,
          name: r.name || r.email
        }
      })),
      subject: params.subject,
      htmlbody: params.htmlBody,
      textbody: params.textBody || stripHtml(params.htmlBody),
      ...(config.replyTo && {
        reply_to: {
          address: config.replyTo,
          name: config.fromName
        }
      }),
      ...(params.cc && params.cc.length > 0 && {
        cc: params.cc.map(r => ({
          email_address: {
            address: r.email,
            name: r.name || r.email
          }
        }))
      }),
      ...(params.bcc && params.bcc.length > 0 && {
        bcc: params.bcc.map(r => ({
          email_address: {
            address: r.email,
            name: r.name || r.email
          }
        }))
      })
    };
    
    const response = await fetch('https://api.zeptomail.com/v1.1/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Zoho-enczapikey ${config.apiToken}`
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json() as ZeptoMailResponse;
    
    if (!response.ok || result.error) {
      console.error('[Email] Error de ZeptoMail:', result.error);
      return {
        success: false,
        error: result.error?.message || 'Error desconocido al enviar email',
        requestId: result.error?.request_id
      };
    }
    
    console.log('[Email] Enviado correctamente:', result.data?.request_id);
    return {
      success: true,
      requestId: result.data?.request_id
    };
    
  } catch (error) {
    console.error('[Email] Error de conexión:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error de conexión'
    };
  }
}

// ================================================
// TEMPLATES DE EMAIL
// ================================================

/**
 * Genera el HTML base para emails
 */
function emailTemplate(content: string, appName: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; background-color: #3b82f6; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">🎫 ${appName}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                Este es un correo automático de ${appName}. Por favor no responda a este mensaje.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Email de bienvenida para nuevos usuarios
 */
export function welcomeEmailTemplate(
  userName: string,
  userEmail: string,
  tenantName: string,
  loginUrl: string,
  appName: string
): { subject: string; html: string } {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 20px;">¡Bienvenido/a, ${userName}!</h2>
    <p style="margin: 0 0 16px 0; color: #374151; line-height: 1.6;">
      Tu cuenta ha sido creada exitosamente en <strong>${appName}</strong>.
    </p>
    <table style="margin: 20px 0; background-color: #f3f4f6; border-radius: 8px; width: 100%;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">📧 Email:</p>
          <p style="margin: 0 0 16px 0; color: #111827; font-weight: 600;">${userEmail}</p>
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">🏢 Organización:</p>
          <p style="margin: 0; color: #111827; font-weight: 600;">${tenantName}</p>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 24px 0; color: #374151; line-height: 1.6;">
      Ya puedes iniciar sesión y comenzar a crear tickets de soporte.
    </p>
    <a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Iniciar Sesión
    </a>
  `;
  
  return {
    subject: `¡Bienvenido/a a ${appName}!`,
    html: emailTemplate(content, appName)
  };
}

/**
 * Email de notificación de nuevo ticket
 */
export function newTicketEmailTemplate(
  ticketId: number,
  ticketTitle: string,
  ticketDescription: string,
  createdBy: string,
  tenantName: string,
  ticketUrl: string,
  appName: string
): { subject: string; html: string } {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 20px;">Nuevo Ticket #${ticketId}</h2>
    <p style="margin: 0 0 16px 0; color: #374151; line-height: 1.6;">
      Se ha creado un nuevo ticket de soporte.
    </p>
    <table style="margin: 20px 0; background-color: #f3f4f6; border-radius: 8px; width: 100%;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">📋 Título:</p>
          <p style="margin: 0 0 16px 0; color: #111827; font-weight: 600;">${ticketTitle}</p>
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">👤 Creado por:</p>
          <p style="margin: 0 0 16px 0; color: #111827; font-weight: 600;">${createdBy}</p>
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">🏢 Organización:</p>
          <p style="margin: 0 0 16px 0; color: #111827; font-weight: 600;">${tenantName}</p>
          ${ticketDescription ? `
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">📝 Descripción:</p>
          <p style="margin: 0; color: #374151; line-height: 1.6;">${truncateText(ticketDescription, 200)}</p>
          ` : ''}
        </td>
      </tr>
    </table>
    <a href="${ticketUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Ver Ticket
    </a>
  `;
  
  return {
    subject: `[Ticket #${ticketId}] ${ticketTitle}`,
    html: emailTemplate(content, appName)
  };
}

/**
 * Email de ticket asignado
 */
export function ticketAssignedEmailTemplate(
  ticketId: number,
  ticketTitle: string,
  assignedTo: string,
  ticketUrl: string,
  appName: string
): { subject: string; html: string } {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 20px;">Ticket Asignado</h2>
    <p style="margin: 0 0 16px 0; color: #374151; line-height: 1.6;">
      Se te ha asignado el siguiente ticket:
    </p>
    <table style="margin: 20px 0; background-color: #dbeafe; border-radius: 8px; width: 100%; border-left: 4px solid #3b82f6;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0 0 8px 0; color: #1e40af; font-size: 14px;">#${ticketId}</p>
          <p style="margin: 0; color: #1e3a8a; font-weight: 600; font-size: 18px;">${ticketTitle}</p>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 24px 0; color: #374151; line-height: 1.6;">
      Hola <strong>${assignedTo}</strong>, por favor revisa este ticket lo antes posible.
    </p>
    <a href="${ticketUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Ver Ticket
    </a>
  `;
  
  return {
    subject: `[Asignado] Ticket #${ticketId}: ${ticketTitle}`,
    html: emailTemplate(content, appName)
  };
}

/**
 * Email de nuevo mensaje en ticket
 */
export function newMessageEmailTemplate(
  ticketId: number,
  ticketTitle: string,
  messageSender: string,
  messageContent: string,
  ticketUrl: string,
  appName: string
): { subject: string; html: string } {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 20px;">Nuevo Mensaje en Ticket #${ticketId}</h2>
    <p style="margin: 0 0 16px 0; color: #374151; line-height: 1.6;">
      <strong>${messageSender}</strong> ha añadido un mensaje al ticket:
    </p>
    <table style="margin: 20px 0; background-color: #f3f4f6; border-radius: 8px; width: 100%;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">📋 ${ticketTitle}</p>
          <div style="margin-top: 12px; padding: 16px; background-color: #ffffff; border-radius: 6px; border: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #374151; line-height: 1.6; white-space: pre-wrap;">${truncateText(messageContent, 500)}</p>
          </div>
        </td>
      </tr>
    </table>
    <a href="${ticketUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Ver Conversación
    </a>
  `;
  
  return {
    subject: `Re: [Ticket #${ticketId}] ${ticketTitle}`,
    html: emailTemplate(content, appName)
  };
}

/**
 * Email de cambio de estado en ticket
 */
export function ticketStatusChangeEmailTemplate(
  ticketId: number,
  ticketTitle: string,
  oldStatus: string,
  newStatus: string,
  changedBy: string,
  ticketUrl: string,
  appName: string
): { subject: string; html: string } {
  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    'Abierto': { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
    'En Progreso': { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
    'Esperando respuesta': { bg: '#fce7f3', text: '#9d174d', border: '#ec4899' },
    'Cerrado': { bg: '#d1fae5', text: '#065f46', border: '#10b981' }
  };
  
  const newStatusStyle = statusColors[newStatus] || statusColors['Abierto'];
  
  const content = `
    <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 20px;">Estado Actualizado</h2>
    <p style="margin: 0 0 16px 0; color: #374151; line-height: 1.6;">
      El ticket <strong>#${ticketId}</strong> ha cambiado de estado.
    </p>
    <table style="margin: 20px 0; width: 100%;">
      <tr>
        <td style="padding: 20px; background-color: #f3f4f6; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">Estado anterior</p>
          <p style="margin: 0; color: #6b7280; font-size: 16px; text-decoration: line-through;">${oldStatus}</p>
        </td>
        <td style="padding: 10px; text-align: center;">
          <span style="color: #9ca3af; font-size: 24px;">→</span>
        </td>
        <td style="padding: 20px; background-color: ${newStatusStyle.bg}; border-radius: 8px; text-align: center; border-left: 4px solid ${newStatusStyle.border};">
          <p style="margin: 0 0 8px 0; color: ${newStatusStyle.text}; font-size: 14px;">Nuevo estado</p>
          <p style="margin: 0; color: ${newStatusStyle.text}; font-size: 16px; font-weight: 600;">${newStatus}</p>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px;">
      Cambiado por: ${changedBy}
    </p>
    <a href="${ticketUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Ver Ticket
    </a>
  `;
  
  return {
    subject: `[${newStatus}] Ticket #${ticketId}: ${ticketTitle}`,
    html: emailTemplate(content, appName)
  };
}

// ================================================
// UTILIDADES
// ================================================

/**
 * Elimina tags HTML de un string
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Trunca texto a una longitud máxima
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Obtiene la configuración de email desde los bindings
 */
export function getEmailConfig(env: {
  ZEPTOMAIL_TOKEN?: string;
  ZEPTOMAIL_FROM_EMAIL?: string;
  ZEPTOMAIL_FROM_NAME?: string;
  APP_NAME?: string;
}): EmailConfig {
  return {
    apiToken: env.ZEPTOMAIL_TOKEN || 'not-configured',
    fromEmail: env.ZEPTOMAIL_FROM_EMAIL || 'noreply@example.com',
    fromName: env.ZEPTOMAIL_FROM_NAME || env.APP_NAME || 'ActionQ',
    replyTo: env.ZEPTOMAIL_FROM_EMAIL
  };
}
