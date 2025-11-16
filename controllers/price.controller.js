const priceData = require('../utils/priceData');

// สำหรับเกษตรกร
exports.getSellerPriceInfo = (req, res) => {
  const { productName } = req.params;

  const product = priceData.find(p => p.product_name === productName);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  res.json({
    product_name: product.product_name,
    lheng_low_grade: product.lheng_low_grade,        // ราคาล้ง
    platform_suggest: product.platform_suggest,      // ราคาที่แนะนำในแอป
    retail_market: product.retail_market,            // ราคาตลาดปกติ
    unit: product.unit,
    last_updated: product.last_updated
  });
};

// สำหรับผู้ซื้อ
exports.getBuyerPriceInfo = (req, res) => {
  const { productName } = req.params;

  const product = priceData.find(p => p.product_name === productName);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  res.json({
    product_name: product.product_name,
    platform_suggest: product.platform_suggest,      // ราคาที่แนะนำในแอป
    retail_market: product.retail_market,            // ราคาตลาดปกติ
    unit: product.unit,
    last_updated: product.last_updated
  });
};
