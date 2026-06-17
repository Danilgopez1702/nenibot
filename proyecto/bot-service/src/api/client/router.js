// api/client/router.js — Monta todo bajo /api/client
const express = require('express');
const authRouter = require('./auth');
const { requireClient } = require('./middleware');
const appointments = require('./appointments');
const clients = require('./clients');
const config = require('./config');
const stats = require('./stats');

const router = express.Router();

router.use('/', authRouter); // /api/client/login (público con rate limit)
router.use('/appointments', requireClient, appointments);
router.use('/clients', requireClient, clients);
router.use('/config', requireClient, config);
router.use('/stats', requireClient, stats);

module.exports = router;
