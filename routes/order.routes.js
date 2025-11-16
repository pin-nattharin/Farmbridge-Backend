const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/role.middleware');

// Buyer Routes (ฝั่งผู้ซื้อ) 

// POST /api/orders
router.post('/',authenticateToken,checkRole('buyer'),orderController.createOrder);

// GET /api/orders/history/purchase (ดึงประวัติการซื้อของฉัน Buyer)
router.get('/history/purchase',authenticateToken,checkRole('buyer'),orderController.getPurchaseHistory);

// Farmer Routes (ฝั่งเกษตรกร)

// GET /api/orders/history/sales (ดึงประวัติการขายของฉัน Farmer)
router.get('/history/sales',authenticateToken,checkRole('farmer'),orderController.getSalesHistory);

// POST /api/orders/:order_id/confirm (ยืนยันการรับสินค้าของเกษตรกร)
router.post('/:order_id/confirm',authenticateToken,checkRole('farmer'),orderController.confirmPickup);

module.exports = router ;