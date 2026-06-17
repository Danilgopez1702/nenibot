// redis/index.js — Caché de tenant (5min), sesiones con TTL, mutex e idempotencia.
const Redis = require('ioredis');
const logger = require('../utils/logger');

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => logger.error('Redis error', { error: err.message }));
redis.on('connect', () => logger.info('Redis conectado'));

const TENANT_TTL = 300; // 5 min
const SESSION_TTL = parseInt(process.env.SESSION_TTL_SECONDS || '7200', 10);
const LOCK_TTL = 30; // segundos
const IDEMPOTENCY_TTL = 300; // 5 min

// ---- Caché de tenant ----
async function cacheTenant(phoneId, tenant) {
  await redis.set(`tenant:${phoneId}`, JSON.stringify(tenant), 'EX', TENANT_TTL);
}
async function getCachedTenant(phoneId) {
  const raw = await redis.get(`tenant:${phoneId}`);
  return raw ? JSON.parse(raw) : null;
}
async function invalidateTenant(phoneId) {
  await redis.del(`tenant:${phoneId}`);
}

// ---- Sesiones (caché rápida; PostgreSQL es la fuente de verdad) ----
async function setSession(tenantId, phone, session) {
  await redis.set(`session:${tenantId}:${phone}`, JSON.stringify(session), 'EX', SESSION_TTL);
}
async function getSession(tenantId, phone) {
  const raw = await redis.get(`session:${tenantId}:${phone}`);
  return raw ? JSON.parse(raw) : null;
}

// ---- Mutex anti-concurrencia ----
// Devuelve un token si adquiere el lock; null si ya está tomado.
async function acquireLock(key, ttl = LOCK_TTL) {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ok = await redis.set(`lock:${key}`, token, 'NX', 'EX', ttl);
  return ok ? token : null;
}
async function releaseLock(key, token) {
  // Solo libera si el token coincide (evita liberar lock de otro proceso)
  const lua = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
  return redis.eval(lua, 1, `lock:${key}`, token);
}

// ---- Idempotencia de acciones críticas (Fase 0B) ----
// Guarda el resultado de una acción. Si la key existe, devuelve el resultado previo.
async function checkIdempotency(key) {
  const raw = await redis.get(`idem:${key}`);
  return raw ? JSON.parse(raw) : null;
}
async function saveIdempotency(key, result) {
  await redis.set(`idem:${key}`, JSON.stringify(result), 'EX', IDEMPOTENCY_TTL);
}

module.exports = {
  redis,
  cacheTenant, getCachedTenant, invalidateTenant,
  setSession, getSession,
  acquireLock, releaseLock,
  checkIdempotency, saveIdempotency,
};
