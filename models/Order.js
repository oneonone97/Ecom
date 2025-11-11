const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
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
  },
  total_amount_paise: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: {
        args: [0],
        msg: 'Total amount must be positive'
      }
    }
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'INR',
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'failed', 'cancelled'),
    defaultValue: 'pending',
    allowNull: false
  },
  razorpay_order_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  razorpay_payment_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  razorpay_signature: {
    type: DataTypes.STRING,
    allowNull: true
  },
  receipt: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  paymentMethod: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  payment_gateway: {
    type: DataTypes.ENUM('phonepe', 'razorpay', 'stripe'),
    allowNull: true,
    defaultValue: 'phonepe'
  },
  phonepe_merchant_transaction_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  phonepe_transaction_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  phonepe_payment_instrument_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  address_json: {
    type: DataTypes.JSON,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Address is required'
      }
    }
  },
  orderNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'Orders'
});

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Orders',
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
    validate: {
      min: {
        args: [1],
        msg: 'Quantity must be at least 1'
      }
    }
  },
  unit_price_paise: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: {
        args: [0],
        msg: 'Price must be positive'
      }
    }
  },
  productName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  productDescription: {
    type: DataTypes.STRING(500),
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'OrderItems'
});

// Define associations
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

// Associate OrderItem with Product
const Product = require('./Product');
OrderItem.belongsTo(Product, {
  foreignKey: 'productId',
  as: 'Product'
});

Product.hasMany(OrderItem, {
  foreignKey: 'productId',
  as: 'orderItems'
});

// Instance methods
Order.prototype.getTotalItems = function() {
  return this.items ? this.items.reduce((total, item) => total + item.quantity, 0) : 0;
};

Order.prototype.calculateTotal = function() {
  return this.items ? this.items.reduce((total, item) => total + (item.price * item.quantity), 0) : 0;
};

module.exports = { Order, OrderItem };