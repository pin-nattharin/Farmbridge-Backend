const express = require('express');
const router = express.Router();
const priceController = require('../controllers/price.controller');

router.get('/seller/:productName', priceController.getSellerPriceInfo);
router.get('/buyer/:productName', priceController.getBuyerPriceInfo);

module.exports = router;
