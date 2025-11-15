// routes/dashboard.routes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/role.middleware');
const dashboardController = require('../controllers/dashboard.controller');

// แดชบอร์ดเฉพาะเกษตรกร
router.get('/', authenticateToken, checkRole('farmer'), dashboardController.getImpactDashboard);

module.exports = router;
