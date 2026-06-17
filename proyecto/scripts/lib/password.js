// scripts/lib/password.js — Paso 0C.3
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// 12 chars alfanuméricos legibles (sin caracteres ambiguos: 0/O, 1/l/I).
function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

function printCredentials(url, password, extra = {}) {
  const line = '─'.repeat(56);
  console.log('\n' + line);
  console.log('  ✅ CLIENTE DADO DE ALTA');
  console.log(line);
  console.log(`  Panel cliente:     ${url}`);
  if (extra.phoneId)   console.log(`  ID de WhatsApp:    ${extra.phoneId}  (usuario del panel)`);
  console.log(`  Contraseña temp.:  ${password}`);
  if (extra.slug)      console.log(`  Slug / subdominio: ${extra.slug}`);
  console.log(line);
  console.log('  Comparte estos datos con la dueña del negocio.');
  console.log('  El asistente ya envió el primer mensaje de configuración.');
  console.log(line + '\n');
}

module.exports = { generateTemporaryPassword, hashPassword, printCredentials };
