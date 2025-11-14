// models/InvalidTokens.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const InvalidTokens = sequelize.define('InvalidTokens', {
    token: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true
    },
    expired_at: DataTypes.DATE
  }, {
    tableName: 'invalid_tokens',
    timestamps: true
  });

  return InvalidTokens;
};
