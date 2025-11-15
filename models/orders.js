// models/orders.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Orders = sequelize.define('Orders', {
    listing_id: { type: DataTypes.INTEGER, allowNull: false },
    buyer_id: { type: DataTypes.INTEGER, allowNull: false },
    seller_id: { type: DataTypes.INTEGER, allowNull: false },
    quantity_ordered: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    total_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    status: {
      type: DataTypes.ENUM('Processing', 'Completed', 'Cancelled'),
      defaultValue: 'Processing'
    },
    confirmation_code: { // รหัสรับของ
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true
    },
    pickup_slot: { // วันเวลารับของ
      type: DataTypes.TEXT,
      allowNull: false
    },
    charge_id: { // ID จาก Omise
      type: DataTypes.STRING,
      allowNull: true
    },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'orders', // ⭐️ ชื่อตารางใหม่
    timestamps: false
  });

  // ⭐️⭐️⭐️ เพิ่มความสัมพันธ์ (สำคัญมาก) ⭐️⭐️⭐️
  Orders.associate = (models) => {
    // Orders 1 ใบ เป็นของ ผู้ซื้อ 1 คน (ชื่อ 'Buyer')
    Orders.belongsTo(models.Buyers, { foreignKey: 'buyer_id', as: 'Buyer' });
    // Orders 1 ใบ เป็นของ เกษตรกร 1 คน (ชื่อ 'Seller')
    Orders.belongsTo(models.Farmers, { foreignKey: 'seller_id', as: 'Seller' });
    // Orders 1 ใบ อ้างอิงถึง Listing 1 อัน
    Orders.belongsTo(models.Listings, { foreignKey: 'listing_id' });
  };

  return Orders;
};