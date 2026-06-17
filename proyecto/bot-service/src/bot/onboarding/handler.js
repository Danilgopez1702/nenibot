// bot/onboarding/handler.js — Motor del onboarding (7 bloques).
const { query } = require('../../db/index');
const activator = require('./activator');
const logger = require('../../utils/logger');

const BLOCKS = [
  require('./blocks/block1_identity'),
  require('./blocks/block2_hours'),
  require('./blocks/block3_services'),
  require('./blocks/block4_employees'),
  require('./blocks/block5_policies'),
  require('./blocks/block6_templates'),
  require('./blocks/block7_confirm'),
];

async function getSession(tenantId) {
  const { rows } = await query(`SELECT * FROM onboarding_sessions WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
  return rows[0];
}

async function saveSession(tenantId, { block, step, data, status }) {
  await query(
    `UPDATE onboarding_sessions
        SET current_block = $2, current_step = $3, collected_data = $4, status = $5, updated_at = NOW()
      WHERE tenant_id = $1`,
    [tenantId, block, step, JSON.stringify(data), status]
  );
}

function blockByNumber(n) { return BLOCKS.find((b) => b.block === n); }

function askFor(block, step, data) {
  const b = blockByNumber(block);
  if (!b) return null;
  if (block === 7) return b.buildSummary(data);
  const s = b.steps[step - 1];
  return s ? s.ask : null;
}

// Procesa un mensaje del flujo de onboarding. Devuelve el texto a responder.
async function handle(tenant, msg) {
  const text = msg.text || '';
  let session = await getSession(tenant.id);
  if (!session) {
    // No debería pasar (seed_new_tenant lo crea), pero por seguridad:
    await query(
      `INSERT INTO onboarding_sessions (tenant_id, status, current_block, current_step) VALUES ($1,'not_started',1,1)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenant.id]
    );
    session = await getSession(tenant.id);
  }

  let { current_block: block, current_step: step, collected_data: data, status } = session;
  data = data || {};

  // Primer contacto: arrancar encuesta
  if (status === 'not_started') {
    await saveSession(tenant.id, { block: 1, step: 1, data, status: 'in_progress' });
    return askFor(1, 1, data);
  }

  const b = blockByNumber(block);
  const stepDef = b.steps[step - 1];

  // Parsear respuesta del paso actual
  const parsed = stepDef.parse(text);
  if (!parsed.ok) {
    return `${parsed.error}\n\n${askFor(block, step, data)}`;
  }
  data[stepDef.key] = parsed.value;

  // Bloque 7: confirmación final
  if (block === 7) {
    if (parsed.value === true) {
      try {
        await activator.activate(tenant, data);
        await saveSession(tenant.id, { block: 7, step: 1, data, status: 'completed' });
        return '🎉 ¡Tu asistente está activo! Desde ahora atenderá a tus clientes por WhatsApp.\nRevisa tu correo/WhatsApp con los datos de acceso a tu panel.';
      } catch (err) {
        logger.error('Activación de tenant falló', { error: err.message, stack: err.stack });
        return 'Hubo un problema al activar. Intenta responder "sí" de nuevo en un momento.';
      }
    }
    return 'Entendido. Dime qué quieres ajustar o responde "sí" cuando todo esté correcto.';
  }

  // Avanzar paso/bloque
  if (step < b.steps.length) {
    step += 1;
  } else {
    block += 1;
    step = 1;
  }
  await saveSession(tenant.id, { block, step, data, status: 'in_progress' });
  return askFor(block, step, data);
}

module.exports = { handle };
