// bot/onboarding/blocks/block3_services.js — Servicios.
// Formato por línea: "Nombre, duración_min, precio". Varios servicios separados por salto de línea.
function parseServices(t) {
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  const services = [];
  for (const line of lines) {
    const parts = line.split(',').map((p) => p.trim());
    if (parts.length < 3) return { ok: false, error: 'Cada servicio: "Nombre, duración(min), precio". Ej: "Manicure, 45, 250".' };
    const [name, dur, price] = parts;
    const d = parseInt(dur, 10);
    const p = parseFloat(price);
    if (!name || isNaN(d) || isNaN(p)) return { ok: false, error: 'Revisa el formato: "Nombre, duración(min), precio".' };
    services.push({ name, duration_min: d, price: p });
  }
  if (!services.length) return { ok: false, error: 'Escribe al menos un servicio.' };
  return { ok: true, value: services };
}

module.exports = {
  block: 3,
  title: 'Servicios',
  steps: [
    {
      key: 'services',
      ask: '💅 *Servicios*\n\n9) Escribe tus servicios, uno por línea con formato:\n*Nombre, duración(min), precio*\n\nEjemplo:\nManicure, 45, 250\nUñas acrílicas, 90, 450',
      parse: parseServices,
    },
  ],
};
