// scripts/lib/provisioning.js — Paso 0C.7
// Máquina de estados del onboarding técnico. Idempotente y reanudable.
// Estados: draft -> db_created -> meta_configured -> onboarding_sent
//          -> business_configured -> active -> failed
//
// El script cubre hasta `onboarding_sent`. Las transiciones `business_configured`
// y `active` ocurren cuando la dueña completa la encuesta vía el bot.
const db = require('./db');
const metaApi = require('./metaApi');
const whatsapp = require('./whatsapp');
const { generateTemporaryPassword, hashPassword } = require('./password');

const ORDER = ['draft', 'db_created', 'meta_configured', 'onboarding_sent', 'business_configured', 'active'];
function reached(state, target) { return ORDER.indexOf(state) >= ORDER.indexOf(target); }

// data: { slug, businessName, businessType, waNumber, waPhoneId, waToken, botName }
// log: función para imprimir progreso
async function run(data, log = () => {}) {
  const existing = await db.getTenantByPhoneId(data.waPhoneId);
  let state = existing?.provisioning_state || 'draft';
  let tenantId = existing?.id || null;
  let tempPassword = null;

  if (existing) log(`↻ Tenant existente detectado (estado: ${state}). Reanudando…`);

  try {
    // 1) draft -> db_created
    if (!reached(state, 'db_created')) {
      log('① Creando tenant en base de datos…');
      tenantId = await db.createTenant({
        slug: data.slug, businessName: data.businessName, businessType: data.businessType,
        waPhoneId: data.waPhoneId, waPhoneNumber: data.waNumber,
      });
      log('   • seed_new_tenant (config, features, horarios, 25 templates)…');
      await db.seedTenant(tenantId);

      tempPassword = generateTemporaryPassword();
      const hash = await hashPassword(tempPassword);
      await db.setPanelPassword(tenantId, hash);

      log('   • Guardando integración con wa_token cifrado (AES-256-GCM)…');
      await db.createIntegration(tenantId, { waPhoneId: data.waPhoneId, waToken: data.waToken, state: 'db_created' });
      state = 'db_created';
      log('   ✓ db_created');
    }

    // 2) db_created -> meta_configured (verificar token + suscribir webhook)
    if (!reached(state, 'meta_configured')) {
      log('② Verificando token con Meta Graph API…');
      const v = await metaApi.verifyToken(data.waPhoneId, data.waToken);
      if (!v.ok) throw new Error(`Token de Meta inválido: ${v.error}`);
      if (v.info?.display_phone_number) log(`   • Número verificado: ${v.info.display_phone_number}`);

      log('   • Suscribiendo el número al webhook de la app…');
      const s = await metaApi.subscribeWebhook(data.waPhoneId, data.waToken);
      if (!s.ok) throw new Error(`No se pudo suscribir el webhook: ${s.error}`);
      if (s.already) log('   • (el número ya estaba suscrito)');

      await db.setWebhookSubscribed(tenantId, true);
      await db.updateProvisioningState(tenantId, 'meta_configured');
      state = 'meta_configured';
      log('   ✓ meta_configured');
    }

    // 3) meta_configured -> onboarding_sent (primer mensaje)
    if (!reached(state, 'onboarding_sent')) {
      log('③ Enviando primer mensaje de configuración por WhatsApp…');
      const m = await whatsapp.sendFirstOnboardingMessage(
        data.waPhoneId, data.waNumber, data.botName, data.waToken
      );
      if (!m.ok) throw new Error(`No se pudo enviar el primer mensaje: ${m.error}`);
      await db.updateProvisioningState(tenantId, 'onboarding_sent');
      state = 'onboarding_sent';
      log('   ✓ onboarding_sent');
    }

    log('✔ Provisioning técnico completo. Esperando que la dueña complete la encuesta.');
    return { tenantId, tempPassword, finalState: state };
  } catch (err) {
    if (tenantId) await db.updateProvisioningState(tenantId, 'failed', String(err.message).slice(0, 500));
    throw err;
  }
}

module.exports = { run, ORDER };
