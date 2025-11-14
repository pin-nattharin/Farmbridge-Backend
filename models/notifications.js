const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Notifications = sequelize.define('Notifications', {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    message: DataTypes.TEXT,
    type: {
      type: DataTypes.ENUM('match', 'payment', 'system', 'info')
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },

    meta: {
      type: DataTypes.JSONB,   // ← เพิ่มใหม่
      allowNull: true
    },

    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'notifications',
    timestamps: false
  });

  return Notifications;
};
