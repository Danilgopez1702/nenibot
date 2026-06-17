// bot/onboarding/blocks/block4_employees.js — Personal.
// Formato: nombres separados por coma. Cada empleada ofrecerá todos los servicios (MVP).
function parseEmployees(t) {
  const names = t.split(/[,\n]/).map((n) => n.trim()).filter(Boolean);
  if (!names.length) return { ok: false, error: 'Escribe al menos un nombre.' };
  return { ok: true, value: names.map((name) => ({ name })) };
}

module.exports = {
  block: 4,
  title: 'Personal',
  steps: [
    {
      key: 'employees',
      ask: '👩 *Personal*\n\n10) ¿Quiénes atienden? Escribe los nombres separados por coma.\nEj: "Ana, Brenda, Carla"',
      parse: parseEmployees,
    },
  ],
};
