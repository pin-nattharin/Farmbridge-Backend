// controllers/order.controller.js
const db = require('../models');
const { Op } = require('sequelize');


const omise = require('omise')({
  'secretKey': process.env.OMISE_SECRET_KEY, 
});


const Orders = db.Orders;
const Listings = db.Listings;
const Buyers = db.Buyers;
const Farmers = db.Farmers;
const Notifications = db.Notifications;

/**
 * 1. (Buyer) สร้างออเดอร์ใหม่
 * รับ Omise Token -> ตัดเงิน(ปลอม) -> ตัดสต็อก -> สร้างออเดอร์
 */
exports.createOrder = async (req, res) => {
  // ⭐️ 2. รับ omise_token ที่เพิ่มเข้ามา
  const { listing_id, quantity, pickup_slot, omise_token } = req.body;
  const buyer_id = req.identity.id; // มาจาก authenticateToken

  // ตรวจสอบ Input
  if (!listing_id || !quantity || !pickup_slot || !omise_token) {
    return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน (listing_id, quantity, pickup_slot, omise_token)' });
  }

  try {
    // ⭐️ 3. ค้นหาสินค้า (ยังไม่ล็อค) เพื่อคำนวณราคา
    const listing = await Listings.findByPk(listing_id);

    if (!listing) {
      return res.status(404).json({ message: 'ไม่พบสินค้า' });
    }
    if (listing.status !== 'available') {
      return res.status(400).json({ message: 'สินค้านี้ขายไปแล้ว' });
    }
    // ตรวจสอบจำนวนที่สั่งซื้อเทียบกับสต็อก
    if (listing.quantity_available < quantity) {
      return res.status(400).json({ message: `สินค้ามีไม่เพียงพอ (เหลือ: ${listing.quantity_available})` });
    }

    //  4. คำนวณราคา (Omise รับเป็นสตางค์)
    const total_price = listing.price_per_unit * quantity;
    const amount_in_satang = Math.round(total_price * 100); // เช่น 150 บาท -> 15000 สตางค์

    //  5. "ตัดเงิน(ปลอม)" โดยใช้ Omise (Test Mode)
    let charge;
    try {
      charge = await omise.charges.create({
        amount: amount_in_satang,
        currency: 'thb',
        source: omise_token, // Token (ตั๋ว) ที่ได้จาก Frontend
        description: `Order for listing ${listing_id} by buyer ${buyer_id}`
      });

      // (เช็กว่าสำเร็จจริงไหม)
      if (charge.status !== 'successful') {
        throw new Error(`Payment failed: ${charge.failure_message || 'Unknown error'}`);
      }
    } catch (paymentErr) {
      console.error('Omise Charge Failed:', paymentErr.message);
      return res.status(400).json({ message: `การชำระเงินล้มเหลว: ${paymentErr.message}` });
    }

    // ⭐️ 6. "จ่ายเงิน(ปลอม)สำเร็จแล้ว!" -> เริ่มทำงาน PoC เดิม (ตัดสต็อก)
    const t = await db.sequelize.transaction();
    try {
      // 6.1 ล็อคแถวข้อมูลและตัดสต็อก
      // (ต้องค้นหาอีกครั้งภายใน Transaction เพื่อ Lock)
      const lockedListing = await Listings.findByPk(listing_id, { transaction: t, lock: t.LOCK.UPDATE });
      
      const newQuantity = lockedListing.quantity_available - quantity;
      await lockedListing.update({
        quantity_available: newQuantity,
        status: newQuantity <= 0 ? 'sold_out' : 'available' // ถ้าของหมด ให้เปลี่ยนสถานะ
      }, { transaction: t });

      // 6.2 สร้างรหัสรับสินค้า (สุ่ม 6 ตัว)
      const confirmation_code = Math.random().toString(36).substring(2, 8).toUpperCase();

      // 6.3 สร้างออเดอร์
      const order = await Orders.create({
        listing_id: listing_id,
        buyer_id: buyer_id,
        seller_id: lockedListing.seller_id,
        quantity_ordered: quantity,
        total_price: total_price,
        status: 'Processing', // สถานะ: รอดำเนินการ (รอรับของ)
        confirmation_code: confirmation_code,
        pickup_slot: pickup_slot,
        charge_id: charge.id // (Optional) เก็บ ID การจ่ายเงินของ Omise ไว้
      }, { transaction: t });

      // 6.4 สร้างการแจ้งเตือนไปหาเกษตรกร
      const seller = await Farmers.findByPk(lockedListing.seller_id);
      const message = `คุณมียอดสั่งซื้อ: ${lockedListing.product_name} จำนวน ${quantity} (รหัส ${confirmation_code})`;
      
      await Notifications.create({
        user_id: listing.seller_id,
        type: 'sale',
        message: message,
        related_id: order.id
      }, { transaction: t });

      // (ส่วนนี้คือการยิง Real-time/FCM ที่คุณมีอยู่แล้ว)
      // (เช็กให้แน่ใจว่า req.app.locals มีจริง)
      const emitToUser = req.app.locals.emitToUser;
      const admin = req.app.locals.firebaseAdmin;
      
      const pushed = emitToUser ? emitToUser(listing.seller_id, 'notification', { message, orderId: order.id }) : false;
      
      if (!pushed && admin && seller && seller.device_token) {
        try {
          await admin.messaging().send({
            token: seller.device_token,
            notification: { title: 'คุณขายของได้แล้ว!', body: message },
            data: { type: 'order', order_id: String(order.id) }
          });
        } catch (e) { console.error('FCM send failed', e); }
      }
      

      await t.commit();
      res.status(201).json({ message: 'สั่งซื้อสำเร็จ!', order: order });

    } catch (dbErr) {
      await t.rollback();
      
      console.error('DB Error after payment:', dbErr);
      res.status(500).json({ message: 'จ่ายเงินแล้ว แต่สร้างออเดอร์ล้มเหลว', error: dbErr.message });
    }

  } catch (err) {
    // (Error ตอนเช็ก listing หรือตอนจ่ายเงิน)
    console.error(err);
    res.status(500).json({ message: 'การสั่งซื้อล้มเหลว', error: err.message });
  }
};

/**
 * 2. (Farmer) ยืนยันการรับสินค้า (เกษตรกรกรอกรหัส)
 */
exports.confirmPickup = async (req, res) => {
  const { confirmation_code } = req.body;
  const { order_id } = req.params;
  const farmer_id = req.identity.id; // มาจาก authenticateToken

  if (!confirmation_code) {
    return res.status(400).json({ message: 'กรุณาระบุรหัสรับสินค้า' });
  }

  try {
    const order = await Orders.findByPk(order_id);

    if (!order) {
      return res.status(404).json({ message: 'ไม่พบออเดอร์' });
    }
    // ตรวจสอบว่าเกษตรกรเป็นเจ้าของออเดอร์นี้
    if (order.seller_id !== farmer_id) {
      return res.status(403).json({ message: 'คุณไม่ใช่เจ้าของออเดอร์นี้' });
    }
    // ตรวจสอบสถานะ
    if (order.status !== 'Processing') {
      return res.status(400).json({ message: 'ออเดอร์นี้ถูกจัดการไปแล้ว' });
    }
    //  ตรวจสอบรหัส 
    if (order.confirmation_code !== confirmation_code.trim().toUpperCase()) {
      return res.status(400).json({ message: 'รหัสรับสินค้าไม่ถูกต้อง' });
    }

    
    
    // อัปเดตสถานะออเดอร์
    await order.update({ status: 'Completed' });

    // สร้างการแจ้งเตือนกลับไปหาผู้ซื้อ (ว่ารับของแล้ว)
    await Notifications.create({
      user_id: order.buyer_id,
      type: 'order_completed',
      message: `รับสินค้า ${order.confirmation_code} สำเร็จแล้ว`,
      related_id: order.id
    });
    // (ยิง Real-time/FCM กลับไปหา Buyer ด้วย Logic เดียวกัน)

    res.json({ message: 'ยืนยันการรับสินค้าสำเร็จ!', order });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'การยืนยันล้มเหลว', error: err.message });
  }
};

/**
 * 3. (Buyer) ดึงประวัติการซื้อของฉัน
 * (สำหรับหน้า "ประวัติการซื้อ" ของผู้ซื้อ)
 */
exports.getPurchaseHistory = async (req, res) => {
  try {
    const orders = await Orders.findAll({
      where: { buyer_id: req.identity.id }, // ดึงเฉพาะของคนที่ Login
      order: [['created_at', 'DESC']], 
      include: [
        // ดึงข้อมูลสินค้ามาด้วย
        { 
          model: Listings, 
          attributes: ['id', 'product_name', 'image_url'] 
        },
        // ดึงข้อมูลผู้ขาย (เกษตรกร) มาด้วย
        { 
          model: Farmers, 
          as: 'Seller', 
          attributes: ['id', 'fullname', 'phone'] //  ส่งเบอร์โทรไปด้วย
        }
      ]
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch purchase history', error: err.message });
  }
};

/**
 * 4. (Farmer) ดึงประวัติการขายของฉัน
 * (สำหรับหน้า "รายการที่ต้องเตรียม" ของเกษตรกร)
 */
exports.getSalesHistory = async (req, res) => {
  try {
    const orders = await Orders.findAll({
      where: { seller_id: req.identity.id }, // ดึงเฉพาะของคนที่ Login
      order: [['created_at', 'DESC']], 
      include: [
        { 
          model: Listings, 
          attributes: ['id', 'product_name'] 
        },
        { 
          model: Buyers, 
          as: 'Buyer', // (ต้องตั้งชื่อ as: 'Buyer' ใน Model Orders ใหถูก)
          attributes: ['id', 'fullname']
        }
      ]
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch sales history', error: err.message });
  }
};