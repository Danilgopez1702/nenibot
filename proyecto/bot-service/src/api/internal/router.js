// api/internal/router.js — Endpoints disparados por n8n.
const express = require('express');
const { requireInternal } = require('./middleware');
const { sendReminders } = require('./reminders');
const { detectNoShows } = require('./noshow');
const { expireWaitlistOffers } = require('./waitlist');
const { recalcStats } = require('./stats');
const { expireLockedAppointments } = require('../../db/queries/appointments');

const router = express.Router();
router.use(requireInternal);

function wrap(fn) {
  return async (req, res) => {
    try { res.json(await fn(req)); }
    catch (err) { res.status(500).json({ error: err.message }); }
  };
}

router.post('/reminders/24h', wrap(() => sendReminders('reminder_24h')));
router.post('/reminders/2h', wrap(() => sendReminders('reminder_2h')));
router.post('/noshows', wrap(() => detectNoShows()));
router.post('/waitlist/expire', wrap(() => expireWaitlistOffers()));
router.post('/appointments/expire-locks', wrap(() => expireLockedAppointments()));
router.post('/analytics', wrap(() => recalcStats()));

module.exports = router;
