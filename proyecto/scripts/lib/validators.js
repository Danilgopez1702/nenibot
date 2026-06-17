// scripts/lib/validators.js — Paso 0C.4
const db = require('./db');

// Número de WhatsApp en formato internacional: +52 seguido de 10 dígitos (México),
// o E.164 genérico (+ y 8–15 dígitos).
function validateWhatsAppNumber(value) {
  const v = String(value || '').trim();
  if (/^\+\d{8,15}$/.test(v)) return { ok: true, value: v };
  return { ok: false, error: 'Formato inválido. Usa formato internacional, ej: +5215512345678' };
}

// wa_phone_id (phone_number_id de Meta): solo dígitos.
function validatePhoneId(value) {
  const v = String(value || '').trim();
  if (/^\d{6,}$/.test(v)) return { ok: true, value: v };
  return { ok: false, error: 'El phone_number_id debe ser numérico (solo dígitos).' };
}

// Slug alfanumérico (minúsculas, números y guiones), sin espacios. Se usa para subdominio.
function validateSlug(value) {
  const v = String(value || '').trim().toLowerCase();
  if (/^[a-z0-9]([a-z0-9-]{1,40})[a-z0-9]$/.test(v)) return { ok: true, value: v };
  return { ok: false, error: 'Slug inválido. Usa minúsculas, números y guiones (ej: salon-anaís -> salon-anais).' };
}

function validateNonEmpty(value, label = 'Valor') {
  const v = String(value || '').trim();
  if (v.length >= 2) return { ok: true, value: v };
  return { ok: false, error: `${label} no puede estar vacío.` };
}

function validateToken(value) {
  const v = String(value || '').trim();
  if (v.length >= 20) return { ok: true, value: v };
  return { ok: false, error: 'El wa_token parece demasiado corto.' };
}

// Verifica si ya existe un tenant con ese wa_phone_id (para reanudar, no para bloquear).
async function findExistingTenant(waPhoneId) {
  return db.getTenantByPhoneId(waPhoneId);
}

module.exports = {
  validateWhatsAppNumber, validatePhoneId, validateSlug,
  validateNonEmpty, validateToken, findExistingTenant,
};
