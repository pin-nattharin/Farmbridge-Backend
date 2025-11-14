const db = require('../models');
const Demands = db.Demands;
const Listings = db.Listings;
const Farmers = db.Farmers;
const Notifications = db.Notifications;
const { Op } = require('sequelize');
const { geocodeAddress } = require('../utils/geocode');
const { haversineDistance } = require('../utils/distance');

// สร้างความต้องการใหม่
exports.createDemand = async (req, res) => {
  try {
    const { product_name, desired_quantity, unit, desired_price } = req.body;
    const buyer_id = req.identity.id;

    // ตรวจสอบข้อมูล input
    if (!product_name || !desired_quantity || !unit) {
      return res.status(400).json({ message: 'กรุณาระบุชื่อสินค้า จำนวน และหน่วย' });
    }

    // ดึงข้อมูลผู้ซื้อ
    const buyer = await Farmers.findByPk(buyer_id) || await db.Buyers.findByPk(buyer_id);
    let location_geom = null;
    if (buyer && buyer.address) {
      const coords = await geocodeAddress(buyer.address);
      if (coords) location_geom = { type: 'Point', coordinates: [coords.lng, coords.lat] };
    }

    // สร้าง demand ใหม่
    const demand = await Demands.create({
      buyer_id,
      product_name,
      desired_quantity,
      unit,
      desired_price: desired_price || null,
      location_geom
    });

    // หา listings ที่ match
    const listings = await Listings.findAll({
      where: {
        product_name,
        quantity_available: { [Op.gte]: desired_quantity },
        status: 'available'
      },
      include: [{ model: Farmers, as: 'seller', attributes: ['id','fullname','device_token','address'] }]
    });

    const notifyList = [];

    // คำนวณระยะทาง
    for (const l of listings) {
      let listingCoords = null;
      if (l.location_geom && l.location_geom.coordinates) {
        listingCoords = { lat: l.location_geom.coordinates[1], lng: l.location_geom.coordinates[0] };
      } else if (l.seller && l.seller.address) {
        const coords = await geocodeAddress(l.seller.address);
        if (coords) listingCoords = coords;
      }

      let distance_km = null;
      if (location_geom && location_geom.coordinates && listingCoords) {
        const lat1 = location_geom.coordinates[1];
        const lon1 = location_geom.coordinates[0];
        distance_km = haversineDistance(lat1, lon1, listingCoords.lat, listingCoords.lng);
      }

      notifyList.push({ listing: l, distance_km });
    }

    // จัดเรียงตามระยะทาง
    notifyList.sort((a, b) => {
      if (a.distance_km === null) return 1;
      if (b.distance_km === null) return -1;
      return a.distance_km - b.distance_km;
    });

    const emitToUser = req.app.locals.emitToUser;
    const admin = req.app.locals.firebaseAdmin;

    // ส่ง notification
    for (const item of notifyList) {
      const l = item.listing;
      const distance_km = item.distance_km;

      // สร้าง match
      await db.Matches.create({
        listing_id: l.id,
        demand_id: demand.id,
        distance_km,
        matched_price: l.price_per_unit,
        status: 'pending'
      });

      // สร้าง notification
      const notificationRecord = await Notifications.create({
        user_id: l.seller_id,
        type: 'match',
        message: `ผู้ซื้อต้องการซื้อ ${demand.product_name} จำนวน ${demand.desired_quantity} ${demand.unit}. ราคาเสนอ ${demand.desired_price || '-'} บาท. ${distance_km ? 'ระยะทาง ' + distance_km + ' km' : ''}`
      });

      // ส่ง realtime notification
      const pushed = emitToUser(l.seller_id, 'notification', {
        id: notificationRecord.id,
        demand: {
          id: demand.id,
          product_name: demand.product_name,
          desired_quantity: demand.desired_quantity,
          unit: demand.unit
        },
        distance_km
      });

      // ถ้าไม่ online -> FCM
      if (!pushed) {
        try {
          if (l.seller.device_token) {
            await admin.messaging().send({
              token: l.seller.device_token,
              notification: {
                title: 'ผู้ซื้อต้องการสินค้า',
                body: `มีผู้ซื้อต้องการซื้อ ${demand.product_name} จำนวน ${demand.desired_quantity} ${demand.unit}`
              },
              data: { type: 'demand', demand_id: String(demand.id) }
            });
          }
        } catch (e) {
          console.error('FCM send failed', e);
        }
      }
    }

    res.status(201).json({ message: 'บันทึกความต้องการเรียบร้อย', demand });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Create demand failed', error: err.message });
  }
};

// ดึงความต้องการทั้งหมดของผู้ซื้อ
exports.getDemandsByBuyer = async (req, res) => {
  try {
    const buyer_id = req.identity.id;
    const demands = await Demands.findAll({ where: { buyer_id } });
    res.json(demands);
  } catch (err) {
    res.status(500).json({ message: 'Fetch demands failed', error: err.message });
  }
};

// ดึงตัวเลือกสินค้าจาก Listings
exports.getProductOptions = async (req, res) => {
  try {
    const products = await db.Listings.findAll({
      attributes: [
        [db.Sequelize.fn('DISTINCT', db.Sequelize.col('product_name')), 'product_name']
      ],
      where: { status: 'available' },
      order: [['product_name', 'ASC']]
    });
    const list = products.map(p => p.product_name);
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Fetch product list failed', error: err.message });
  }
};

// ลบความต้องการ
exports.deleteDemand = async (req, res) => {
  try {
    const { id } = req.params;
    const demand = await Demands.findByPk(id);
    if (!demand) return res.status(404).json({ message: 'Demand not found' });

    if (demand.buyer_id !== req.identity.id) return res.status(403).json({ message: 'Not allowed' });

    await demand.destroy();
    res.json({ message: 'Demand deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed', error: err.message });
  }
};
