const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Transactions = sequelize.define('Transactions', {
    match_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    buyer_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    seller_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    product_name: DataTypes.STRING(100),
    quantity: DataTypes.DECIMAL(10, 2),
    price_per_unit: DataTypes.DECIMAL(10, 2),
    total_amount: DataTypes.DECIMAL(12, 2),
    payment_status: {
      type: DataTypes.ENUM('pending', 'paid', 'verified', 'cancelled'),
      defaultValue: 'pending'
    },
    payment_slip_url: DataTypes.TEXT,
    pickup_date: DataTypes.DATE,
    pickup_code: {
      type: DataTypes.STRING(10),
      unique: true
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
    tableName: 'transactions',
    timestamps: false
  });


  Transactions.associate = (models) => {
    // (เราเพิ่มไว้เผื่อๆ แต่โค้ดใหม่จะไม่เรียกใช้)
    Transactions.belongsTo(models.Buyers, { foreignKey: 'buyer_id' });
    Transactions.belongsTo(models.Farmers, { foreignKey: 'seller_id' });
  };

  return Transactions;
};
