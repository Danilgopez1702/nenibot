// db/queries/catalog.js — servicios y empleadas activos.
const { query } = require('../index');

async function getServices(tenantId) {
  const { rows } = await query(
    `SELECT * FROM services WHERE tenant_id = $1 AND active = TRUE ORDER BY sort_order, name`,
    [tenantId]
  );
  return rows;
}

async function getEmployeesForService(tenantId, serviceId) {
  const { rows } = await query(
    `SELECT e.* FROM employees e
       JOIN employee_services es ON es.employee_id = e.id
      WHERE e.tenant_id = $1 AND es.service_id = $2 AND e.active = TRUE
      ORDER BY e.name`,
    [tenantId, serviceId]
  );
  return rows;
}

async function getServiceById(tenantId, serviceId) {
  const { rows } = await query(
    `SELECT * FROM services WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [tenantId, serviceId]
  );
  return rows[0] || null;
}

async function getTemplate(tenantId, key) {
  const { rows } = await query(
    `SELECT instruction FROM bot_instruction_templates WHERE tenant_id = $1 AND template_key = $2 LIMIT 1`,
    [tenantId, key]
  );
  return rows[0]?.instruction || null;
}

module.exports = { getServices, getEmployeesForService, getServiceById, getTemplate };
