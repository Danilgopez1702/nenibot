// bot/onboarding/blocks/block1_identity.js — Identidad del negocio.
module.exports = {
  block: 1,
  title: 'Identidad',
  steps: [
    {
      key: 'business_name',
      ask: '¡Hola! Vamos a configurar tu negocio. 🎉\n\n1) ¿Cuál es el *nombre de tu negocio*?',
      parse: (t) => ({ ok: true, value: t.trim() }),
    },
    {
      key: 'business_type',
      ask: '2) ¿Qué *giro* tiene? (nails / barber / clinic / trainer / spa / beauty / other)',
      parse: (t) => {
        const v = t.trim().toLowerCase();
        const valid = ['nails','barber','clinic','trainer','spa','beauty','other'];
        return valid.includes(v) ? { ok: true, value: v } : { ok: false, error: 'Escribe uno: nails, barber, clinic, trainer, spa, beauty u other.' };
      },
    },
    {
      key: 'bot_name',
      ask: '3) ¿Cómo quieres que se llame tu *asistente*? (ej. "Sofía")',
      parse: (t) => ({ ok: true, value: t.trim() }),
    },
    {
      key: 'bot_tone',
      ask: '4) ¿Qué *tono* prefieres? (formal / informal / neutral)',
      parse: (t) => {
        const v = t.trim().toLowerCase();
        return ['formal','informal','neutral'].includes(v) ? { ok: true, value: v } : { ok: false, error: 'Escribe: formal, informal o neutral.' };
      },
    },
    {
      key: 'emoji_level',
      ask: '5) ¿Nivel de *emojis*? (none / low / moderate / high)',
      parse: (t) => {
        const v = t.trim().toLowerCase();
        return ['none','low','moderate','high'].includes(v) ? { ok: true, value: v } : { ok: false, error: 'Escribe: none, low, moderate o high.' };
      },
    },
  ],
};
