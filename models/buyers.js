const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Buyers = sequelize.define('Buyers', {
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
    device_token: {
      type: DataTypes.TEXT,     // ← เพิ่มใหม่
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
    tableName: 'buyers',
    timestamps: false
  });


Buyers.associate = (models) => {
    Buyers.hasMany(models.Demands, { foreignKey: 'buyer_id', as: 'demands' });
    // (นี่คือความสัมพันธ์ใหม่สำหรับ Orders)
    Buyers.hasMany(models.Orders, { foreignKey: 'buyer_id', as: 'Buyer' });
  };

  return Buyers;
};
