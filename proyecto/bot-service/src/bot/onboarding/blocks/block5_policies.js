// bot/onboarding/blocks/block5_policies.js — Políticas.
module.exports = {
  block: 5,
  title: 'Políticas',
  steps: [
    {
      key: 'cancel_min_hours',
      ask: '📋 *Políticas*\n\n11) ¿Con cuántas *horas mínimas* de anticipación se puede cancelar? (ej. 4)',
      parse: (t) => { const n = parseInt(t.trim(), 10); return isNaN(n) ? { ok: false, error: 'Escribe un número, ej. 4.' } : { ok: true, value: n }; },
    },
    {
      key: 'waitlist_enabled',
      ask: '12) ¿Activar *lista de espera*? (sí/no)',
      parse: (t) => ({ ok: true, value: /^s[ií]/i.test(t.trim()) }),
    },
    {
      key: 'noshow_threshold',
      ask: '13) ¿Tras cuántos *no-shows* se bloquea a un cliente? (ej. 3)',
      parse: (t) => { const n = parseInt(t.trim(), 10); return isNaN(n) ? { ok: false, error: 'Escribe un número, ej. 3.' } : { ok: true, value: n }; },
    },
  ],
};
