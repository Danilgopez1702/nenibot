// api/admin/router.js — Monta todo bajo /api/admin
const express = require('express');
const authRouter = require('./auth');
const { requireOperator } = require('./middleware');
const tenants = require('./tenants');
const costs = require('./costs');
const onboarding = require('./onboarding');

const router = express.Router();

router.use('/', authRouter); // /api/admin/login (público con rate limit)
router.use('/tenants', requireOperator, tenants);
router.use('/costs', requireOperator, costs);
router.use('/onboarding', requireOperator, onboarding);

module.exports = router;
