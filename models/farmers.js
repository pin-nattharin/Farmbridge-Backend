const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Farmers = sequelize.define('Farmers', {
    fullname: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    password_hash: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    phone: DataTypes.STRING(20),
    address: DataTypes.TEXT,
    location_geom: DataTypes.GEOMETRY('POINT', 4326),
    farmer_doc_url: DataTypes.TEXT,

    device_token: {
      type: DataTypes.TEXT,   // ← เพิ่มใหม่
      allowNull: true
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'farmers',
    timestamps: false
  });

  Farmers.associate = (models) => {
    // (นี่คือความสัมพันธ์เดิมของคุณ)
    Farmers.hasMany(models.Listings, { foreignKey: 'seller_id', as: 'listings' });
    // (นี่คือความสัมพันธ์ใหม่สำหรับ Orders)
    Farmers.hasMany(models.Orders, { foreignKey: 'seller_id', as: 'Seller' });
  };

  return Farmers;
};
