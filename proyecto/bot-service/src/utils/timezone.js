// utils/timezone.js — Fase 0A
// UTC en DB, timezone del tenant en presentación.
// Calcula límites de día del tenant en UTC para queries seguras.

// Offset (en minutos) de una zona horaria en una fecha dada.
function tzOffsetMinutes(timeZone, date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value; return acc;
  }, {});
  const asUTC = Date.UTC(
    parseInt(parts.year, 10), parseInt(parts.month, 10) - 1, parseInt(parts.day, 10),
    parseInt(parts.hour, 10), parseInt(parts.minute, 10), parseInt(parts.second, 10)
  );
  return (asUTC - date.getTime()) / 60000;
}

// Dado 'YYYY-MM-DD' y timezone, devuelve { startUtc, endUtc } como Date (UTC).
function tenantDayBoundsUtc(dateStr, timeZone) {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  // Medianoche local aproximada en UTC
  const approxStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const offStart = tzOffsetMinutes(timeZone, approxStart);
  const startUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) + offStart * 60000);

  const approxEnd = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
  const offEnd = tzOffsetMinutes(timeZone, approxEnd);
  const endUtc = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0) + offEnd * 60000);

  return { startUtc, endUtc };
}

// Fecha 'YYYY-MM-DD' de "hoy" en la timezone del tenant.
function todayInTenantTz(timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(new Date()); // en-CA => YYYY-MM-DD
}

// Formatea una fecha UTC a hora local legible del tenant.
function formatInTenantTz(date, timeZone) {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone, weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(date);
}

module.exports = { tzOffsetMinutes, tenantDayBoundsUtc, todayInTenantTz, formatInTenantTz };
