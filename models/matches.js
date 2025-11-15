const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Matches = sequelize.define('Matches', {
    listing_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    demand_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    distance_km: DataTypes.DECIMAL(10, 2),
    matched_price: DataTypes.DECIMAL(10, 2),
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'completed', 'cancelled'),
      defaultValue: 'pending'
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'matches',
    timestamps: false
  });


  Matches.associate = (models) => {
    Matches.belongsTo(models.Listings, { foreignKey: 'listing_id' });
    Matches.belongsTo(models.Demands, { foreignKey: 'demand_id' });
  };

  return Matches;
};
