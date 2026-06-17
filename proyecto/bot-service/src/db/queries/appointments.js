// db/queries/appointments.js
// createAppointment verifica disponibilidad DENTRO de la transacción y se apoya
// en el constraint EXCLUDE (migración 005) como última barrera anti double-booking.
const { query, withTransaction } = require('../index');
const { tenantDayBoundsUtc } = require('../../utils/timezone');

// Crea una cita con snapshots. Devuelve { ok, appointment } o { ok:false, reason }.
async function createAppointment({ tenantId, clientId, serviceId, employeeId, startsAt, endsAt, timezone, channel = 'whatsapp_text', status = 'confirmed' }) {
  try {
    return await withTransaction(async (client) => {
      // Verificación dentro de la transacción
      const avail = await client.query(
        `SELECT is_slot_available($1,$2,$3,$4,NULL) AS ok`,
        [tenantId, employeeId, startsAt, endsAt]
      );
      if (!avail.rows[0].ok) {
        return { ok: false, reason: 'slot_taken' };
      }

      // Snapshots de servicio y empleada
      const snap = await client.query(
        `SELECT s.name AS sname, s.price, s.duration_min, e.name AS ename
           FROM services s, employees e
          WHERE s.id = $1 AND e.id = $2`,
        [serviceId, employeeId]
      );
      const sn = snap.rows[0] || {};

      const ins = await client.query(
        `INSERT INTO appointments
           (tenant_id, client_id, service_id, employee_id, starts_at, ends_at, status,
            service_name_snapshot, service_price_snapshot, service_duration_min_snapshot,
            employee_name_snapshot, timezone_snapshot, channel_created_from)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [tenantId, clientId, serviceId, employeeId, startsAt, endsAt, status,
         sn.sname || null, sn.price || null, sn.duration_min || null,
         sn.ename || null, timezone || null, channel]
      );

      await client.query(
        `UPDATE clients SET total_bookings = total_bookings + 1 WHERE id = $1`,
        [clientId]
      );

      return { ok: true, appointment: ins.rows[0] };
    });
  } catch (err) {
    // El constraint EXCLUDE lanza 23P01 (exclusion_violation) ante doble reserva concurrente.
    if (err.code === '23P01') {
      return { ok: false, reason: 'slot_taken' };
    }
    throw err;
  }
}

async function getActiveAppointments(tenantId, clientId) {
  const { rows } = await query(
    `SELECT * FROM appointments
      WHERE tenant_id = $1 AND client_id = $2
        AND status IN ('locked','confirmed') AND starts_at > NOW()
      ORDER BY starts_at ASC`,
    [tenantId, clientId]
  );
  return rows;
}

async function cancelAppointment(tenantId, appointmentId, cancelledBy = 'client', reason = null) {
  return withTransaction(async (client) => {
    const upd = await client.query(
      `UPDATE appointments SET status = 'cancelled', updated_at = NOW()
        WHERE tenant_id = $1 AND id = $2 AND status IN ('locked','confirmed')
        RETURNING *`,
      [tenantId, appointmentId]
    );
    if (!upd.rows[0]) return { ok: false, reason: 'not_found' };
    await client.query(
      `INSERT INTO cancellation_log (tenant_id, appointment_id, cancelled_by, reason)
       VALUES ($1,$2,$3,$4)`,
      [tenantId, appointmentId, cancelledBy, reason]
    );
    return { ok: true, appointment: upd.rows[0] };
  });
}

async function rescheduleAppointment({ tenantId, appointmentId, employeeId, startsAt, endsAt }) {
  try {
    return await withTransaction(async (client) => {
      const avail = await client.query(
        `SELECT is_slot_available($1,$2,$3,$4,$5) AS ok`,
        [tenantId, employeeId, startsAt, endsAt, appointmentId]
      );
      if (!avail.rows[0].ok) return { ok: false, reason: 'slot_taken' };

      const upd = await client.query(
        `UPDATE appointments SET starts_at = $3, ends_at = $4, updated_at = NOW()
          WHERE tenant_id = $1 AND id = $2 AND status IN ('locked','confirmed')
          RETURNING *`,
        [tenantId, appointmentId, startsAt, endsAt]
      );
      if (!upd.rows[0]) return { ok: false, reason: 'not_found' };
      return { ok: true, appointment: upd.rows[0] };
    });
  } catch (err) {
    if (err.code === '23P01') return { ok: false, reason: 'slot_taken' };
    throw err;
  }
}

async function markNoShow(tenantId, appointmentId) {
  const { rows } = await query(
    `UPDATE appointments SET status = 'noshow', updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'confirmed'
      RETURNING *`,
    [tenantId, appointmentId]
  );
  return rows[0];
}

// Citas confirmadas de un día (timezone del tenant), límites en UTC.
async function getAppointmentsForDay(tenantId, dateStr, timezone) {
  const { startUtc, endUtc } = tenantDayBoundsUtc(dateStr, timezone);
  const { rows } = await query(
    `SELECT a.*, e.name AS employee_name
       FROM appointments a
       LEFT JOIN employees e ON e.id = a.employee_id
      WHERE a.tenant_id = $1
        AND a.starts_at >= $2 AND a.starts_at < $3
        AND a.status IN ('locked','confirmed','completed')
      ORDER BY a.starts_at ASC`,
    [tenantId, startUtc.toISOString(), endUtc.toISOString()]
  );
  return rows;
}

module.exports = {
  createAppointment, getActiveAppointments, cancelAppointment,
  rescheduleAppointment, markNoShow, getAppointmentsForDay,
};
