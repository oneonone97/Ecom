const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
require('./User'); // Ensure User model is registered first

const Cart = sequelize.define('Cart', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  }
}, {
  timestamps: true,
  tableName: 'Carts'
});

const CartItem = sequelize.define('CartItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  cartId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Carts',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Products',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: {
        args: [1],
        msg: 'Quantity must be at least 1'
      }
    }
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: {
        args: [0],
        msg: 'Price must be positive'
      }
    }
  }
}, {
  timestamps: true,
  tableName: 'CartItems'
});

// Define associations
Cart.hasMany(CartItem, { foreignKey: 'cartId', as: 'items' });
CartItem.belongsTo(Cart, { foreignKey: 'cartId' });

// Associate CartItem with Product
const Product = require('./Product');
CartItem.belongsTo(Product, { foreignKey: 'productId' });

// Virtual methods for cart calculations
Cart.prototype.getTotalItems = function() {
  return this.items ? this.items.reduce((total, item) => total + item.quantity, 0) : 0;
};

Cart.prototype.getTotalPrice = function() {
  return this.items ? this.items.reduce((total, item) => total + (item.price * item.quantity), 0) : 0;
};

module.exports = { Cart, CartItem };