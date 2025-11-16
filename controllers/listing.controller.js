// controllers/listing.controller.js
const db = require('../models');
const Listings = db.Listings;
const Farmers = db.Farmers;
const { geocodeAddress } = require('../utils/geocode');
const { Op } = require('sequelize');
const { haversineDistance } = require('../utils/distance');

//  รายการสินค้าและเกรดที่อนุญาต (ใช้ dropdown)
const allowedProducts = ['มะม่วง', 'มังคุด', 'ทุเรียน', 'องุ่น'];
const allowedGrades = ['เกรด B', 'เกรด C', 'เกรดต่ำกว่า C'];

// GET all listings (ถูกต้อง)
// controllers/listing.controller.js (exports.getAll ที่แก้ไขสมบูรณ์แล้ว)

exports.getAll = async (req, res) => {
    try {
        const { product_name, status, distance } = req.query; // ดึง distance กลับมา
        const where = {};
        
        // 1. กรองตามชื่อสินค้า
        if (product_name && product_name !== 'all') {
            where.product_name = product_name.trim();
        }
        // 2. กรองตามสถานะ
        if (status) {
            where.status = status.trim();
        } else {
            where.status = 'available'; // Default status
        }

        // 3. ดึง Listings ทั้งหมด (ใช้ db.Listings)
        let rows = await Listings.findAll({
            where,
            include: [
                { 
                    model: Farmers, 
                    as: 'seller', 
                    attributes: ['id', 'fullname', 'address', 'location_geom'] // 🚨 ต้องมี location_geom
                }
            ],
            order: [['created_at', 'DESC']]
        });
        
        /* // 4. ตรวจสอบ Location Geom (จาก Middleware)
        const userLocationGeom = req.identity?.model?.location_geom;

        // 5. คำนวณและกรองตามระยะทาง (ถ้าผู้ใช้ล็อกอิน และเลือก Filter 'distance')
        if (userLocationGeom && distance && distance !== 'all') {
            const userLocation = userLocationGeom.coordinates; // [lng, lat]
            const maxDistanceKm = Number(distance);
            
            rows = rows.filter(listing => {
                const sellerLocation = listing.location_geom?.coordinates; 
                
                if (!sellerLocation) return false;
                
                const dist = haversineDistance(
                    userLocation[1], userLocation[0],
                    sellerLocation[1], sellerLocation[0]
                );
                
                listing.dataValues.distance_km = dist; 
                return dist <= maxDistanceKm;
            });
            
            // เรียงลำดับตามระยะทาง
            rows.sort((a, b) => a.dataValues.distance_km - b.dataValues.distance_km);
        }
        
        // 6. เพิ่ม distance_km เป็น null สำหรับรายการที่ยังไม่มี (Public/ไม่มีพิกัด)
        rows = rows.map(listing => {
            if (listing.dataValues.distance_km === undefined) { 
                listing.dataValues.distance_km = null; 
            }
            return listing;
        }); */

        // 7. ส่ง Response ที่ถูกต้องออกไป
        res.json(rows); 
        
    } catch (err) {
        console.error("Error in getAll listings:", err);
        res.status(500).json({ message: 'Failed to fetch public listings', error: err.message });
    }
};

// GET all listings for current farmer (ถูกต้อง)
exports.getMyListings = async (req, res) => {
  try {
    const identity = req.identity;
    const { product_name, status } = req.query;
    const where = { seller_id: identity.id };
    if (product_name) where.product_name = product_name.trim();
    if (status) where.status = status.trim();
    const rows = await Listings.findAll({
      where,
      include: [
        { model: Farmers, as: 'seller', attributes: ['id', 'fullname', 'email', 'phone', 'address'] }
      ],
      order: [['created_at', 'DESC']]
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch your listings', error: err.message });
  }
};

// GET listing by id (ถูกต้อง)
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await Listings.findByPk(id, {
      include: [
        { model: Farmers, as: 'seller', attributes: ['id', 'fullname', 'email', 'phone', 'address'] }
      ]
    });
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
};

// CREATE listing (เฉพาะเกษตรกร)
exports.create = async (req, res) => {
  try {
    const farmer_id = req.identity.id;
    let { product_name, grade, quantity_total, price_per_unit, pickup_date, description, image_urls, unit } = req.body;

    if (!allowedProducts.includes(product_name)) {
      return res.status(400).json({ message: 'ชื่อสินค้าที่เลือกไม่ถูกต้อง' });
    }
    if (grade && !allowedGrades.includes(grade)) {
      return res.status(400).json({ message: 'เกรดสินค้าที่เลือกไม่ถูกต้อง' });
    }

    // แก้ไข: แปลง String เป็น Number ก่อน
    const qty = parseFloat(quantity_total);
    const price = parseFloat(price_per_unit);

    if (!qty || !price || !pickup_date) {
      return res.status(400).json({ message: 'Missing or invalid required fields (quantity, price, pickup_date)' });
    }

    const farmer = await Farmers.findByPk(farmer_id);
    let location_geom = null;
    if (farmer && farmer.address) {
      const coords = await geocodeAddress(farmer.address);
      if (coords) location_geom = { type: 'Point', coordinates: [coords.lng, coords.lat] };
    }

    // CREATE LISTING
    const listing = await Listings.create({
      seller_id: farmer_id,
      product_name,
      grade: grade || null,
      quantity_total: qty, //  ใช้ Number
      quantity_available: qty, //  ใช้ Number
      unit,
      price_per_unit: price, // ใช้ Number
      pickup_date,
      description: description || null,
      image_url: image_urls,
      status: 'available',
      location_geom
    });

    // --- Match และแจ้งเตือนผู้ซื้อ ---
    const demands = await db.Demands.findAll({
      where: {
        product_name,
        desired_quantity: { [Op.lte]: qty }, //  ใช้ Number
        status: 'open'
      }
    });

    const notifyList = [];
    for (const d of demands) {
      let buyerCoords = null;
      if (d.location_geom) {
        buyerCoords = { lat: d.location_geom.coordinates[1], lng: d.location_geom.coordinates[0] };
      }
      let distance_km = null;
      if (buyerCoords && location_geom) {
        distance_km = haversineDistance(
          buyerCoords.lat, buyerCoords.lng,
          location_geom.coordinates[1], location_geom.coordinates[0]
        );
      }
      notifyList.push({ demand: d, distance_km });
    }

    notifyList.sort((a, b) => {
      if (a.distance_km === null) return 1;
      if (b.distance_km === null) return -1;
      return a.distance_km - b.distance_km;
    });

    const emitToUser = req.app.locals.emitToUser;

    for (const item of notifyList) {
      await db.Matches.create({
        listing_id: listing.id,
        demand_id: item.demand.id,
        distance_km: item.distance_km,
        matched_price: price, //  ใช้ Number
        status: 'pending'
      });

      const notif = await db.Notifications.create({
        user_id: item.demand.buyer_id,
        type: 'match',
        message: `มีสินค้าที่ตรงกับความต้องการ: ${product_name}`
      });

      if (emitToUser) {
        emitToUser(item.demand.buyer_id, 'notification', {
            id: notif.id,
            listing: listing,
            distance_km: item.distance_km
          });
      }
    }

    res.status(201).json({ message: 'Listing created', listing });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Create listing failed', error: err.message });
  }
};

// UPDATE listing (เฉพาะเกษตรกรเจ้าของ listing)
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const identity = req.identity;
    const listing = await Listings.findByPk(id);

    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (Number(listing.seller_id) !== Number(identity.id)) {
      return res.status(403).json({ message: 'Not authorized to update this listing' });
  S }

    let { product_name, grade, quantity_total, price_per_unit, pickup_date, description, image_urls } = req.body;
    const payload = {};

    if (product_name) {
      if (!allowedProducts.includes(product_name)) {
        return res.status(400).json({ message: 'ชื่อสินค้าที่เลือกไม่ถูกต้อง' });
      }
      payload.product_name = product_name;
    }
    if (grade) {
      if (!allowedGrades.includes(grade)) {
        return res.status(400).json({ message: 'เกรดสินค้าที่เลือกไม่ถูกต้อง' });
      }
      payload.grade = grade;
    }

    if (quantity_total !== undefined) {
      // ✅✅✅ แก้ไข: แปลง String เป็น Number ก่อน
      const newQty = parseFloat(quantity_total);
      if (isNaN(newQty) || newQty < 0) return res.status(400).json({ message: 'quantity_total ต้องเป็นตัวเลขบวก' });

      // ✅✅✅ แก้ไข: แปลง String เป็น Number ก่อน
      const diff = newQty - parseFloat(listing.quantity_total);
      payload.quantity_total = newQty;
      // ✅✅✅ แก้ไข: แปลง String เป็น Number ก่อน
      payload.quantity_available = (parseFloat(listing.quantity_available) || 0) + diff;
      if (payload.quantity_available < 0) payload.quantity_available = 0;
    }

    if (price_per_unit !== undefined) {
      // ✅✅✅ แก้ไข: แปลง String เป็น Number ก่อน
      const newPrice = parseFloat(price_per_unit);
      if (isNaN(newPrice) || newPrice < 0) return res.status(400).json({ message: 'price_per_unit ต้องเป็นตัวเลขบวก' });
      payload.price_per_unit = newPrice;
    }

    if (pickup_date) payload.pickup_date = pickup_date;
    if (description) payload.description = description;

    if (image_urls !== undefined) {
      if (!Array.isArray(image_urls) || image_urls.length === 0) {
        return res.status(400).json({ message: 'กรุณาใส่รูปสินค้าขึ้นไปอย่างน้อย 1 รูป' });
      }
      payload.image_url = image_urls;
    }

    // fallback location_geom
    if (!listing.location_geom) {
      const farmer = await Farmers.findByPk(identity.id);
      if (farmer && farmer.address) {
        const coords = await geocodeAddress(farmer.address);
        if (coords) {
          payload.location_geom = { type: 'Point', coordinates: [coords.lng, coords.lat] };
        }
      }
    }

    await listing.update(payload);

    if (listing.quantity_available !== null && parseFloat(listing.quantity_available) <= 0) {
      await listing.update({ status: 'sold_out' });
    }

    res.json({ message: 'Listing updated', listing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Update failed', error: err.message });
  }
};

// DELETE listing (ถูกต้อง)
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const identity = req.identity;
    const listing = await Listings.findByPk(id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (Number(listing.seller_id) !== Number(identity.id)) {
      return res.status(403).json({ message: 'Not authorized to delete this listing' });
    }
    await listing.destroy();
    res.json({ message: 'Listing deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Delete failed', error: err.message });
  }
};

// Market price suggestion (ถูกต้อง)
exports.marketSuggestion = async (req, res) => {
  try {
    const { product_name, days = 7 } = req.query;
    if (!product_name)
      return res.status(400).json({ message: 'product_name is required' });

    const since = new Date();
    since.setDate(since.getDate() - Number(days));

    const rows = await Listings.findAll({
      where: {
        product_name: product_name,
        created_at: { [Op.gte]: since },
        price_per_unit: { [Op.ne]: null }
      },
      attributes: ['price_per_unit', 'created_at']
    });

    if (!rows || rows.length === 0)
      return res.json({ message: 'No recent trades found', count: 0, avg: null });

    const prices = rows.map(r => Number(r.price_per_unit));
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    res.json({
      count: prices.length,
      avg: Number(avg.toFixed(2)),
      low: min,
      high: max,
      sample_count: prices.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Suggestion failed', error: err.message });
  }
};