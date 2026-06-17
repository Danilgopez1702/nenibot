// bot/onboarding/blocks/block2_hours.js — Horarios.
function parseRange(t) {
  // formato "09:00-18:00" o "cerrado"
  const v = t.trim().toLowerCase();
  if (v === 'cerrado' || v === 'no') return { ok: true, value: { is_open: false } };
  const m = v.match(/^(\d{1,2}:\d{2})\s*[-a ]+\s*(\d{1,2}:\d{2})$/);
  if (!m) return { ok: false, error: 'Formato: "09:00-18:00" o "cerrado".' };
  return { ok: true, value: { is_open: true, open: m[1], close: m[2] } };
}

module.exports = {
  block: 2,
  title: 'Horarios',
  steps: [
    { key: 'hours_weekday', ask: '📅 *Horarios*\n\n6) ¿Horario de *lunes a viernes*? (ej. "09:00-18:00")', parse: parseRange },
    { key: 'hours_saturday', ask: '7) ¿Horario del *sábado*? (ej. "10:00-15:00" o "cerrado")', parse: parseRange },
    { key: 'hours_sunday', ask: '8) ¿Horario del *domingo*? (ej. "10:00-14:00" o "cerrado")', parse: parseRange },
  ],
};
