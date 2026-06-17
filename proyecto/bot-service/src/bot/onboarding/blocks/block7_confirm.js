// bot/onboarding/blocks/block7_confirm.js — Resumen + activación.
function buildSummary(data) {
  const services = (data.services || []).map((s) => `  • ${s.name} (${s.duration_min}min, $${s.price})`).join('\n');
  const employees = (data.employees || []).map((e) => `  • ${e.name}`).join('\n');
  return [
    '✅ *Resumen de tu configuración*',
    '',
    `Negocio: ${data.business_name}`,
    `Asistente: ${data.bot_name} (tono ${data.bot_tone}, emojis ${data.emoji_level})`,
    `Cancelación mínima: ${data.cancel_min_hours}h`,
    `Lista de espera: ${data.waitlist_enabled ? 'sí' : 'no'}`,
    '',
    'Servicios:',
    services || '  (ninguno)',
    '',
    'Personal:',
    employees || '  (ninguno)',
    '',
    '¿Todo correcto? Responde *sí* para activar tu asistente. 🚀',
  ].join('\n');
}

module.exports = {
  block: 7,
  title: 'Confirmación',
  buildSummary,
  steps: [
    {
      key: 'confirmed',
      ask: null, // se genera dinámicamente con buildSummary
      parse: (t) => ({ ok: true, value: /^s[ií]/i.test(t.trim()) }),
    },
  ],
};
