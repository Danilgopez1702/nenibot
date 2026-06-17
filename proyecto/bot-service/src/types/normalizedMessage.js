// types/normalizedMessage.js — Fase 0B
// Contrato de entrada único al core del bot (Regla de oro #4).
const { z } = require('zod');

const NormalizedInboundMessageSchema = z.object({
  tenantId: z.string().uuid(),
  channel: z.enum(['whatsapp_text', 'whatsapp_audio', 'phone_call', 'client_panel']),
  externalConversationId: z.string(),
  externalMessageId: z.string(),
  clientPhone: z.string(),
  normalizedText: z.string().min(1),
  originalType: z.enum(['text', 'audio', 'voice_turn']),
  language: z.string().default('es-MX'),
  timestamp: z.string().datetime(),
  metadata: z
    .object({
      mediaId: z.string().optional(),
      transcriptionId: z.string().optional(),
      contactName: z.string().nullable().optional(),
    })
    .optional(),
});

// Adapta el payload de Meta (texto) al contrato normalizado.
function createWhatsAppTextAdapter(parsedMsg, tenant) {
  const tsIso = parsedMsg.timestamp
    ? new Date(parseInt(parsedMsg.timestamp, 10) * 1000).toISOString()
    : new Date().toISOString();

  const candidate = {
    tenantId: tenant.id,
    channel: 'whatsapp_text',
    externalConversationId: parsedMsg.from,
    externalMessageId: parsedMsg.externalMessageId,
    clientPhone: parsedMsg.from,
    normalizedText: (parsedMsg.text || '').trim(),
    originalType: 'text',
    language: tenant.config?.language || 'es-MX',
    timestamp: tsIso,
    metadata: { contactName: parsedMsg.contactName || null },
  };

  return NormalizedInboundMessageSchema.parse(candidate);
}

module.exports = { NormalizedInboundMessageSchema, createWhatsAppTextAdapter };
