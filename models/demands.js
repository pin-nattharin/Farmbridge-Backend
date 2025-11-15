const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Demands = sequelize.define('Demands', {
    buyer_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    product_name: DataTypes.STRING(100),
    desired_quantity: DataTypes.DECIMAL(10, 2),
    unit: DataTypes.STRING(20),
    desired_price: DataTypes.DECIMAL(10, 2),
    status: {
      type: DataTypes.ENUM('open', 'matched', 'closed'),
      defaultValue: 'open'
    },
    location_geom: DataTypes.GEOMETRY('POINT', 4326),
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    matched_listing_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'demands',
    timestamps: false
  });

Demands.associate = (models) => {
    Demands.belongsTo(models.Buyers, { foreignKey: 'buyer_id', as: 'buyer' });
    Demands.hasMany(models.Matches, { foreignKey: 'demand_id' });
  };


  return Demands;
};
