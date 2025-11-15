const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Listings = sequelize.define('Listings', {
    seller_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    product_name: DataTypes.STRING(100),
    grade: DataTypes.STRING(50),
    quantity_total: DataTypes.DECIMAL(10, 2),
    quantity_available: DataTypes.DECIMAL(10, 2),
    unit: DataTypes.STRING(20),
    price_per_unit: DataTypes.DECIMAL(10, 2),
    market_price_low: DataTypes.DECIMAL(10, 2),
    market_price_high: DataTypes.DECIMAL(10, 2),
    description: DataTypes.TEXT,
    image_url: DataTypes.ARRAY(DataTypes.TEXT),
    pickup_date: DataTypes.DATE,
    pickup_time: DataTypes.STRING(50),
    status: {
      type: DataTypes.ENUM('available', 'sold_out'),
      defaultValue: 'available'
    },
    location_geom: DataTypes.GEOMETRY('POINT', 4326),
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'listings',
    timestamps: false
  });


  Listings.associate = (models) => {
    // (นี่คือความสัมพันธ์เดิมของคุณ)
    Listings.belongsTo(models.Farmers, { foreignKey: 'seller_id', as: 'seller' });
    // (นี่คือความสัมพันธ์ใหม่)
    Listings.hasMany(models.Orders, { foreignKey: 'listing_id' });
    Listings.hasMany(models.Matches, { foreignKey: 'listing_id' });
  };

  return Listings;
};
