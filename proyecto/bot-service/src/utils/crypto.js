// utils/crypto.js — Fase 0A. Cifrado AES-256-GCM para wa_token.
// ENCRYPTION_KEY debe ser 32 bytes en hex (64 caracteres) en el .env.
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY debe ser 32 bytes en hex (64 caracteres).');
  }
  return Buffer.from(hex, 'hex');
}

// Devuelve "iv:authTag:ciphertext" en base64
function encrypt(plain) {
  if (plain == null) return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

function decrypt(payload) {
  if (payload == null) return null;
  const key = getKey();
  const [ivB64, tagB64, ctB64] = String(payload).split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
