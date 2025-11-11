const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('../config/database');

const RefreshToken = sequelize.define('RefreshToken', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  token: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  isRevoked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  deviceInfo: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING(45), // IPv6 support
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['token']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['expiresAt']
    }
  ]
});

// Static methods
RefreshToken.generateToken = function() {
  return crypto.randomBytes(64).toString('hex');
};

RefreshToken.createToken = async function(userId, deviceInfo = null, ipAddress = null, userAgent = null) {
  const token = this.generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  return await this.create({
    token,
    userId,
    expiresAt,
    deviceInfo,
    ipAddress,
    userAgent
  });
};

// Instance methods
RefreshToken.prototype.isExpired = function() {
  return Date.now() >= this.expiresAt.getTime();
};

RefreshToken.prototype.isValid = function() {
  return !this.isRevoked && !this.isExpired();
};

RefreshToken.prototype.revoke = async function() {
  return await this.update({ isRevoked: true });
};

// Clean up expired tokens
RefreshToken.cleanupExpired = async function() {
  const expiredCount = await this.destroy({
    where: {
      expiresAt: {
        [sequelize.Sequelize.Op.lt]: new Date()
      }
    }
  });
  
  return expiredCount;
};

// Revoke all tokens for a user
RefreshToken.revokeAllForUser = async function(userId) {
  return await this.update(
    { isRevoked: true },
    { where: { userId, isRevoked: false } }
  );
};

// Set up associations
RefreshToken.associate = function(models) {
  RefreshToken.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'user'
  });
};

module.exports = RefreshToken;