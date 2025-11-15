// controllers/dashboard.controller.js
const db = require('../models');
const { Op, Sequelize } = require('sequelize');
const Listings = db.Listings;
const Transactions = db.Transactions;
const PriceHistory = db.PriceHistory;

exports.getImpactDashboard = async (req, res) => {
  try {
    const farmer_id = req.identity.id;

    // 1. ดึง transactions ที่สำเร็จแล้ว
    const transactions = await Transactions.findAll({
      where: {
        seller_id: farmer_id,
        payment_status: 'verified'
      }
    });

    // 2. คำนวณ total revenue
    const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.total_amount), 0);
    const totalTransactions = transactions.length;

    // 3. placeholder: เปรียบเทียบราคาขายให้พ่อค้าคนกลาง
    const revenueFromMiddlemen = totalRevenue * 0.7; // สมมติ 70% ของราคา
    const increasePercent = revenueFromMiddlemen > 0 ? ((totalRevenue - revenueFromMiddlemen)/revenueFromMiddlemen*100).toFixed(2) : null;

    // 4. ราคาตลาดล่าสุดของสินค้าที่ขายได้
    const soldProducts = [...new Set(transactions.map(t => t.product_name))];

    const priceData = {};
    for (const product of soldProducts) {
      const prices = await PriceHistory.findAll({
        where: { product_name: product },
        order: [['record_date', 'ASC']]
      });

      priceData[product] = prices.map(p => ({
        date: p.record_date,
        avg: Number(p.average_price),
        min: Number(p.min_price),
        max: Number(p.max_price)
      }));
    }

    res.json({
      metrics: {
        totalRevenue,
        totalTransactions,
        revenueFromMiddlemen,
        increasePercent
      },
      priceTrends: priceData
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch dashboard', error: err.message });
  }
};
