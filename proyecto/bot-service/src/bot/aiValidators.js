// bot/aiValidators.js — Fase 0B
// Validan los outputs estructurados de Claude antes de tocar la DB.
// Regla: si Zod falla, NO lanzar excepción al usuario — pedir clarificación
// y loguear el error.
const { z } = require('zod');
const logger = require('../utils/logger');

const ParsedDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  confidence: z.number().min(0).max(1),
  needs_clarification: z.boolean(),
});

const ParsedIntentSchema = z.object({
  intent: z.enum(['book', 'cancel', 'reschedule', 'consult', 'confirm', 'deny', 'select', 'unknown']),
  confidence: z.number().min(0).max(1),
  extracted_data: z.record(z.unknown()).optional(),
});

// safeValidate(schema, data, context) -> { ok, data } | { ok:false, error }
function safeValidate(schema, data, context = {}) {
  const result = schema.safeParse(data);
  if (!result.success) {
    logger.warn('Validación Zod de output de IA falló', {
      context,
      input: data,
      error: result.error.flatten(),
    });
    return { ok: false, error: result.error };
  }
  return { ok: true, data: result.data };
}

module.exports = { ParsedDateSchema, ParsedIntentSchema, safeValidate };
