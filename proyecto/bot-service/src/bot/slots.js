// bot/slots.js — Disponibilidad y parsing de fechas en lenguaje natural (Node.js).
const { query } = require('../db/index');
const { tenantDayBoundsUtc, todayInTenantTz } = require('../utils/timezone');

const WEEKDAYS = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, 'miércoles': 3,
  jueves: 4, viernes: 5, sabado: 6, 'sábado': 6,
};
const MONTHS = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function pad(n) { return String(n).padStart(2, '0'); }
function toDateStr(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

// Interpreta texto -> 'YYYY-MM-DD' o null. Usa timezone del tenant para "hoy".
function parseDateFromText(text, timezone) {
  const t = (text || '').toLowerCase().trim();
  const todayStr = todayInTenantTz(timezone);
  const [ty, tm, td] = todayStr.split('-').map((n) => parseInt(n, 10));
  const today = new Date(Date.UTC(ty, tm - 1, td));

  if (/\bhoy\b/.test(t)) return todayStr;
  if (/\bma[ñn]ana\b/.test(t)) {
    const d = new Date(today); d.setUTCDate(d.getUTCDate() + 1);
    return toDateStr(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  if (/\bpasado ma[ñn]ana\b/.test(t)) {
    const d = new Date(today); d.setUTCDate(d.getUTCDate() + 2);
    return toDateStr(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  // "el 20 de junio" / "20 de junio" / "el 20"
  const dm = t.match(/\b(\d{1,2})\s+de\s+([a-záéíóú]+)/i);
  if (dm) {
    const day = parseInt(dm[1], 10);
    const mon = MONTHS[dm[2]];
    if (mon) {
      let year = ty;
      if (mon < tm || (mon === tm && day < td)) year += 1; // próxima ocurrencia
      return toDateStr(year, mon, day);
    }
  }

  // Día de la semana: "el sábado", "este viernes"
  for (const [name, wd] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(t)) {
      const d = new Date(today);
      let diff = (wd - d.getUTCDay() + 7) % 7;
      if (diff === 0) diff = 7; // próximo, no hoy
      d.setUTCDate(d.getUTCDate() + diff);
      return toDateStr(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
  }

  // "20/06" o "20-06"
  const num = t.match(/\b(\d{1,2})[\/\-](\d{1,2})\b/);
  if (num) {
    const day = parseInt(num[1], 10);
    const mon = parseInt(num[2], 10);
    let year = ty;
    if (mon < tm || (mon === tm && day < td)) year += 1;
    return toDateStr(year, mon, day);
  }

  return null;
}

function minutesToTime(min) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}
function timeToMinutes(t) {
  const [h, m] = t.split(':').map((n) => parseInt(n, 10));
  return h * 60 + m;
}

// Calcula slots libres para un empleado en una fecha.
// Devuelve [{ time:'HH:MM', startsAt:ISO, endsAt:ISO }]
async function getAvailableSlots(tenant, employeeId, durationMin, dateStr) {
  const tz = tenant.config.timezone;
  const weekday = new Date(`${dateStr}T12:00:00Z`).getUTCDay();

  // Horario del empleado (si existe) o del negocio
  const sched = await query(
    `SELECT es.is_working, es.start_time, es.end_time, es.break_start, es.break_end,
            wh.is_open, wh.open_time, wh.close_time, wh.break_start AS wh_bs, wh.break_end AS wh_be
       FROM working_hours wh
       LEFT JOIN employee_schedules es ON es.employee_id = $2 AND es.weekday = wh.weekday
      WHERE wh.tenant_id = $1 AND wh.weekday = $3`,
    [tenant.id, employeeId, weekday]
  );
  const row = sched.rows[0];
  if (!row || !row.is_open) return [];
  if (row.is_working === false) return [];

  const openT = row.start_time || row.open_time;
  const closeT = row.end_time || row.close_time;
  if (!openT || !closeT) return [];

  const breakStart = row.break_start || row.wh_bs;
  const breakEnd = row.break_end || row.wh_be;

  const granularity = tenant.config.slot_granularity_min || 30;
  const openMin = timeToMinutes(openT);
  const closeMin = timeToMinutes(closeT);
  const bsMin = breakStart ? timeToMinutes(breakStart) : null;
  const beMin = breakEnd ? timeToMinutes(breakEnd) : null;

  // Citas existentes del día
  const { startUtc, endUtc } = tenantDayBoundsUtc(dateStr, tz);
  const appts = await query(
    `SELECT starts_at, ends_at FROM appointments
      WHERE tenant_id = $1 AND employee_id = $2
        AND starts_at >= $3 AND starts_at < $4
        AND status IN ('locked','confirmed')`,
    [tenant.id, employeeId, startUtc.toISOString(), endUtc.toISOString()]
  );
  const busy = appts.rows.map((a) => ({
    s: new Date(a.starts_at).getTime(), e: new Date(a.ends_at).getTime(),
  }));

  const slots = [];
  const nowMs = Date.now();
  for (let m = openMin; m + durationMin <= closeMin; m += granularity) {
    // Saltar descanso
    if (bsMin !== null && beMin !== null && m < beMin && (m + durationMin) > bsMin) continue;

    const time = minutesToTime(m);
    // start UTC = inicio del día UTC + minutos locales (ya offset incluido en startUtc)
    const slotStart = new Date(startUtc.getTime() + m * 60000);
    const slotEnd = new Date(slotStart.getTime() + durationMin * 60000);
    if (slotStart.getTime() <= nowMs) continue; // no ofrecer pasado

    const overlap = busy.some((b) => slotStart.getTime() < b.e && slotEnd.getTime() > b.s);
    if (overlap) continue;

    slots.push({ time, startsAt: slotStart.toISOString(), endsAt: slotEnd.toISOString() });
  }
  return slots;
}

function formatSlotsForMenu(slots) {
  return slots.map((s, i) => `${i + 1}. ${s.time}`).join('\n');
}

module.exports = { parseDateFromText, getAvailableSlots, formatSlotsForMenu, minutesToTime, timeToMinutes };
