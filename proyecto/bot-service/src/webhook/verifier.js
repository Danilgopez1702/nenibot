// webhook/verifier.js — Verificación HMAC-SHA256 de la firma de Meta.
const crypto = require('crypto');

// Compara la firma X-Hub-Signature-256 con el HMAC del rawBody usando META_APP_SECRET.
function verifySignature(rawBody, signatureHeader) {
  if (!signatureHeader || !rawBody) return false;
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Verificación del challenge GET (suscripción del webhook)
function verifyChallenge(query) {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return challenge;
  }
  return null;
}

module.exports = { verifySignature, verifyChallenge };
