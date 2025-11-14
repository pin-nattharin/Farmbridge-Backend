const { verify } = require('../utils/jwt');
const db = require('../models');
const Farmers = db.Farmers;
const Buyers = db.Buyers;
const InvalidTokens = db.InvalidTokens; // เพิ่มตรงนี้

module.exports.authenticateToken = async (req, res, next) => {
  try {
    const header = req.headers['authorization'];
    const token = header && header.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    // ตรวจสอบ token ว่าอยู่ใน blacklist หรือไม่
    const blacklisted = await InvalidTokens.findOne({ where: { token } });
    if (blacklisted) return res.status(401).json({ message: 'Token invalid (logged out)' });

    const payload = verify(token);
    req.identity = { id: payload.id, role: payload.role };

    if (payload.role === 'farmer') {
      req.identity.model = await Farmers.findByPk(payload.id);
    } else if (payload.role === 'buyer') {
      req.identity.model = await Buyers.findByPk(payload.id);
    } else {
      req.identity.model = null;
    }

    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
