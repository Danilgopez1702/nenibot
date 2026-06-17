// scripts/lib/env.js — Paso 0C.1
// Carga y valida las variables de entorno requeridas por el script.
// Lanza un error descriptivo si falta alguna ANTES de iniciar el CLI.
require('dotenv').config();

const REQUIRED = [
  'DATABASE_URL',
  'ANTHROPIC_API_KEY',
  'META_APP_SECRET',
  'META_VERIFY_TOKEN',
  'DOMAIN',
  'ENCRYPTION_KEY',
];

function loadEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k] || String(process.env[k]).trim() === '');
  if (missing.length) {
    throw new Error(
      `Faltan variables de entorno requeridas en .env:\n  - ${missing.join('\n  - ')}\n` +
      `Genera ENCRYPTION_KEY con: openssl rand -hex 32`
    );
  }
  if (process.env.ENCRYPTION_KEY.length !== 64) {
    throw new Error('ENCRYPTION_KEY debe ser 32 bytes en hex (64 caracteres). Usa: openssl rand -hex 32');
  }
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    META_APP_SECRET: process.env.META_APP_SECRET,
    META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN,
    META_GRAPH_VERSION: process.env.META_GRAPH_VERSION || 'v19.0',
    DOMAIN: process.env.DOMAIN,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  };
}

module.exports = { loadEnv, REQUIRED };
