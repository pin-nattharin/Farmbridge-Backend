const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// POST /api/auth/register
router.post('/register', authController.register);

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/logout
router.post('/logout', [authenticateToken],authController.logout);

// GET /api/auth/profile
router.get('/profile', [authenticateToken], authController.getProfile);

// PUT /api/auth/profile
router.put('/profile', [authenticateToken], authController.updateProfile);


module.exports = router;
