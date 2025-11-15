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
    const buyer_id = req.identity.id;
    const { product_name, desired_quantity, unit, desired_price } = req.body;

    if (!product_name || !desired_quantity || !unit) {
      return res.status(400).json({ message: 'กรุณาระบุข้อมูลให้ครบ' });
    }

    // ดึงข้อมูลผู้ซื้อ (ใช้ Buyers เท่านั้น)
    const buyer = await db.Buyers.findByPk(buyer_id);

    // geocode buyer address
    let location_geom = null;
    if (buyer && buyer.address) {
      const coords = await geocodeAddress(buyer.address);
      if (coords)
        location_geom = { type: 'Point', coordinates: [coords.lng, coords.lat] };
    }

    // CREATE demand
    const demand = await Demands.create({
      buyer_id,
      product_name,
      desired_quantity,
      unit,
      desired_price: desired_price || null,
      location_geom,
      status: 'open'
    });

    // หา listing ที่ match
    const listings = await Listings.findAll({
      where: {
        product_name,
        quantity_available: { [Op.gte]: desired_quantity },
        status: 'available'
      },
      include: [
        { model: Farmers, as: 'seller', attributes: ['id','fullname','device_token','address'] }
      ]
    });

    const notifyList = [];

    for (const l of listings) {
      let listingCoords = null;

      if (l.location_geom)
        listingCoords = {
          lat: l.location_geom.coordinates[1],
          lng: l.location_geom.coordinates[0]
        };

      let distance_km = null;

      if (location_geom && listingCoords) {
        const lat1 = location_geom.coordinates[1];
        const lon1 = location_geom.coordinates[0];
        distance_km = haversineDistance(
          lat1, lon1,
          listingCoords.lat, listingCoords.lng
        );
      }

      notifyList.push({ listing: l, distance_km });
    }

    notifyList.sort((a, b) => {
      if (a.distance_km === null) return 1;
      if (b.distance_km === null) return -1;
      return a.distance_km - b.distance_km;
    });

    const emitToUser = req.app.locals.emitToUser;

    for (const item of notifyList) {
      await db.Matches.create({
        listing_id: item.listing.id,
        demand_id: demand.id,
        distance_km: item.distance_km,
        matched_price: item.listing.price_per_unit,
        status: 'pending'
      });

      const notif = await Notifications.create({
        user_id: item.listing.seller_id,
        type: 'match',
        message: `มีผู้ซื้อต้องการ ${product_name} จำนวน ${desired_quantity} ${unit}`
      });

      emitToUser(item.listing.seller_id, 'notification', {
        id: notif.id,
        demand: demand,
        distance_km: item.distance_km
      });
    }

    res.status(201).json({ message: 'Demand created', demand });

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
