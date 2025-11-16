// controllers/notification.controller.js (รวม Logic)
const db = require('../models');
const Buyers = db.Buyers; // สมมติว่านี่คือ Model Buyer

exports.updateExpoToken = async (req, res) => {
    try {
        const userId = req.identity.id;
        const { expoPushToken } = req.body;

        if (!expoPushToken) {
            return res.status(400).json({ message: 'expoPushToken is required' });
        }
        
        // 💡 SERVICE LOGIC ถูกเขียนใน Controller โดยตรง
        // 1. ตรวจสอบและบันทึก Token
        const [updatedRows] = await Buyers.update(
            { expoPushToken: expoPushToken }, // บันทึก Expo Token
            { where: { id: userId } }
        );

        if (updatedRows === 0) {
            // หากไม่พบแถวที่อัปเดต ให้ลองสร้างหรือจัดการ Error
            return res.status(404).json({ message: 'User not found or token already up-to-date' });
        }

        return res.status(200).json({ message: 'Expo Token updated successfully' });

    } catch (err) {
        console.error('Error updating Expo Token:', err);
        res.status(500).json({ message: 'Failed to update Expo Token', error: err.message });
    }
};