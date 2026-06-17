// bot/onboarding/activator.js — Persiste la encuesta y activa el tenant.
const { withTransaction } = require('../../db/index');
const { invalidateTenant } = require('../../redis/index');

const DAY_MAP = { weekday: [1, 2, 3, 4, 5], saturday: [6], sunday: [0] };

async function activate(tenant, data) {
  await withTransaction(async (client) => {
    // Bloque 1 — identidad
    await client.query(
      `UPDATE tenants SET business_name = $2, business_type = $3 WHERE id = $1`,
      [tenant.id, data.business_name, data.business_type]
    );
    await client.query(
      `UPDATE tenant_config
          SET bot_name = $2, bot_tone = $3, emoji_level = $4,
              cancel_min_hours = $5, noshow_threshold = $6, waitlist_enabled = $7
        WHERE tenant_id = $1`,
      [tenant.id, data.bot_name, data.bot_tone, data.emoji_level,
       data.cancel_min_hours ?? 4, data.noshow_threshold ?? 3, data.waitlist_enabled ?? true]
    );

    // Bloque 2 — horarios
    const hoursMap = {
      weekday: data.hours_weekday, saturday: data.hours_saturday, sunday: data.hours_sunday,
    };
    for (const [group, val] of Object.entries(hoursMap)) {
      if (!val) continue;
      for (const wd of DAY_MAP[group]) {
        await client.query(
          `INSERT INTO working_hours (tenant_id, weekday, is_open, open_time, close_time)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (tenant_id, weekday)
           DO UPDATE SET is_open = EXCLUDED.is_open, open_time = EXCLUDED.open_time, close_time = EXCLUDED.close_time`,
          [tenant.id, wd, val.is_open, val.is_open ? val.open : null, val.is_open ? val.close : null]
        );
      }
    }

    // Bloque 3 — servicios
    const serviceIds = [];
    for (const [i, s] of (data.services || []).entries()) {
      const r = await client.query(
        `INSERT INTO services (tenant_id, name, duration_min, price, sort_order)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [tenant.id, s.name, s.duration_min, s.price, i]
      );
      serviceIds.push(r.rows[0].id);
    }

    // Bloque 4 — empleadas (cada una ofrece todos los servicios - MVP)
    for (const e of data.employees || []) {
      const er = await client.query(
        `INSERT INTO employees (tenant_id, name) VALUES ($1,$2) RETURNING id`,
        [tenant.id, e.name]
      );
      const empId = er.rows[0].id;
      for (const sid of serviceIds) {
        await client.query(
          `INSERT INTO employee_services (tenant_id, employee_id, service_id)
           VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [tenant.id, empId, sid]
        );
      }
      // Horario de empleada = horario del negocio (default)
      for (let wd = 0; wd <= 6; wd++) {
        await client.query(
          `INSERT INTO employee_schedules (tenant_id, employee_id, weekday, is_working, start_time, end_time)
           SELECT $1, $2, wh.weekday, wh.is_open, wh.open_time, wh.close_time
             FROM working_hours wh WHERE wh.tenant_id = $1 AND wh.weekday = $3
           ON CONFLICT (employee_id, weekday) DO NOTHING`,
          [tenant.id, empId, wd]
        );
      }
    }

    // Bloque 7 — activar
    await client.query(`UPDATE tenants SET active = TRUE WHERE id = $1`, [tenant.id]);
  });

  // Invalidar caché para que el próximo mensaje use el tenant activo
  if (tenant.wa_phone_id) await invalidateTenant(tenant.wa_phone_id);
}

module.exports = { activate };
