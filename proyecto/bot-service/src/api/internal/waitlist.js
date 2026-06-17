// api/internal/waitlist.js — Expira ofertas de waitlist sin respuesta.
const { expireWaitlist } = require('../../db/queries/waitlist');
const logger = require('../../utils/logger');

async function expireWaitlistOffers() {
  const expired = await expireWaitlist();
  logger.info('Ofertas de waitlist expiradas', { count: expired.length });
  return { expired: expired.length };
}

module.exports = { expireWaitlistOffers };
