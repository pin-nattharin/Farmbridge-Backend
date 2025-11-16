// routes/notification.routes.js

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// 💡 เพิ่ม Route ใหม่สำหรับรับ Expo Token
// POST /api/notifications/update-expo-token
router.post('/update-expo-token', [authenticateToken], notificationController.updateExpoToken);

module.exports = router;