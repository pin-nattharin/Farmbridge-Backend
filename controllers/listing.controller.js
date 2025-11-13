// controllers/listing.controller.js
const db = require('../models');
const Listings = db.Listings;
const Farmers = db.Farmers;
const { geocodeAddress } = require('../utils/geocode');
const { Op } = require('sequelize');

// GET all listings (optional filters: product_name, status)
exports.getAll = async (req, res) => {
  try {
    const { product_name, status } = req.query;
    const where = {};
    if (product_name) where.product_name = { [Op.iLike]: `%${product_name}%` };
    if (status) where.status = status;

    const rows = await Listings.findAll({
      where,
      include: [{ model: Farmers, as: 'seller', attributes: ['id','fullname','email','phone','address'] }],
      order: [['created_at','DESC']]
    });

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch listings', error: err.message });
  }
};

// GET listing by id
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await Listings.findByPk(id, {
      include: [{ model: Farmers, as: 'seller', attributes: ['id','fullname','email','phone','address'] }]
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
    const identity = req.identity;
    if (!identity || identity.role !== 'farmer')
      return res.status(403).json({ message: 'Only farmers can create listings' });

    const { product_name, grade, quantity_total, price_per_unit, pickup_date, description, image_urls } = req.body;

    // ตรวจสอบ required fields
    if (!product_name || !quantity_total || !price_per_unit || !pickup_date) {
      return res.status(400).json({ message: 'กรุณากรอกชื่อสินค้า, จำนวน, ราคาต่อหน่วย, และวันที่สะดวกรับสินค้า' });
    }

    // ตรวจสอบอย่างน้อย 1 รูป
    if (!image_urls || !Array.isArray(image_urls) || image_urls.length === 0) {
      return res.status(400).json({ message: 'กรุณาใส่รูปสินค้าขึ้นไปอย่างน้อย 1 รูป' });
    }

    let location_geom = null;
    const farmer = await Farmers.findByPk(identity.id);
    if (farmer && farmer.address) {
      const coords = await geocodeAddress(farmer.address);
      if (coords) location_geom = { type: 'Point', coordinates: [coords.lng, coords.lat] };
    }

    const newListing = await Listings.create({
      seller_id: identity.id,
      product_name,
      grade: grade || null,
      quantity_total,
      quantity_available: quantity_total,
      price_per_unit,
      pickup_date,
      description: description || null,
      image_url: image_urls, // array ของรูป
      status: 'available',
      location_geom
    });

    res.status(201).json({ message: 'Listing created', listing: newListing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Create failed', error: err.message });
  }
};

// UPDATE listing (เฉพาะเกษตรกรเจ้าของ listing)
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const identity = req.identity;
    const listing = await Listings.findByPk(id);

    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (identity.role !== 'farmer' || Number(listing.seller_id) !== Number(identity.id)) {
      return res.status(403).json({ message: 'Not authorized to update this listing' });
    }

    const { product_name, grade, quantity_total, price_per_unit, pickup_date, description, image_urls } = req.body;

    const payload = {};
    if (product_name) payload.product_name = product_name;
    if (grade) payload.grade = grade;

    // ✅ ตรวจสอบและแปลงให้เป็นตัวเลขเสมอ
    if (quantity_total !== undefined) {
      const newQty = parseFloat(quantity_total);
      if (isNaN(newQty) || newQty < 0)
        return res.status(400).json({ message: 'quantity_total ต้องเป็นตัวเลขบวก' });

      const diff = newQty - Number(listing.quantity_total);
      payload.quantity_total = newQty;
      payload.quantity_available = (Number(listing.quantity_available) || 0) + diff;
      if (payload.quantity_available < 0) payload.quantity_available = 0;
    }

    if (price_per_unit !== undefined) {
      const newPrice = parseFloat(price_per_unit);
      if (isNaN(newPrice) || newPrice < 0)
        return res.status(400).json({ message: 'price_per_unit ต้องเป็นตัวเลขบวก' });
      payload.price_per_unit = newPrice;
    }

    if (pickup_date) payload.pickup_date = pickup_date;
    if (description) payload.description = description;

    // ถ้าอัปเดตรูป ต้องมีอย่างน้อย 1 รูป
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

    if (listing.quantity_available !== null && Number(listing.quantity_available) <= 0) {
      await listing.update({ status: 'sold_out' });
    }

    res.json({ message: 'Listing updated', listing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Update failed', error: err.message });
  }
};

// DELETE listing (เฉพาะเจ้าของ)
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const identity = req.identity;
    const listing = await Listings.findByPk(id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    if (identity.role !== 'farmer' || Number(listing.seller_id) !== Number(identity.id)) {
      return res.status(403).json({ message: 'Not authorized to delete this listing' });
    }

    await listing.destroy();
    res.json({ message: 'Listing deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Delete failed', error: err.message });
  }
};

// Market price suggestion (ให้ผู้ขายเห็นราคากลางเป็น popup)
exports.marketSuggestion = async (req, res) => {
  try {
    const { product_name, days = 7 } = req.query;
    if (!product_name) return res.status(400).json({ message: 'product_name is required' });

    const since = new Date();
    since.setDate(since.getDate() - Number(days));

    const rows = await Listings.findAll({
      where: {
        product_name: { [Op.iLike]: `%${product_name}%` },
        created_at: { [Op.gte]: since },
        price_per_unit: { [Op.ne]: null }
      },
      attributes: ['price_per_unit', 'created_at']
    });

    if (!rows || rows.length === 0) 
      return res.json({ message: 'No recent trades found', count: 0, avg: null });

    const prices = rows.map(r => Number(r.price_per_unit));
    const avg = prices.reduce((a,b)=>a+b,0)/prices.length;
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