const db = require('../models');
const Farmers = db.Farmers;
const Buyers = db.Buyers;
const InvalidTokens = db.InvalidTokens;
const { hash, compare } = require('../utils/bcrypt');
const { sign } = require('../utils/jwt');
const { geocodeAddress } = require('../utils/geocode');

// register
exports.register = async (req, res) => {
  try {
    const { fullname, email, password, phone, address, farmer_doc_url } = req.body;

    if (!fullname || !email || !password) {
      return res.status(400).json({ message: 'fullname, email, and password are required' });
    }

    const lowerEmail = email.toLowerCase();
    const password_hash = await hash(password);

    // ตรวจสอบ role จาก farmer_doc_url
    let role = farmer_doc_url ? 'farmer' : 'buyer';

    // แปลง address เป็นพิกัด
    let location_geom = null;
    if (address) {
      const coords = await geocodeAddress(address);
      if (coords) location_geom = { type: 'Point', coordinates: [coords.lng, coords.lat] };
    }

    if (role === 'farmer') {
      const ex = await Farmers.findOne({ where: { email: lowerEmail } });
      if (ex) return res.status(400).json({ message: 'Email already exists (farmer)' });

      const farmer = await Farmers.create({
        fullname,
        email: lowerEmail,
        password_hash,
        phone,
        address,
        farmer_doc_url,
        location_geom
      });

      const token = sign({ id: farmer.id, role: 'farmer' });
      return res.status(201).json({
        message: 'Farmer registered',
        token,
        user: { id: farmer.id, fullname: farmer.fullname, email: farmer.email, role: 'farmer' }
      });

    } else {
      // buyer
      const ex = await Buyers.findOne({ where: { email: lowerEmail } });
      if (ex) return res.status(400).json({ message: 'Email already exists (buyer)' });

      const buyer = await Buyers.create({
        fullname,
        email: lowerEmail,
        password_hash,
        phone,
        address,
        location_geom
      });

      const token = sign({ id: buyer.id, role: 'buyer' });
      return res.status(201).json({
        message: 'Buyer registered',
        token,
        user: { id: buyer.id, fullname: buyer.fullname, email: buyer.email, role: 'buyer' }
      });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Register failed', error: err.message });
  }
};

// login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'email and password required' });

    const lowerEmail = email.toLowerCase();

    // ตรวจสอบ role อัตโนมัติ
    let user = await Farmers.findOne({ where: { email: lowerEmail } });
    let role = 'farmer';
    if (!user) {
      user = await Buyers.findOne({ where: { email: lowerEmail } });
      role = 'buyer';
    }

    if (!user) return res.status(404).json({ message: 'User not found' });

    const isValid = await compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = sign({ id: user.id, role });
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, fullname: user.fullname, email: user.email, role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

// logout
exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(400).json({ message: 'No token provided' });

    // เก็บ token ลง blacklist
    await InvalidTokens.create({
      token,
      expired_at: new Date(Date.now() + 24*60*60*1000) // เก็บ 1 วัน หรือเอาเวลาหมดอายุจริงจาก JWT
    });

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Logout failed', error: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    
    const user = req.identity.model;

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: req.identity.role,
      
      ...(req.identity.role === 'farmer' && { farmer_doc_url: user.farmer_doc_url })
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to get profile', error: err.message });
  }
};

// PUT Profile 
exports.updateProfile = async (req, res) => {
  try {
    
    const { fullname, phone, address } = req.body;

  
    const user = req.identity.model;
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

   
    const payload = {};
    if (fullname) payload.fullname = fullname;
    if (phone) payload.phone = phone;

   
    if (address) {
      payload.address = address;
      const coords = await geocodeAddress(address);
      if (coords) {
        payload.location_geom = { type: 'Point', coordinates: [coords.lng, coords.lat] };
      } else {
        payload.location_geom = null; // ถ้าหาพิกัดไม่เจอ
      }
    }

  
    await user.update(payload);


    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: req.identity.role
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
};