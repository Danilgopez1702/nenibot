// scripts/onboard.js — Paso 0C.8
// CLI interactivo para dar de alta un cliente nuevo. Usa readline nativo.
//
// Uso:
//   node onboard.js
//   (dentro del contenedor bot-service o con DATABASE_URL apuntando a Postgres)
const readline = require('readline');
const { loadEnv } = require('./lib/env');
const validators = require('./lib/validators');
const provisioning = require('./lib/provisioning');
const { printCredentials } = require('./lib/password');
const db = require('./lib/db');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

// Cola de líneas: robusta tanto en TTY como con entrada por pipe.
const _lines = [];
const _waiters = [];
let _closed = false;
rl.on('line', (line) => {
  if (_waiters.length) _waiters.shift()(line);
  else _lines.push(line);
});
rl.on('close', () => { _closed = true; _waiters.forEach((w) => w(null)); });

function nextLine() {
  if (_lines.length) return Promise.resolve(_lines.shift());
  if (_closed) return Promise.resolve(null);
  return new Promise((res) => _waiters.push(res));
}

// Pregunta hasta que el validador devuelva ok.
async function ask(prompt, validate) {
  while (true) {
    process.stdout.write(prompt);
    const raw = await nextLine();
    if (raw === null) { console.error('\n❌ Entrada interrumpida.'); rl.close(); await db.close(); process.exit(1); }
    const r = validate ? validate(raw) : { ok: true, value: raw.trim() };
    if (r.ok) return r.value;
    console.log(`   ⚠ ${r.error}`);
  }
}

async function main() {
  // Validar entorno antes de iniciar
  let env;
  try {
    env = loadEnv();
  } catch (err) {
    console.error(`\n❌ ${err.message}\n`);
    process.exit(1);
  }

  console.log('\n' + '═'.repeat(56));
  console.log('  ALTA DE CLIENTE NUEVO — Onboarding técnico');
  console.log('═'.repeat(56) + '\n');

  const businessName = await ask('Nombre del negocio: ', (v) => validators.validateNonEmpty(v, 'Nombre'));
  const slug         = await ask('Slug (subdominio, ej: salon-anais): ', validators.validateSlug);
  const botName      = await ask('Nombre del asistente (ej: Sofía): ', (v) => validators.validateNonEmpty(v, 'Nombre del bot'));
  const waNumber     = await ask('Número de WhatsApp del negocio (+5215512345678): ', validators.validateWhatsAppNumber);
  const waPhoneId    = await ask('wa_phone_id (phone_number_id de Meta): ', validators.validatePhoneId);
  const waToken      = await ask('wa_token (token permanente del número): ', validators.validateToken);

  // Reanudación si ya existe
  const existing = await validators.findExistingTenant(waPhoneId);
  if (existing) {
    console.log(`\n↻ Ya existe un tenant con ese número (estado: ${existing.provisioning_state || 'desconocido'}).`);
    const cont = await ask('¿Reanudar el provisioning? (sí/no): ', (v) => ({ ok: true, value: /^s/i.test(v.trim()) }));
    if (!cont) { console.log('Cancelado.'); rl.close(); await db.close(); return; }
  }

  // Resumen + confirmación
  console.log('\n' + '─'.repeat(56));
  console.log(`  Negocio:    ${businessName}`);
  console.log(`  Slug:       ${slug}`);
  console.log(`  Asistente:  ${botName}`);
  console.log(`  WhatsApp:   ${waNumber}`);
  console.log(`  Phone ID:   ${waPhoneId}`);
  console.log('─'.repeat(56));
  const confirm = await ask('¿Confirmas el alta? (sí/no): ', (v) => ({ ok: true, value: /^s/i.test(v.trim()) }));
  if (!confirm) { console.log('Cancelado.'); rl.close(); await db.close(); return; }

  console.log('');
  try {
    const result = await provisioning.run(
      { slug, businessName, businessType: 'other', waNumber, waPhoneId, waToken, botName },
      (msg) => console.log(msg)
    );

    const panelUrl = `https://${env.DOMAIN}/cliente/`;
    if (result.tempPassword) {
      printCredentials(panelUrl, result.tempPassword, { phoneId: waPhoneId, slug });
    } else {
      console.log('\n  (Tenant reanudado: la contraseña del panel se generó en el alta original.)');
      console.log(`  Panel cliente: ${panelUrl}  ·  Usuario: ${waPhoneId}\n`);
    }
  } catch (err) {
    console.error(`\n❌ Provisioning falló: ${err.message}`);
    console.error('   El estado quedó en "failed". Vuelve a ejecutar el script con el mismo número para reintentar.\n');
    process.exitCode = 1;
  } finally {
    rl.close();
    await db.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
