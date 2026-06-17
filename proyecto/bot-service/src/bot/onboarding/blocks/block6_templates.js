// bot/onboarding/blocks/block6_templates.js — Mensajes (templates).
module.exports = {
  block: 6,
  title: 'Mensajes',
  steps: [
    {
      key: 'use_default_templates',
      ask: '💬 *Mensajes*\n\n14) ¿Usar los *mensajes por defecto* del asistente? (sí/no)\nSiempre podrás personalizarlos después en tu panel.',
      parse: (t) => ({ ok: true, value: /^s[ií]/i.test(t.trim()) }),
    },
  ],
};
