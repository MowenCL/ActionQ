# 📧 Variables para Plantillas de Email en ZeptoMail

Este documento describe todas las variables disponibles para crear plantillas personalizadas de email en ZeptoMail para ActionQ.

## 📋 Índice

- [Variables Globales](#variables-globales)
- [Plantilla: Correo de Prueba](#plantilla-correo-de-prueba)
- [Plantilla: Restablecimiento de Contraseña](#plantilla-restablecimiento-de-contraseña)
- [Plantilla: Notificaciones de Tickets](#plantilla-notificaciones-de-tickets)
- [Sintaxis de ZeptoMail](#sintaxis-de-zeptomail)
- [Buenas Prácticas](#buenas-prácticas)

---

## 🌍 Variables Globales

Estas variables están disponibles en **todas** las plantillas:

| Variable | Tipo | Descripción | Ejemplo |
|----------|------|-------------|---------|
| `{{app_name}}` | string | Nombre de la aplicación | `ActionQ` |
| `{{app_url}}` | string | URL base de la aplicación | `https://actionq.example.com` |

---

## 🧪 Plantilla: Correo de Prueba

**Archivo:** `test-email.html`  
**Template Key configurado:** `2d6f.7af6fdbb5801d78b.k1.5dcff0c1-ff84-11f0-bfe0-1ae16fad91d9.19c19dd09ba`

### Variables disponibles:

| Variable | Tipo | Descripción | Ejemplo |
|----------|------|-------------|---------|
| `{{recipient_email}}` | string | Email del destinatario | `admin@example.com` |
| `{{test_date}}` | string | Fecha y hora del envío | `sábado, 1 de febrero de 2026, 14:30` |
| `{{app_name}}` | string | Nombre de la aplicación | `ActionQ` |
| `{{app_url}}` | string | URL de la aplicación | `https://actionq.example.com` |

### Ejemplo de uso en código:

```typescript
await sendEmailWithTemplate(emailConfig, {
  to: [{ email: 'test@example.com' }],
  templateKey: templates.testEmail,
  mergeInfo: {
    recipient_email: 'test@example.com',
    app_name: 'ActionQ',
    app_url: 'https://actionq.example.com',
    test_date: new Date().toLocaleString('es-ES', { 
      dateStyle: 'full', 
      timeStyle: 'short' 
    })
  }
});
```

---

## 🔑 Plantilla: Restablecimiento de Contraseña

**Archivo:** `password-reset.html`  
**Uso:** Cuando un usuario solicita restablecer su contraseña

### Variables disponibles:

| Variable | Tipo | Descripción | Ejemplo |
|----------|------|-------------|---------|
| `{{user_name}}` | string | Nombre del usuario | `Juan Pérez` |
| `{{reset_url}}` | string | URL para restablecer contraseña | `https://actionq.example.com/reset?token=abc123` |
| `{{expiration_time}}` | string | Tiempo de expiración del enlace | `1 hora` o `24 horas` |
| `{{app_name}}` | string | Nombre de la aplicación | `ActionQ` |
| `{{app_url}}` | string | URL de la aplicación | `https://actionq.example.com` |

### Ejemplo de uso en código:

```typescript
await sendEmailWithTemplate(emailConfig, {
  to: [{ email: user.email, name: user.name }],
  templateKey: templates.passwordReset,
  mergeInfo: {
    user_name: user.name,
    reset_url: `${appUrl}/reset-password?token=${resetToken}`,
    expiration_time: '1 hora',
    app_name: 'ActionQ',
    app_url: appUrl
  }
});
```

---

## 🎫 Plantilla: Notificaciones de Tickets

**Archivo:** `ticket-notification.html`  
**Uso:** Para todas las notificaciones relacionadas con tickets (nuevo ticket, asignación, cambio de estado, nuevo mensaje, etc.)

> ⚠️ **Importante:** Esta plantilla usa solo variables simples sin condicionales. ZeptoMail no soporta `{{#if}}` ni variables en atributos CSS. Si algunas variables están vacías, simplemente mostrarán un espacio en blanco.

### Variables disponibles:

| Variable | Tipo | Descripción | Ejemplo |
|----------|------|-------------|---------|
| `{{user_name}}` | string | Nombre del destinatario | `María García` |
| `{{notification_title}}` | string | Título de la notificación | `Nuevo Ticket Asignado` |
| `{{notification_message}}` | string | Mensaje descriptivo | `Se te ha asignado el siguiente ticket` |
| `{{ticket_id}}` | number | ID del ticket | `42` |
| `{{ticket_title}}` | string | Título del ticket | `Error en el inicio de sesión` |
| `{{ticket_description}}` | string | Descripción del ticket | `No puedo acceder a mi cuenta...` |
| `{{ticket_status}}` | string | Estado actual del ticket | `Abierto`, `En Progreso`, `Cerrado` |
| `{{ticket_url}}` | string | URL directa al ticket | `https://actionq.example.com/tickets/42` |
| `{{tenant_name}}` | string | Nombre de la organización | `Acme Corp` |
| `{{action_by}}` | string | Usuario que realizó la acción | `Pedro López` |
| `{{action_date}}` | string | Fecha de la acción | `1 de febrero de 2026, 14:30` |
| `{{app_name}}` | string | Nombre de la aplicación | `ActionQ` |
| `{{app_url}}` | string | URL de la aplicación | `https://actionq.example.com` |

> 💡 **Nota:** Las variables `action_by` y `action_date` siempre se mostrarán en el email. Asegúrate de proporcionar valores para todas las variables al enviar el email.

### Ejemplo de uso - Nuevo ticket:

```typescript
await sendEmailWithTemplate(emailConfig, {
  to: [{ email: agent.email, name: agent.name }],
  templateKey: templates.ticketNotification,
  mergeInfo: {
    user_name: agent.name,
    notification_title: 'Nuevo Ticket Creado',
    notification_message: 'Se ha creado un nuevo ticket en tu organización.',
    ticket_id: ticket.id,
    ticket_title: ticket.title,
    ticket_description: ticket.description,
    ticket_status: 'Abierto',
    ticket_url: `${appUrl}/tickets/${ticket.id}`,
    tenant_name: tenant.name,
    action_by: creator.name,
    action_date: new Date().toLocaleString('es-ES'),
    app_name: 'ActionQ',
    app_url: appUrl
  }
});
```

### Ejemplo de uso - Ticket asignado:

```typescript
await sendEmailWithTemplate(emailConfig, {
  to: [{ email: assignee.email, name: assignee.name }],
  templateKey: templates.ticketNotification,
  mergeInfo: {
    user_name: assignee.name,
    notification_title: 'Ticket Asignado',
    notification_message: 'Se te ha asignado el siguiente ticket. Por favor revísalo lo antes posible.',
    ticket_id: ticket.id,
    ticket_title: ticket.title,
    ticket_description: ticket.description,
    ticket_status: ticket.status,
    ticket_url: `${appUrl}/tickets/${ticket.id}`,
    tenant_name: tenant.name,
    action_by: assigner.name,
    action_date: new Date().toLocaleString('es-ES'),
    app_name: 'ActionQ',
    app_url: appUrl
  }
});
```

### Ejemplo de uso - Nuevo mensaje:

```typescript
await sendEmailWithTemplate(emailConfig, {
  to: [{ email: recipient.email, name: recipient.name }],
  templateKey: templates.ticketNotification,
  mergeInfo: {
    user_name: recipient.name,
    notification_title: 'Nuevo Mensaje en Ticket',
    notification_message: `${sender.name} ha dejado un mensaje en el ticket #${ticket.id}.`,
    ticket_id: ticket.id,
    ticket_title: ticket.title,
    ticket_description: message.content.substring(0, 200) + '...', // Usar el mensaje en descripción
    ticket_status: ticket.status,
    ticket_url: `${appUrl}/tickets/${ticket.id}`,
    tenant_name: tenant.name,
    action_by: sender.name,
    action_date: new Date().toLocaleString('es-ES'),
    app_name: 'ActionQ',
    app_url: appUrl
  }
});
```

### Ejemplo de uso - Cambio de estado:

```typescript
await sendEmailWithTemplate(emailConfig, {
  to: [{ email: watcher.email, name: watcher.name }],
  templateKey: templates.ticketNotification,
  mergeInfo: {
    user_name: watcher.name,
    notification_title: 'Estado de Ticket Actualizado',
    notification_message: `El ticket ha cambiado de "${oldStatus}" a "${newStatus}".`,
    ticket_id: ticket.id,
    ticket_title: ticket.title,
    ticket_description: ticket.description,
    ticket_status: newStatus,
    ticket_url: `${appUrl}/tickets/${ticket.id}`,
    tenant_name: tenant.name,
    action_by: modifier.name,
    action_date: new Date().toLocaleString('es-ES'),
    app_name: 'ActionQ',
    app_url: appUrl
  }
});
```

---

## 📝 Sintaxis de ZeptoMail

### Variables simples:
```html
{{variable_name}}
```

### ⚠️ Limitaciones Importantes

**ZeptoMail NO soporta:**
- ❌ Condicionales `{{#if}}...{{/if}}`
- ❌ Bucles `{{#each}}...{{/each}}`
- ❌ Variables en atributos CSS (ej: `style="color: {{my_color}}"`)
- ❌ Lógica compleja en templates

**ZeptoMail SÍ soporta:**
- ✅ Variables simples `{{variable_name}}`
- ✅ Variables en texto y contenido HTML
- ✅ Variables en URLs `href="{{my_url}}"`
- ✅ Todas las variables deben tener un valor (no pueden estar vacías)

### Alternativa para contenido condicional:

Si necesitas mostrar diferentes contenidos según el contexto, tienes dos opciones:

1. **Crear múltiples plantillas** (recomendado):
   - `ticket-new.html` - Para nuevos tickets
   - `ticket-assigned.html` - Para asignaciones
   - `ticket-message.html` - Para nuevos mensajes
   - `ticket-status-change.html` - Para cambios de estado

2. **Incluir siempre todas las secciones** y enviar valores vacíos o descriptivos cuando no apliquen:
   ```typescript
   // Si no hay acción específica
   action_by: 'Sistema',
   action_date: new Date().toLocaleString()
   ```

---

## ✨ Buenas Prácticas

### 1. **Variables requeridas vs opcionales**
- Usa `{{variable}}` para variables que **siempre** estarán presentes
- Usa `{{#if variable}}...{{/if}}` para variables **opcionales**

### 2. **Colores según estado/prioridad**

#### Estados de tickets:
- **Abierto**: `bg: #fef3c7`, `text: #92400e`, `border: #f59e0b` (amarillo)
- **En Progreso**: `bg: #dbeafe`, `text: #1e40af`, `border: #3b82f6` (azul)
- **Esperando respuesta**: `bg: #fce7f3`, `text: #9d174d`, `border: #ec4899` (rosa)
- **Cerrado**: `bg: #d1fae5`, `text: #065f46`, `border: #10b981` (verde)

#### Prioridades:
- **Alta**: `🔴 bg: #fee2e2`, `text: #7f1d1d`, `border: #ef4444`
- **Media**: `🟡 bg: #fef3c7`, `text: #92400e`, `border: #f59e0b`
- **Baja**: `🟢 bg: #d1fae5`, `text: #065f46`, `border: #10b981`

### 3. **Estructura HTML consistente**
Todas las plantillas deben mantener:
- Header azul con logo/nombre (`#3b82f6`)
- Contenido principal con fondo blanco
- Footer gris con disclaimer (`#f9fafb`)
- Máximo ancho: `600px`
- Diseño responsive

### 4. **Texto y formato**
- Usa `line-height: 1.6` para legibilidad
- Font-size base: `14px` (párrafos), `16px` (botones), `20px` (títulos)
- Colores principales:
  - Texto oscuro: `#111827`
  - Texto normal: `#374151`
  - Texto secundario: `#6b7280`
  - Enlaces/botones: `#3b82f6`

### 5. **Testing**
Antes de usar una plantilla en producción:
1. Crea la plantilla en ZeptoMail dashboard
2. Obtén el template key
3. Configúralo en `/admin/settings/email-provider`
4. Prueba con datos reales usando el botón de prueba

---

## 🔧 Configuración en ActionQ

### 1. Crear plantillas en ZeptoMail:
1. Ve a https://mail.zoho.com/zm/zeptomail
2. Email Templates → Create Template
3. Copia y pega el HTML de los archivos `.html`
4. Guarda y obtén el **template key**

### 2. Configurar en ActionQ:
1. Ve a **Configuración del Sistema** → **Correos Electrónicos**
2. Habilita correos y selecciona **ZeptoMail**
3. Haz clic en **⚙️ Configurar**
4. Pega los template keys en los campos correspondientes
5. Guarda los cambios

### 3. Uso desde el código:
```typescript
import { sendEmailWithTemplate } from '../services/email.service';
import { getSystemConfig, getZeptoMailTemplates } from '../services/config.service';

const config = await getSystemConfig(db);
const templates = await getZeptoMailTemplates(db);
const emailConfig = getEmailConfig(env);

// Enviar usando plantilla
await sendEmailWithTemplate(emailConfig, {
  to: [{ email: user.email, name: user.name }],
  templateKey: templates.ticketNotification,
  mergeInfo: {
    user_name: user.name,
    notification_title: 'Nuevo Ticket',
    // ... más variables
  }
});
```

---

## 📚 Referencias

- [ZeptoMail Template API](https://www.zoho.com/zeptomail/help/api/email-templates.html)
- [ZeptoMail Merge Variables](https://www.zoho.com/zeptomail/help/merge-tags.html)
- [ActionQ Email Service](../src/services/email.service.ts)
- [ActionQ Config Service](../src/services/config.service.ts)

---

**Última actualización:** 1 de febrero de 2026  
**Versión:** 1.0.0
