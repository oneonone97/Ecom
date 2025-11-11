const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Wishlist = sequelize.define('Wishlist', {
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
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'My Wishlist',
    validate: {
      notEmpty: {
        msg: 'Wishlist name is required'
      },
      len: {
        args: [1, 100],
        msg: 'Wishlist name must be between 1 and 100 characters'
      }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 500],
        msg: 'Description cannot exceed 500 characters'
      }
    }
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['isPublic']
    },
    {
      fields: ['isDefault']
    }
  ]
});

const WishlistItem = sequelize.define('WishlistItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  wishlistId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Wishlists',
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
  addedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    defaultValue: 'medium',
    allowNull: false
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 200],
        msg: 'Notes cannot exceed 200 characters'
      }
    }
  },
  priceWhenAdded: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['wishlistId']
    },
    {
      fields: ['productId']
    },
    {
      fields: ['priority']
    },
    {
      unique: true,
      fields: ['wishlistId', 'productId'],
      name: 'unique_wishlist_product'
    }
  ]
});

// Define associations
Wishlist.hasMany(WishlistItem, { 
  foreignKey: 'wishlistId', 
  as: 'items',
  onDelete: 'CASCADE'
});

WishlistItem.belongsTo(Wishlist, { 
  foreignKey: 'wishlistId',
  as: 'wishlist'
});

// Associate WishlistItem with Product
const Product = require('./Product');
WishlistItem.belongsTo(Product, {
  foreignKey: 'productId',
  as: 'product'
});

Product.hasMany(WishlistItem, {
  foreignKey: 'productId',
  as: 'wishlistItems'
});

// Instance methods for Wishlist
Wishlist.prototype.getItemCount = async function() {
  return await WishlistItem.count({
    where: { wishlistId: this.id }
  });
};

Wishlist.prototype.getTotalValue = async function() {
  const items = await WishlistItem.findAll({
    where: { wishlistId: this.id },
    include: [{
      model: sequelize.models.Product,
      as: 'product',
      attributes: ['price_paise', 'sale_price_paise']
    }]
  });

  return items.reduce((total, item) => {
    if (item.product) {
      const pricePaise = item.product.sale_price_paise || item.product.price_paise || 0;
      return total + (pricePaise / 100);
    }
    return total;
  }, 0);
};

Wishlist.prototype.addItem = async function(productId, options = {}) {
  const { priority = 'medium', notes = null, priceWhenAdded = null } = options;
  
  // Check if item already exists
  const existingItem = await WishlistItem.findOne({
    where: {
      wishlistId: this.id,
      productId: productId
    }
  });

  if (existingItem) {
    throw new Error('Product is already in this wishlist');
  }

  // Get product price if not provided
  let price = priceWhenAdded;
  if (!price) {
    const product = await sequelize.models.Product.findByPk(productId);
    if (product) {
      // Use sale_price_paise if available, otherwise price_paise, convert to rupees
      const pricePaise = product.sale_price_paise || product.price_paise || 0;
      price = pricePaise / 100;
    }
  }

  return await WishlistItem.create({
    wishlistId: this.id,
    productId: productId,
    priority: priority,
    notes: notes,
    priceWhenAdded: price
  });
};

Wishlist.prototype.removeItem = async function(productId) {
  const deletedCount = await WishlistItem.destroy({
    where: {
      wishlistId: this.id,
      productId: productId
    }
  });

  if (deletedCount === 0) {
    throw new Error('Product not found in this wishlist');
  }

  return { message: 'Item removed from wishlist successfully' };
};

Wishlist.prototype.clearAll = async function() {
  const deletedCount = await WishlistItem.destroy({
    where: { wishlistId: this.id }
  });

  return { 
    message: 'Wishlist cleared successfully',
    itemsRemoved: deletedCount 
  };
};

Wishlist.prototype.moveItemTo = async function(productId, targetWishlistId) {
  const item = await WishlistItem.findOne({
    where: {
      wishlistId: this.id,
      productId: productId
    }
  });

  if (!item) {
    throw new Error('Product not found in this wishlist');
  }

  // Check if target wishlist exists and belongs to same user
  const targetWishlist = await Wishlist.findOne({
    where: {
      id: targetWishlistId,
      userId: this.userId
    }
  });

  if (!targetWishlist) {
    throw new Error('Target wishlist not found');
  }

  // Check if product already exists in target wishlist
  const existingInTarget = await WishlistItem.findOne({
    where: {
      wishlistId: targetWishlistId,
      productId: productId
    }
  });

  if (existingInTarget) {
    // Just remove from current wishlist
    await item.destroy();
    return { message: 'Item moved successfully (already existed in target)' };
  }

  // Move the item
  await item.update({ wishlistId: targetWishlistId });
  
  return { message: 'Item moved successfully' };
};

// Instance methods for WishlistItem
WishlistItem.prototype.updatePriority = async function(newPriority) {
  if (!['low', 'medium', 'high'].includes(newPriority)) {
    throw new Error('Invalid priority. Must be low, medium, or high');
  }

  return await this.update({ priority: newPriority });
};

WishlistItem.prototype.updateNotes = async function(newNotes) {
  return await this.update({ notes: newNotes });
};

WishlistItem.prototype.checkAvailability = async function() {
  const product = await sequelize.models.Product.findByPk(this.productId);
  const isAvailable = product && product.stock > 0;
  
  if (this.isAvailable !== isAvailable) {
    await this.update({ isAvailable });
  }
  
  return isAvailable;
};

// Class methods for Wishlist
Wishlist.getUserWishlists = async function(userId) {
  return await this.findAll({
    where: { userId },
    include: [{
      model: WishlistItem,
      as: 'items',
      include: [{
        model: sequelize.models.Product,
        as: 'product',
        attributes: ['id', 'name', 'price_paise', 'sale_price_paise', 'image_url', 'stock']
      }]
    }],
    order: [
      ['isDefault', 'DESC'],
      ['createdAt', 'ASC'],
      [{ model: WishlistItem, as: 'items' }, 'addedAt', 'DESC']
    ]
  });
};

Wishlist.getDefaultWishlist = async function(userId) {
  let defaultWishlist = await this.findOne({
    where: { 
      userId,
      isDefault: true 
    }
  });

  // Create default wishlist if it doesn't exist
  if (!defaultWishlist) {
    defaultWishlist = await this.create({
      userId,
      name: 'My Wishlist',
      isDefault: true
    });
  }

  return defaultWishlist;
};

Wishlist.getPublicWishlists = async function(limit = 10, offset = 0) {
  return await this.findAndCountAll({
    where: { isPublic: true },
    include: [{
      model: sequelize.models.User,
      as: 'user',
      attributes: ['id', 'name']
    }, {
      model: WishlistItem,
      as: 'items',
      limit: 3, // Show preview of items
      include: [{
        model: sequelize.models.Product,
        as: 'product',
        attributes: ['id', 'name', 'price_paise', 'sale_price_paise', 'image_url']
      }]
    }],
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });
};

// Class methods for WishlistItem
WishlistItem.getPopularProducts = async function(limit = 10) {
  return await this.findAll({
    attributes: [
      'productId',
      [sequelize.fn('COUNT', sequelize.col('productId')), 'wishlistCount']
    ],
    include: [{
      model: sequelize.models.Product,
      as: 'product',
      attributes: ['id', 'name', 'price_paise', 'sale_price_paise', 'image_url', 'stock']
    }],
    group: ['productId'],
    order: [[sequelize.fn('COUNT', sequelize.col('productId')), 'DESC']],
    limit
  });
};

WishlistItem.checkPriceDrops = async function() {
  const items = await this.findAll({
    include: [{
      model: sequelize.models.Product,
      as: 'product',
      attributes: ['id', 'name', 'price_paise', 'sale_price_paise']
    }]
  });

  const priceDrops = [];

  for (const item of items) {
    if (item.product && item.priceWhenAdded) {
      const pricePaise = item.product.sale_price_paise || item.product.price_paise || 0;
      const currentPrice = pricePaise / 100; // Convert from paise to rupees
      const originalPrice = parseFloat(item.priceWhenAdded);
      
      if (currentPrice < originalPrice) {
        const discount = ((originalPrice - currentPrice) / originalPrice * 100).toFixed(1);
        priceDrops.push({
          item,
          originalPrice,
          currentPrice,
          discountPercentage: discount,
          savings: (originalPrice - currentPrice).toFixed(2)
        });
      }
    }
  }

  return priceDrops;
};

module.exports = { Wishlist, WishlistItem };